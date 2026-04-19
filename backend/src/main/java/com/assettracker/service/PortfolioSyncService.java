package com.assettracker.service;

import org.springframework.stereotype.Service;

@Service
public class PortfolioSyncService {

    private final LegacyPortfolioImportService legacyPortfolioImportService;

    public PortfolioSyncService(LegacyPortfolioImportService legacyPortfolioImportService) {
        this.legacyPortfolioImportService = legacyPortfolioImportService;
    }

    public void ensureSynchronized(PortfolioMetadataRepository.UserRecord user) {
        legacyPortfolioImportService.importIfNeeded(user);
    }

    public SyncStatus syncStatus(PortfolioMetadataRepository.UserRecord user) {
        LegacyPortfolioImportService.ImportStatus status = legacyPortfolioImportService.currentStatus(user);
        return new SyncStatus(
                status.providerType(),
                status.providerFileId(),
                status.revision(),
                status.status(),
                status.lastPullAt(),
                status.lastPushAt(),
                status.lastError()
        );
    }

    public record SyncStatus(String providerType,
                             String providerFileId,
                             String revision,
                             String status,
                             java.time.Instant lastPullAt,
                             java.time.Instant lastPushAt,
                             String lastError) {
    }
}
