package com.assettracker.service;

import com.assettracker.config.AssetTrackerProperties;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

import java.awt.Desktop;
import java.io.IOException;
import java.net.URI;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

@Service
public class LocalAppBrowserLauncher {

    private final AssetTrackerProperties properties;
    private final AppHostingService appHostingService;

    public LocalAppBrowserLauncher(AssetTrackerProperties properties, AppHostingService appHostingService) {
        this.properties = properties;
        this.appHostingService = appHostingService;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void openBrowserIfConfigured() {
        if (!properties.appHost().openBrowserOnReady() || !Desktop.isDesktopSupported()) {
            return;
        }

        Executors.newSingleThreadScheduledExecutor(runnable -> {
            Thread thread = new Thread(runnable, "local-app-browser-launcher");
            thread.setDaemon(true);
            return thread;
        }).schedule(this::openBrowser, 750, TimeUnit.MILLISECONDS);
    }

    private void openBrowser() {
        AppHostingService.ShareStatus status = appHostingService.status();
        if (!status.privateHostRunning() || status.privateUrl() == null) {
            return;
        }

        try {
            Desktop.getDesktop().browse(URI.create(status.privateUrl()));
        } catch (IOException ignored) {
        }
    }
}
