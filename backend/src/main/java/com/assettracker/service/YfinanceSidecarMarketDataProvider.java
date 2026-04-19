package com.assettracker.service;

import com.assettracker.config.AssetTrackerProperties;
import com.assettracker.model.QuoteResult;
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
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Component
public class YfinanceSidecarMarketDataProvider implements MarketDataProvider {

    private final AssetTrackerProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public YfinanceSidecarMarketDataProvider(AssetTrackerProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
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
                    .append(encode(query))
                    .append("&market=")
                    .append(encode(market));
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
            if (response.statusCode() == 404 || response.body().isBlank()) {
                return Optional.empty();
            }
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                return Optional.empty();
            }
            return Optional.of(parseInspection(objectMapper.readTree(response.body()), symbol, market));
        } catch (Exception ignored) {
            return Optional.empty();
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
            HttpResponse<String> response = send("/internal/market/history?symbol=" + encode(symbol)
                    + "&market=" + encode(market)
                    + "&period=" + encode(period == null ? "1d" : period)
                    + "&interval=" + encode(interval == null ? "5m" : interval));
            if (response.statusCode() < 200 || response.statusCode() >= 300 || response.body().isBlank()) {
                return List.of();
            }
            JsonNode root = objectMapper.readTree(response.body());
            List<HistoricalBar> bars = new ArrayList<>();
            for (JsonNode node : root) {
                bars.add(new HistoricalBar(
                        node.path("time").asText(),
                        node.path("open").asDouble(),
                        node.path("high").asDouble(),
                        node.path("low").asDouble(),
                        node.path("close").asDouble()
                ));
            }
            return bars;
        } catch (Exception ignored) {
            return List.of();
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
        List<HistoricalBar> history = new ArrayList<>();
        for (JsonNode barNode : node.path("history")) {
            history.add(new HistoricalBar(
                    barNode.path("time").asText(),
                    barNode.path("open").asDouble(),
                    barNode.path("high").asDouble(),
                    barNode.path("low").asDouble(),
                    barNode.path("close").asDouble()
            ));
        }

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
                history
        );
    }

    private boolean sidecarEnabled() {
        return "sidecar".equalsIgnoreCase(properties.marketData().provider());
    }

    private String encode(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
    }

    private String nullableText(JsonNode node) {
        return node == null || node.isMissingNode() || node.isNull() || node.asText().isBlank()
                ? null
                : node.asText();
    }

    private Double nullableDouble(JsonNode node) {
        return node == null || node.isMissingNode() || node.isNull() || !node.isNumber()
                ? null
                : node.asDouble();
    }
}
