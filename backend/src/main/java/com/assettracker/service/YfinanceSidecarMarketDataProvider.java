package com.assettracker.service;

import com.assettracker.config.AssetTrackerProperties;
import com.assettracker.model.QuoteResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

@Component
public class YfinanceSidecarMarketDataProvider implements MarketDataProvider {

    private static final Logger log = LoggerFactory.getLogger(YfinanceSidecarMarketDataProvider.class);
    private static final Pattern NON_STANDARD_NUMBER_PATTERN =
            Pattern.compile("(?<=[:\\[,\\s])(?:NaN|-Infinity|Infinity)(?=[,\\]}\\s])");

    private final AssetTrackerProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final MarketHistoryCacheRepository marketHistoryCacheRepository;

    public YfinanceSidecarMarketDataProvider(AssetTrackerProperties properties,
                                             ObjectMapper objectMapper,
                                             MarketHistoryCacheRepository marketHistoryCacheRepository) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.marketHistoryCacheRepository = marketHistoryCacheRepository;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(properties.marketData().timeoutSeconds()))
                .build();
    }

    @Override
    public Optional<QuoteResult> lookup(PortfolioMetadataRepository.UserRecord user, String symbol, String market) {
        if (!sidecarEnabled() || symbol == null || symbol.isBlank()) {
            return Optional.empty();
        }
        try {
            HttpResponse<String> response = send("/internal/market/quote?symbol=" + encode(symbol) + "&market=" + encode(market));
            if (response.statusCode() == 404 || response.body().isBlank()) {
                return Optional.empty();
            }
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                return Optional.empty();
            }
            return Optional.of(parseQuote(objectMapper.readTree(response.body()), market));
        } catch (Exception ignored) {
            return Optional.empty();
        }
    }

    @Override
    public List<QuoteResult> search(PortfolioMetadataRepository.UserRecord user,
                                    String query,
                                    String market,
                                    List<String> types) {
        if (!sidecarEnabled() || query == null || query.isBlank()) {
            return List.of();
        }
        try {
            StringBuilder path = new StringBuilder("/internal/market/search?query=")
                    .append(encode(query));
            if (market != null && !market.isBlank()) {
                path.append("&market=").append(encode(market));
            }
            if (types != null) {
                for (String type : types) {
                    path.append("&type=").append(encode(type));
                }
            }
            HttpResponse<String> response = send(path.toString());
            if (response.statusCode() < 200 || response.statusCode() >= 300 || response.body().isBlank()) {
                return List.of();
            }
            JsonNode root = objectMapper.readTree(response.body());
            List<QuoteResult> results = new ArrayList<>();
            for (JsonNode node : root) {
                results.add(parseQuote(node, market));
            }
            return results;
        } catch (Exception ignored) {
            return List.of();
        }
    }

    @Override
    public Optional<InspectionResult> inspect(PortfolioMetadataRepository.UserRecord user,
                                              String symbol,
                                              String market,
                                              String period,
                                              String interval) {
        if (!sidecarEnabled() || symbol == null || symbol.isBlank()) {
            return Optional.empty();
        }
        try {
            HttpResponse<String> response = send("/internal/market/inspect?symbol=" + encode(symbol)
                    + "&market=" + encode(market)
                    + "&period=" + encode(period == null ? "1d" : period)
                    + "&interval=" + encode(interval == null ? "5m" : interval));
            if (response.statusCode() == 404 || response.body().isBlank() || response.statusCode() < 200 || response.statusCode() >= 300) {
                log.warn("Inspect fallback for {} {} because sidecar returned status {}", symbol, market, response.statusCode());
                return inspectFallback(user, symbol, market, period, interval);
            }
            try {
                return Optional.of(parseInspection(objectMapper.readTree(sanitizeJsonBody(response.body())), symbol, market));
            } catch (Exception exception) {
                log.warn("Inspect parse failed for {} {}. Falling back to sparse quote/history.", symbol, market, exception);
                return inspectFallback(user, symbol, market, period, interval);
            }
        } catch (Exception exception) {
            log.warn("Inspect request failed for {} {}. Falling back to sparse quote/history.", symbol, market, exception);
            return inspectFallback(user, symbol, market, period, interval);
        }
    }

    @Override
    public List<HistoricalBar> history(PortfolioMetadataRepository.UserRecord user,
                                       String symbol,
                                       String market,
                                       String period,
                                       String interval) {
        if (!sidecarEnabled() || symbol == null || symbol.isBlank()) {
            return List.of();
        }
        try {
            String marketCode = normalizeMarket(market);
            String normalizedSymbol = normalizeSymbol(symbol, marketCode);
            String intervalCode = interval == null || interval.isBlank() ? "1d" : interval;
            String requestedPeriod = period == null || period.isBlank() ? "1mo" : period;

            Optional<MarketHistoryCacheRepository.CacheState> cacheState = marketHistoryCacheRepository.loadState(
                    normalizedSymbol,
                    marketCode,
                    intervalCode
            );

            if (cacheState.isPresent() && coverageIncludes(cacheState.get().coveragePeriod(), requestedPeriod)) {
                refreshTail(symbol, marketCode, normalizedSymbol, intervalCode, cacheState.get());
                return filterBarsByPeriod(
                        marketHistoryCacheRepository.loadBars(normalizedSymbol, marketCode, intervalCode),
                        requestedPeriod
                );
            }

            List<CachedHistoricalBar> fetchedBars = fetchFullHistory(symbol, marketCode, requestedPeriod, intervalCode);
            if (fetchedBars.isEmpty()) {
                return List.of();
            }

            marketHistoryCacheRepository.replaceAllBars(
                    normalizedSymbol,
                    marketCode,
                    intervalCode,
                    fetchedBars.stream()
                            .map(CachedHistoricalBar::toCachedBar)
                            .toList()
            );
            CachedHistoricalBar latestBar = fetchedBars.get(fetchedBars.size() - 1);
            marketHistoryCacheRepository.saveState(
                    normalizedSymbol,
                    marketCode,
                    intervalCode,
                    requestedPeriod,
                    latestBar.time(),
                    latestBar.epochSeconds()
            );
            return fetchedBars.stream().map(CachedHistoricalBar::toHistoricalBar).toList();
        } catch (Exception ignored) {
            return List.of();
        }
    }

    @Override
    public Optional<Double> fxRate(String baseCurrency, String quoteCurrency) {
        if (!sidecarEnabled() || baseCurrency == null || baseCurrency.isBlank() || quoteCurrency == null || quoteCurrency.isBlank()) {
            return Optional.empty();
        }
        if (baseCurrency.equalsIgnoreCase(quoteCurrency)) {
            return Optional.of(1d);
        }
        try {
            HttpResponse<String> response = send("/internal/market/fx?base=" + encode(baseCurrency) + "&quote=" + encode(quoteCurrency));
            if (response.statusCode() == 404 || response.body().isBlank()) {
                return Optional.empty();
            }
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                return Optional.empty();
            }
            JsonNode root = objectMapper.readTree(response.body());
            Double rate = nullableDouble(root.path("rate"));
            return rate == null ? Optional.empty() : Optional.of(rate);
        } catch (Exception ignored) {
            return Optional.empty();
        }
    }

    private HttpResponse<String> send(String path) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(URI.create(properties.marketData().sidecarBaseUrl() + path))
                .timeout(Duration.ofSeconds(properties.marketData().timeoutSeconds()))
                .header("Accept", "application/json")
                .GET()
                .build();
        return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private QuoteResult parseQuote(JsonNode node, String requestedMarket) {
        String market = node.path("market").asText(requestedMarket == null ? "US" : requestedMarket).toUpperCase(Locale.ROOT);
        return new QuoteResult(
                node.path("symbol").asText(),
                node.path("name").asText(node.path("symbol").asText()),
                market,
                node.path("type").asText("Stock"),
                node.path("currency").asText("USD"),
                node.path("price").asDouble(),
                node.path("dayChangePct").asDouble()
        );
    }

    private InspectionResult parseInspection(JsonNode node, String requestedSymbol, String requestedMarket) {
        List<HistoricalBar> history = parseHistorySafely(node.path("history"));
        List<NewsItem> news = parseNewsSafely(node.path("news"));
        FinancialStatement incomeStatement = parseFinancialStatementSafely(node.path("incomeStatement"), "Income Statement");
        FinancialStatement balanceSheet = parseFinancialStatementSafely(node.path("balanceSheet"), "Balance Sheet");
        FinancialStatement cashFlow = parseFinancialStatementSafely(node.path("cashFlow"), "Cash Flow");

        return new InspectionResult(
                node.path("requestedSymbol").asText(requestedSymbol == null ? "" : requestedSymbol),
                node.path("normalizedSymbol").asText(node.path("symbol").asText(requestedSymbol == null ? "" : requestedSymbol)),
                node.path("market").asText(requestedMarket == null ? "US" : requestedMarket).toUpperCase(Locale.ROOT),
                node.path("name").asText(node.path("symbol").asText(requestedSymbol == null ? "" : requestedSymbol)),
                node.path("type").asText("Stock"),
                node.path("currency").asText("USD"),
                node.path("price").asDouble(),
                node.path("dayChangePct").asDouble(),
                nullableText(node.path("exchange")),
                nullableText(node.path("timezone")),
                nullableDouble(node.path("previousClose")),
                nullableDouble(node.path("openPrice")),
                nullableDouble(node.path("dayHigh")),
                nullableDouble(node.path("dayLow")),
                nullableDouble(node.path("fiftyTwoWeekHigh")),
                nullableDouble(node.path("fiftyTwoWeekLow")),
                nullableDouble(node.path("volume")),
                nullableDouble(node.path("averageVolume")),
                nullableDouble(node.path("marketCap")),
                nullableText(node.path("sector")),
                nullableText(node.path("industry")),
                nullableText(node.path("website")),
                nullableText(node.path("longBusinessSummary")),
                nullableText(node.path("headquarters")),
                nullableText(node.path("country")),
                nullableText(node.path("ceo")),
                nullableDouble(node.path("fullTimeEmployees")),
                nullableDouble(node.path("beta")),
                nullableDouble(node.path("trailingPe")),
                nullableDouble(node.path("forwardPe")),
                nullableDouble(node.path("trailingEps")),
                nullableDouble(node.path("forwardEps")),
                nullableDouble(node.path("dividendYield")),
                nullableDouble(node.path("fiftyDayAverage")),
                nullableDouble(node.path("twoHundredDayAverage")),
                nullableDouble(node.path("sharesOutstanding")),
                news,
                incomeStatement,
                balanceSheet,
                cashFlow,
                history
        );
    }

    private List<HistoricalBar> parseHistorySafely(JsonNode node) {
        List<HistoricalBar> history = new ArrayList<>();
        if (node == null || node.isMissingNode() || node.isNull()) {
            return history;
        }
        for (JsonNode barNode : node) {
            try {
                String time = nullableText(barNode.path("time"));
                Double open = nullableDouble(barNode.path("open"));
                Double high = nullableDouble(barNode.path("high"));
                Double low = nullableDouble(barNode.path("low"));
                Double close = nullableDouble(barNode.path("close"));
                if (time == null || open == null || high == null || low == null || close == null) {
                    continue;
                }
                history.add(new HistoricalBar(time, open, high, low, close));
            } catch (Exception ignored) {
            }
        }
        return history;
    }

    private List<NewsItem> parseNewsSafely(JsonNode node) {
        List<NewsItem> news = new ArrayList<>();
        if (node == null || node.isMissingNode() || node.isNull()) {
            return news;
        }
        for (JsonNode newsNode : node) {
            try {
                news.add(new NewsItem(
                        nullableText(newsNode.path("title")),
                        nullableText(newsNode.path("publisher")),
                        nullableText(newsNode.path("link")),
                        nullableText(newsNode.path("publishedAt")),
                        nullableText(newsNode.path("summary"))
                ));
            } catch (Exception ignored) {
            }
        }
        return news;
    }

    private FinancialStatement parseFinancialStatementSafely(JsonNode node, String fallbackTitle) {
        try {
            return parseFinancialStatement(node, fallbackTitle);
        } catch (Exception ignored) {
            return null;
        }
    }

    private FinancialStatement parseFinancialStatement(JsonNode node, String fallbackTitle) {
        List<String> periods = new ArrayList<>();
        for (JsonNode periodNode : node.path("periods")) {
            String period = nullableText(periodNode);
            if (period != null) {
                periods.add(period);
            }
        }
        List<FinancialRow> rows = new ArrayList<>();
        for (JsonNode rowNode : node.path("rows")) {
            List<Double> values = new ArrayList<>();
            for (JsonNode valueNode : rowNode.path("values")) {
                values.add(nullableDouble(valueNode));
            }
            String label = nullableText(rowNode.path("label"));
            if (label != null) {
                rows.add(new FinancialRow(label, values));
            }
        }
        if (periods.isEmpty() && rows.isEmpty()) {
            return null;
        }
        return new FinancialStatement(
                node.path("title").asText(fallbackTitle),
                periods,
                rows
        );
    }

    private Optional<InspectionResult> inspectFallback(PortfolioMetadataRepository.UserRecord user,
                                                       String symbol,
                                                       String market,
                                                       String period,
                                                       String interval) {
        Optional<QuoteResult> quote = lookup(user, symbol, market);
        if (quote.isEmpty()) {
            return Optional.empty();
        }
        QuoteResult resolvedQuote = quote.get();
        String resolvedMarket = normalizeMarket(
                resolvedQuote.market() == null || resolvedQuote.market().isBlank() ? market : resolvedQuote.market()
        );
        String requestedSymbol = symbol == null ? resolvedQuote.symbol() : symbol.trim().toUpperCase(Locale.ROOT);
        String normalizedSymbol = normalizeSymbol(
                resolvedQuote.symbol() == null || resolvedQuote.symbol().isBlank() ? requestedSymbol : resolvedQuote.symbol(),
                resolvedMarket
        );
        List<HistoricalBar> bars = history(
                user,
                resolvedQuote.symbol() == null || resolvedQuote.symbol().isBlank() ? requestedSymbol : resolvedQuote.symbol(),
                resolvedMarket,
                period,
                interval
        );
        Double previousClose = null;
        Double dayHigh = null;
        Double dayLow = null;
        if (!bars.isEmpty()) {
            HistoricalBar latestBar = bars.get(bars.size() - 1);
            previousClose = bars.size() > 1 ? bars.get(bars.size() - 2).close() : latestBar.open();
            dayHigh = latestBar.high();
            dayLow = latestBar.low();
        }

        return Optional.of(new InspectionResult(
                requestedSymbol,
                normalizedSymbol,
                resolvedMarket,
                resolvedQuote.name(),
                resolvedQuote.type(),
                resolvedQuote.currency(),
                resolvedQuote.price(),
                resolvedQuote.dayChangePct(),
                null,
                null,
                previousClose,
                bars.isEmpty() ? null : bars.get(bars.size() - 1).open(),
                dayHigh,
                dayLow,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                List.of(),
                null,
                null,
                null,
                bars
        ));
    }

    private boolean sidecarEnabled() {
        return "sidecar".equalsIgnoreCase(properties.marketData().provider());
    }

    private void refreshTail(String symbol,
                             String marketCode,
                             String normalizedSymbol,
                             String intervalCode,
                             MarketHistoryCacheRepository.CacheState state) throws IOException, InterruptedException {
        if (state.lastBarEpochSeconds() == null) {
            return;
        }
        Instant start = overlapStart(Instant.ofEpochSecond(state.lastBarEpochSeconds()), intervalCode);
        List<CachedHistoricalBar> refreshedBars = fetchIncrementalHistory(symbol, marketCode, intervalCode, start, Instant.now());
        if (refreshedBars.isEmpty()) {
            return;
        }
        marketHistoryCacheRepository.replaceRange(
                normalizedSymbol,
                marketCode,
                intervalCode,
                refreshedBars.stream().map(CachedHistoricalBar::toCachedBar).toList()
        );
        CachedHistoricalBar latestBar = refreshedBars.get(refreshedBars.size() - 1);
        marketHistoryCacheRepository.saveState(
                normalizedSymbol,
                marketCode,
                intervalCode,
                state.coveragePeriod(),
                latestBar.time(),
                latestBar.epochSeconds()
        );
    }

    private List<CachedHistoricalBar> fetchFullHistory(String symbol,
                                                       String marketCode,
                                                       String period,
                                                       String interval) throws IOException, InterruptedException {
        HttpResponse<String> response = send("/internal/market/history?symbol=" + encode(symbol)
                + "&market=" + encode(marketCode)
                + "&period=" + encode(period)
                + "&interval=" + encode(interval));
        return parseHistoricalBars(response);
    }

    private List<CachedHistoricalBar> fetchIncrementalHistory(String symbol,
                                                              String marketCode,
                                                              String interval,
                                                              Instant start,
                                                              Instant end) throws IOException, InterruptedException {
        HttpResponse<String> response = send("/internal/market/history?symbol=" + encode(symbol)
                + "&market=" + encode(marketCode)
                + "&interval=" + encode(interval)
                + "&start=" + encode(start.toString())
                + "&end=" + encode(end.toString()));
        return parseHistoricalBars(response);
    }

    private List<CachedHistoricalBar> parseHistoricalBars(HttpResponse<String> response) throws IOException {
        if (response.statusCode() < 200 || response.statusCode() >= 300 || response.body().isBlank()) {
            return List.of();
        }
        JsonNode root = objectMapper.readTree(response.body());
        Map<Long, CachedHistoricalBar> deduped = new HashMap<>();
        for (JsonNode node : root) {
            String time = node.path("time").asText();
            long epochSeconds = parseEpochSeconds(time);
            deduped.put(epochSeconds, new CachedHistoricalBar(
                    time,
                    epochSeconds,
                    node.path("open").asDouble(),
                    node.path("high").asDouble(),
                    node.path("low").asDouble(),
                    node.path("close").asDouble()
            ));
        }
        return deduped.values().stream()
                .sorted(Comparator.comparingLong(CachedHistoricalBar::epochSeconds))
                .toList();
    }

    private List<HistoricalBar> filterBarsByPeriod(List<HistoricalBar> bars, String period) {
        if (bars.isEmpty() || period == null || period.isBlank() || "max".equalsIgnoreCase(period)) {
            return bars;
        }
        long latestEpoch = parseEpochSeconds(bars.get(bars.size() - 1).time());
        long cutoffEpoch = cutoffEpoch(period, latestEpoch);
        if (cutoffEpoch == Long.MIN_VALUE) {
            return bars;
        }
        return bars.stream()
                .filter(bar -> parseEpochSeconds(bar.time()) >= cutoffEpoch)
                .toList();
    }

    private long cutoffEpoch(String period, long latestEpoch) {
        Instant latest = Instant.ofEpochSecond(latestEpoch);
        return switch (period.toLowerCase(Locale.ROOT)) {
            case "1d" -> latest.minus(Duration.ofDays(1)).getEpochSecond();
            case "5d" -> latest.minus(Duration.ofDays(5)).getEpochSecond();
            case "1mo" -> latest.atOffset(ZoneOffset.UTC).minusMonths(1).toInstant().getEpochSecond();
            case "3mo" -> latest.atOffset(ZoneOffset.UTC).minusMonths(3).toInstant().getEpochSecond();
            case "6mo" -> latest.atOffset(ZoneOffset.UTC).minusMonths(6).toInstant().getEpochSecond();
            case "ytd" -> LocalDate.ofInstant(latest, ZoneOffset.UTC).withDayOfYear(1)
                    .atStartOfDay()
                    .toEpochSecond(ZoneOffset.UTC);
            case "1y" -> latest.atOffset(ZoneOffset.UTC).minusYears(1).toInstant().getEpochSecond();
            case "5y" -> latest.atOffset(ZoneOffset.UTC).minusYears(5).toInstant().getEpochSecond();
            case "60d" -> latest.minus(Duration.ofDays(60)).getEpochSecond();
            default -> Long.MIN_VALUE;
        };
    }

    private boolean coverageIncludes(String cachedPeriod, String requestedPeriod) {
        return periodRank(cachedPeriod) >= periodRank(requestedPeriod);
    }

    private int periodRank(String period) {
        return switch ((period == null ? "" : period).toLowerCase(Locale.ROOT)) {
            case "1d" -> 1;
            case "5d" -> 2;
            case "1mo" -> 3;
            case "3mo" -> 4;
            case "6mo" -> 5;
            case "60d" -> 6;
            case "ytd" -> 7;
            case "1y" -> 8;
            case "5y" -> 9;
            case "max" -> 10;
            default -> 0;
        };
    }

    private Instant overlapStart(Instant lastBarTime, String intervalCode) {
        String normalizedInterval = intervalCode == null ? "1d" : intervalCode.toLowerCase(Locale.ROOT);
        return switch (normalizedInterval) {
            case "1wk", "1w" -> lastBarTime.minus(Duration.ofDays(8));
            case "1mo" -> lastBarTime.minus(Duration.ofDays(32));
            default -> lastBarTime.minus(Duration.ofDays(1));
        };
    }

    private String normalizeMarket(String market) {
        if (market == null || market.isBlank()) {
            return "US";
        }
        String upper = market.toUpperCase(Locale.ROOT);
        if ("THAI".equals(upper) || "TH".equals(upper)) {
            return "TH";
        }
        return upper;
    }

    private String normalizeSymbol(String symbol, String marketCode) {
        String upper = symbol == null ? "" : symbol.trim().toUpperCase(Locale.ROOT);
        if ("TH".equals(marketCode) && !upper.endsWith(".BK")) {
            return upper + ".BK";
        }
        if ("UK".equals(marketCode) && !upper.endsWith(".L")) {
            return upper + ".L";
        }
        if ("TW".equals(marketCode) && !upper.endsWith(".TW")) {
            return upper + ".TW";
        }
        return upper;
    }

    private String encode(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
    }

    private String sanitizeJsonBody(String body) {
        if (body == null || body.isBlank()) {
            return body;
        }
        return NON_STANDARD_NUMBER_PATTERN.matcher(body).replaceAll("null");
    }

    private String nullableText(JsonNode node) {
        return node == null || node.isMissingNode() || node.isNull() || node.asText().isBlank()
                ? null
                : node.asText();
    }

    private Double nullableDouble(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        if (node.isNumber()) {
            return node.asDouble();
        }
        if (!node.isTextual()) {
            return null;
        }
        String text = node.asText().trim();
        if (text.isBlank()
                || "NaN".equalsIgnoreCase(text)
                || "Infinity".equalsIgnoreCase(text)
                || "-Infinity".equalsIgnoreCase(text)
                || "null".equalsIgnoreCase(text)) {
            return null;
        }
        try {
            return Double.parseDouble(text);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private long parseEpochSeconds(String rawTime) {
        try {
            return OffsetDateTime.parse(rawTime).toInstant().getEpochSecond();
        } catch (Exception ignored) {
        }
        try {
            return Instant.parse(rawTime).getEpochSecond();
        } catch (Exception ignored) {
        }
        try {
            return LocalDate.parse(rawTime).atStartOfDay().toEpochSecond(ZoneOffset.UTC);
        } catch (Exception ignored) {
        }
        return 0L;
    }

    private record CachedHistoricalBar(String time,
                                       long epochSeconds,
                                       double open,
                                       double high,
                                       double low,
                                       double close) {
        private HistoricalBar toHistoricalBar() {
            return new HistoricalBar(time, open, high, low, close);
        }

        private MarketHistoryCacheRepository.CachedBar toCachedBar() {
            return new MarketHistoryCacheRepository.CachedBar(time, epochSeconds, open, high, low, close);
        }
    }
}
