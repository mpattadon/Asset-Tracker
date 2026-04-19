package com.assettracker.controller;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "asset-tracker.app-host.share-port=0"
)
@ActiveProfiles("test")
class AppShareControllerTests {
    private static final Pattern SHARE_URL_PATTERN = Pattern.compile("\"shareUrl\":\"([^\"]+)\"");


    @LocalServerPort
    private int port;

    private final HttpClient httpClient = HttpClient.newHttpClient();

    @Test
    void shareHostCanBeStartedAndStopped() throws IOException, InterruptedException {
        HttpResponse<String> initialStatus = get("http://localhost:" + port + "/api/app/share/status");
        assertEquals(200, initialStatus.statusCode());
        assertTrue(initialStatus.body().contains("\"shareEnabled\":false"));

        HttpResponse<String> started = post("http://localhost:" + port + "/api/app/share/start");
        assertEquals(200, started.statusCode());
        assertTrue(started.body().contains("\"shareEnabled\":true"));

        HttpResponse<String> proxiedStatus = waitForProxy(extractShareUrl(started.body()) + "api/app/share/status");
        assertEquals(200, proxiedStatus.statusCode());
        assertTrue(proxiedStatus.body().contains("\"shareEnabled\":true"));

        HttpResponse<String> stopped = post("http://localhost:" + port + "/api/app/share/stop");
        assertEquals(200, stopped.statusCode());
        assertTrue(stopped.body().contains("\"shareEnabled\":false"));
    }

    private HttpResponse<String> get(String url) throws IOException, InterruptedException {
        return httpClient.send(
                HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(5)).GET().build(),
                HttpResponse.BodyHandlers.ofString()
        );
    }

    private HttpResponse<String> post(String url) throws IOException, InterruptedException {
        return httpClient.send(
                HttpRequest.newBuilder(URI.create(url))
                        .timeout(Duration.ofSeconds(5))
                        .POST(HttpRequest.BodyPublishers.noBody())
                        .build(),
                HttpResponse.BodyHandlers.ofString()
        );
    }

    private HttpResponse<String> waitForProxy(String url) throws IOException, InterruptedException {
        IOException lastIo = null;
        HttpResponse<String> lastResponse = null;
        for (int attempt = 0; attempt < 10; attempt++) {
            try {
                HttpResponse<String> response = get(url);
                if (response.statusCode() == 200) {
                    return response;
                }
                lastResponse = response;
            } catch (IOException exception) {
                lastIo = exception;
            }
            Thread.sleep(200);
        }
        if (lastResponse != null) {
            return lastResponse;
        }
        throw lastIo == null ? new IOException("Proxy did not become ready") : lastIo;
    }

    private String extractShareUrl(String responseBody) {
        Matcher matcher = SHARE_URL_PATTERN.matcher(responseBody);
        if (matcher.find()) {
            return matcher.group(1);
        }
        throw new IllegalStateException("Share URL missing from response body: " + responseBody);
    }
}
