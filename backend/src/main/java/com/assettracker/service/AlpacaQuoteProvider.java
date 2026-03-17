package com.assettracker.service;

import com.assettracker.model.QuoteResult;
import org.springframework.beans.factory.annotation.Value;
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
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class AlpacaQuoteProvider {

    private static final Duration ASSET_CACHE_TTL = Duration.ofMinutes(30);

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final String secretKey;
    private final String tradingBaseUrl;
    private final String marketDataBaseUrl;

    private volatile Instant assetCacheExpiresAt = Instant.EPOCH;
    private volatile List<AlpacaAsset> assetCache = List.of();
    private final Map<String, Optional<QuoteResult>> quoteCache = new ConcurrentHashMap<>();

    public AlpacaQuoteProvider(ObjectMapper objectMapper,
                               @Value("${asset-tracker.alpaca.api-key:}") String apiKey,
                               @Value("${asset-tracker.alpaca.secret-key:}") String secretKey,
                               @Value("${asset-tracker.alpaca.trading-base-url:https://paper-api.alpaca.markets}") String tradingBaseUrl,
                               @Value("${asset-tracker.alpaca.market-data-base-url:https://data.alpaca.markets}") String marketDataBaseUrl) {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
        this.objectMapper = objectMapper;
        this.apiKey = apiKey;
        this.secretKey = secretKey;
        this.tradingBaseUrl = tradingBaseUrl;
        this.marketDataBaseUrl = marketDataBaseUrl;
    }

    public Optional<QuoteResult> lookup(String symbol) {
        if (!isConfigured() || symbol == null || symbol.isBlank()) {
            return Optional.empty();
        }
        return quoteCache.computeIfAbsent(symbol.toUpperCase(Locale.ROOT), this::fetchSnapshotQuote);
    }

    public List<QuoteResult> search(String query, List<String> types) {
        if (!isConfigured() || query == null || query.isBlank()) {
            return List.of();
        }

        List<AlpacaAsset> candidates = loadAssets().stream()
                .filter(asset -> matchesQuery(asset, query))
                .sorted(Comparator
                        .comparing((AlpacaAsset asset) -> asset.symbol.equalsIgnoreCase(query)).reversed()
                        .thenComparing(asset -> asset.symbol))
                .limit(8)
                .toList();

        List<QuoteResult> results = new ArrayList<>();
        for (AlpacaAsset asset : candidates) {
            Optional<QuoteResult> quote = lookup(asset.symbol);
            if (quote.isEmpty()) {
                continue;
            }
            QuoteResult resolved = quote.get();
            if (types != null && !types.isEmpty() && !types.contains(resolved.type())) {
                continue;
            }
            results.add(resolved);
        }
        return results;
    }

    private boolean isConfigured() {
        return !apiKey.isBlank() && !secretKey.isBlank();
    }

    private boolean matchesQuery(AlpacaAsset asset, String query) {
        String normalized = query.toLowerCase(Locale.ROOT);
        return asset.symbol.toLowerCase(Locale.ROOT).contains(normalized)
                || asset.name.toLowerCase(Locale.ROOT).contains(normalized);
    }

    private List<AlpacaAsset> loadAssets() {
        if (Instant.now().isBefore(assetCacheExpiresAt) && !assetCache.isEmpty()) {
            return assetCache;
        }

        synchronized (this) {
            if (Instant.now().isBefore(assetCacheExpiresAt) && !assetCache.isEmpty()) {
                return assetCache;
            }

            HttpRequest request = requestBuilder(tradingBaseUrl + "/v2/assets?status=active&asset_class=us_equity")
                    .GET()
                    .build();
            try {
                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() < 200 || response.statusCode() >= 300) {
                    return List.of();
                }

                JsonNode root = objectMapper.readTree(response.body());
                List<AlpacaAsset> loadedAssets = new ArrayList<>();
                for (JsonNode node : root) {
                    boolean tradable = node.path("tradable").asBoolean(false);
                    String status = node.path("status").asText("");
                    if (!tradable || !"active".equalsIgnoreCase(status)) {
                        continue;
                    }
                    loadedAssets.add(new AlpacaAsset(
                            node.path("symbol").asText(),
                            node.path("name").asText()
                    ));
                }
                assetCache = loadedAssets;
                assetCacheExpiresAt = Instant.now().plus(ASSET_CACHE_TTL);
                return assetCache;
            } catch (IOException exception) {
                return List.of();
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                return List.of();
            }
        }
    }

    private Optional<QuoteResult> fetchSnapshotQuote(String symbol) {
        HttpRequest request = requestBuilder(marketDataBaseUrl + "/v2/stocks/" + encode(symbol) + "/snapshot")
                .GET()
                .build();
        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                return Optional.empty();
            }

            JsonNode root = objectMapper.readTree(response.body());
            JsonNode latestTrade = root.path("latestTrade");
            JsonNode dailyBar = root.path("dailyBar");
            JsonNode previousBar = root.path("prevDailyBar");
            if (latestTrade.isMissingNode() || latestTrade.path("p").isMissingNode()) {
                return Optional.empty();
            }

            double price = latestTrade.path("p").asDouble(0);
            double dayChangePct = 0;
            if (!dailyBar.isMissingNode() && !previousBar.isMissingNode()) {
                double close = dailyBar.path("c").asDouble(0);
                double prevClose = previousBar.path("c").asDouble(0);
                if (close > 0 && prevClose > 0) {
                    price = close;
                    dayChangePct = ((close - prevClose) / prevClose) * 100;
                }
            }

            String name = loadAssets().stream()
                    .filter(asset -> asset.symbol.equalsIgnoreCase(symbol))
                    .map(asset -> asset.name)
                    .findFirst()
                    .orElse(symbol);

            return Optional.of(new QuoteResult(symbol, name, "US", "Stock", "USD", price, dayChangePct));
        } catch (IOException exception) {
            return Optional.empty();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return Optional.empty();
        }
    }

    private HttpRequest.Builder requestBuilder(String uri) {
        return HttpRequest.newBuilder(URI.create(uri))
                .timeout(Duration.ofSeconds(8))
                .header("APCA-API-KEY-ID", apiKey)
                .header("APCA-API-SECRET-KEY", secretKey)
                .header("Accept", "application/json");
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private record AlpacaAsset(String symbol, String name) {
    }
}
