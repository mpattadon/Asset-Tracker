package com.assettracker.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "asset-tracker")
public record AssetTrackerProperties(
        Auth auth,
        Encryption encryption,
        Sync sync,
        Fx fx,
        MarketData marketData,
        Legacy legacy,
        AppHost appHost
) {

    public record Auth(
            String successRedirect,
            String failureRedirect,
            boolean allowDevHeaderUser
    ) {
    }

    public record Encryption(
            String masterKey
    ) {
    }

    public record Sync(
            boolean autoSyncOnRead
    ) {
    }

    public record Fx(
            String provider,
            String baseUrl
    ) {
    }

    public record MarketData(
            String provider,
            String sidecarBaseUrl,
            int timeoutSeconds,
            boolean autostart,
            String pythonCommand
    ) {
    }

    public record Legacy(
            String portfolioRoot
    ) {
    }

    public record AppHost(
            boolean privateEnabled,
            int privatePort,
            int sharePort,
            String frontendDist,
            boolean openBrowserOnReady
    ) {
    }
}
