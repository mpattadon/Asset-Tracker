package com.assettracker.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class StockEndpointsTests {

    @LocalServerPort
    private int port;

    private HttpClient httpClient;

    @BeforeEach
    void setUp() {
        httpClient = HttpClient.newHttpClient();
    }

    @Test
    void stockSeedEndpointReturnsUsMarketData() throws IOException, InterruptedException {
        HttpResponse<String> response = get("/api/assets/stocks?market=us");

        assertEquals(200, response.statusCode());
        assertTrue(response.body().contains("\"title\":\"US Stock\""));
        assertTrue(response.body().contains("\"lots\""));
    }

    @Test
    void stockSummaryEndpointReturnsUsSummary() throws IOException, InterruptedException {
        HttpResponse<String> response = get("/api/stocks/markets/us/summary");

        assertEquals(200, response.statusCode());
        assertTrue(response.body().contains("\"market\":\"us\""));
        assertTrue(response.body().contains("\"currency\":\"USD\""));
    }

    private HttpResponse<String> get(String path) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("X-User-Id", "user-123")
                .GET()
                .build();
        return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    }
}
