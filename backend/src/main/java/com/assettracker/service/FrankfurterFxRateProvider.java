package com.assettracker.service;

import com.assettracker.config.AssetTrackerProperties;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Optional;

@Service
public class FrankfurterFxRateProvider implements FxRateProvider {

    private final AssetTrackerProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public FrankfurterFxRateProvider(AssetTrackerProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newHttpClient();
    }

    @Override
    public Optional<FxRateQuote> latestRate(String baseCurrencyCode, String quoteCurrencyCode) {
        if (baseCurrencyCode == null || quoteCurrencyCode == null
                || baseCurrencyCode.equalsIgnoreCase(quoteCurrencyCode)) {
            return Optional.of(new FxRateQuote(baseCurrencyCode, quoteCurrencyCode, 1, "identity"));
        }
        try {
            String uri = properties.fx().baseUrl()
                    + "/latest?from="
                    + URLEncoder.encode(baseCurrencyCode, StandardCharsets.UTF_8)
                    + "&to="
                    + URLEncoder.encode(quoteCurrencyCode, StandardCharsets.UTF_8);
            HttpRequest request = HttpRequest.newBuilder(URI.create(uri))
                    .header("Accept", "application/json")
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                return Optional.empty();
            }
            JsonNode root = objectMapper.readTree(response.body());
            double rate = root.path("rates").path(quoteCurrencyCode.toUpperCase()).asDouble(0);
            if (rate <= 0) {
                return Optional.empty();
            }
            return Optional.of(new FxRateQuote(baseCurrencyCode.toUpperCase(), quoteCurrencyCode.toUpperCase(),
                    rate, "frankfurter"));
        } catch (IOException exception) {
            return Optional.empty();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return Optional.empty();
        }
    }
}
