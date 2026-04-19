package com.assettracker.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;

import java.io.IOException;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class AuthControllerTests {

    @LocalServerPort
    private int port;

    private HttpClient httpClient;

    @BeforeEach
    void setUp() {
        CookieManager cookieManager = new CookieManager();
        cookieManager.setCookiePolicy(CookiePolicy.ACCEPT_ALL);
        httpClient = HttpClient.newBuilder()
                .cookieHandler(cookieManager)
                .build();
    }

    @Test
    void localBootstrapRegisterLoginAndLogoutFlowWorks() throws IOException, InterruptedException {
        HttpResponse<String> bootstrap = get("/api/auth/bootstrap");
        assertEquals(200, bootstrap.statusCode());
        assertTrue(bootstrap.body().contains("\"setupRequired\":true"));
        assertTrue(bootstrap.body().contains("\"authenticated\":false"));

        HttpResponse<String> register = post(
                "/api/auth/register/local",
                """
                {
                  "username": "alex",
                  "password": "password123",
                  "email": "alex@example.com"
                }
                """
        );
        assertEquals(200, register.statusCode());
        assertTrue(register.body().contains("\"setupRequired\":false"));
        assertTrue(register.body().contains("\"authenticated\":true"));
        assertTrue(register.body().contains("\"authProvider\":\"local\""));

        HttpResponse<String> authenticatedBootstrap = get("/api/auth/bootstrap");
        assertEquals(200, authenticatedBootstrap.statusCode());
        assertTrue(authenticatedBootstrap.body().contains("\"authenticated\":true"));

        HttpResponse<String> logout = post("/api/auth/logout", "");
        assertEquals(200, logout.statusCode());
        assertTrue(logout.body().contains("\"authenticated\":false"));

        HttpResponse<String> login = post(
                "/api/auth/login/local",
                """
                {
                  "username": "alex",
                  "password": "password123"
                }
                """
        );
        assertEquals(200, login.statusCode());
        assertTrue(login.body().contains("\"authenticated\":true"));
        assertTrue(login.body().contains("\"setupRequired\":false"));
    }

    private HttpResponse<String> get(String path) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .GET()
                .build();
        return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> post(String path, String body) throws IOException, InterruptedException {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .POST(HttpRequest.BodyPublishers.ofString(body));
        if (!body.isBlank()) {
            builder.header("Content-Type", MediaType.APPLICATION_JSON_VALUE);
        }
        return httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }
}
