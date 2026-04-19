package com.assettracker.service;

import com.assettracker.config.AssetTrackerProperties;
import jakarta.annotation.PreDestroy;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Service
public class MarketDataSidecarManager {

    private final AssetTrackerProperties properties;
    private volatile Process process;

    public MarketDataSidecarManager(AssetTrackerProperties properties) {
        this.properties = properties;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void startIfConfigured() {
        if (!"sidecar".equalsIgnoreCase(properties.marketData().provider())
                || !properties.marketData().autostart()
                || isReachable()) {
            return;
        }

        Path script = Paths.get("python", "yfinance_sidecar.py");
        if (!Files.exists(script)) {
            return;
        }

        try {
            process = new ProcessBuilder(properties.marketData().pythonCommand(), script.toString())
                    .directory(Paths.get(".").toFile())
                    .redirectErrorStream(true)
                    .start();
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to start yfinance sidecar", exception);
        }
    }

    @PreDestroy
    public void stopIfRunning() {
        if (process != null) {
            process.destroy();
            process = null;
        }
    }

    private boolean isReachable() {
        try {
            HttpURLConnection connection = (HttpURLConnection) URI.create(
                    properties.marketData().sidecarBaseUrl() + "/internal/market/search?query=AAPL&market=US"
            ).toURL().openConnection();
            connection.setConnectTimeout(1000);
            connection.setReadTimeout(1000);
            connection.setRequestMethod("GET");
            int code = connection.getResponseCode();
            return code >= 200 && code < 500;
        } catch (IOException ignored) {
            return false;
        }
    }
}
