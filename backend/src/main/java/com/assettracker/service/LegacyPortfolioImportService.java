package com.assettracker.service;

import com.assettracker.config.AssetTrackerProperties;
import com.assettracker.model.AssetDataset;
import com.assettracker.model.document.CanonicalPortfolioDocument;
import com.assettracker.model.document.EncryptedPortfolioEnvelope;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

@Service
public class LegacyPortfolioImportService {

    private static final String SOURCE_TYPE = "LEGACY_BOOTSTRAP";

    private final AssetTrackerProperties properties;
    private final RuntimeStateRepository runtimeStateRepository;
    private final LegacyPortfolioSeedService legacyPortfolioSeedService;
    private final LegacyPortfolioDocumentFactory legacyPortfolioDocumentFactory;
    private final PortfolioProjectionService portfolioProjectionService;
    private final PortfolioMetadataRepository portfolioMetadataRepository;
    private final EnvelopeEncryptionService envelopeEncryptionService;

    public LegacyPortfolioImportService(AssetTrackerProperties properties,
                                        RuntimeStateRepository runtimeStateRepository,
                                        LegacyPortfolioSeedService legacyPortfolioSeedService,
                                        LegacyPortfolioDocumentFactory legacyPortfolioDocumentFactory,
                                        PortfolioProjectionService portfolioProjectionService,
                                        PortfolioMetadataRepository portfolioMetadataRepository,
                                        EnvelopeEncryptionService envelopeEncryptionService) {
        this.properties = properties;
        this.runtimeStateRepository = runtimeStateRepository;
        this.legacyPortfolioSeedService = legacyPortfolioSeedService;
        this.legacyPortfolioDocumentFactory = legacyPortfolioDocumentFactory;
        this.portfolioProjectionService = portfolioProjectionService;
        this.portfolioMetadataRepository = portfolioMetadataRepository;
        this.envelopeEncryptionService = envelopeEncryptionService;
    }

    public ImportStatus importIfNeeded(PortfolioMetadataRepository.UserRecord user) {
        if (runtimeStateRepository.hasProjectedData(user.id())) {
            return currentStatus(user);
        }

        Optional<CanonicalPortfolioDocument> legacyDocument = loadLegacyDocument(user);
        if (legacyDocument.isEmpty()) {
            return new ImportStatus("sqlite", null, null, "EMPTY", null, null, null);
        }

        try {
            portfolioProjectionService.rebuild(user, legacyDocument.get());
            runtimeStateRepository.recordImport(
                    user.id(),
                    SOURCE_TYPE,
                    user.externalUserId(),
                    "COMPLETED",
                    Instant.now(),
                    "Imported into SQLite from legacy source"
            );
            return currentStatus(user);
        } catch (RuntimeException exception) {
            runtimeStateRepository.recordImport(
                    user.id(),
                    SOURCE_TYPE,
                    user.externalUserId(),
                    "FAILED",
                    Instant.now(),
                    exception.getMessage()
            );
            throw exception;
        }
    }

    public ImportStatus currentStatus(PortfolioMetadataRepository.UserRecord user) {
        Optional<RuntimeStateRepository.ImportRecord> importRecord = runtimeStateRepository.findLatestImport(
                user.id(),
                SOURCE_TYPE,
                user.externalUserId()
        );
        if (runtimeStateRepository.hasProjectedData(user.id())) {
            return new ImportStatus(
                    "sqlite",
                    null,
                    null,
                    importRecord.map(record -> "COMPLETED".equalsIgnoreCase(record.status()) ? "IMPORTED" : "READY").orElse("READY"),
                    importRecord.map(RuntimeStateRepository.ImportRecord::importedAt).orElse(null),
                    null,
                    importRecord.map(RuntimeStateRepository.ImportRecord::notes).orElse(null)
            );
        }
        return new ImportStatus(
                "sqlite",
                null,
                null,
                importRecord.map(RuntimeStateRepository.ImportRecord::status).orElse("EMPTY"),
                importRecord.map(RuntimeStateRepository.ImportRecord::importedAt).orElse(null),
                null,
                importRecord.map(RuntimeStateRepository.ImportRecord::notes).orElse(null)
        );
    }

    private Optional<CanonicalPortfolioDocument> loadLegacyDocument(PortfolioMetadataRepository.UserRecord user) {
        Optional<CanonicalPortfolioDocument> encrypted = loadLegacyEncryptedDocument(user);
        if (encrypted.isPresent()) {
            return encrypted;
        }

        Optional<AssetDataset> seed = legacyPortfolioSeedService.loadIfPresent(user.externalUserId());
        if (seed.isPresent()) {
            return Optional.of(legacyPortfolioDocumentFactory.create(user, seed.get()));
        }

        if (LegacyPortfolioSeedService.DEFAULT_USER.equals(user.externalUserId())) {
            return Optional.of(legacyPortfolioDocumentFactory.create(user, legacyPortfolioSeedService.loadDefault()));
        }

        return Optional.empty();
    }

    private Optional<CanonicalPortfolioDocument> loadLegacyEncryptedDocument(PortfolioMetadataRepository.UserRecord user) {
        Path payloadPath = resolveLegacyPayload(user.externalUserId());
        if (!Files.exists(payloadPath)) {
            return Optional.empty();
        }

        PortfolioMetadataRepository.UserKeyRecord userKey = portfolioMetadataRepository.findUserKey(user.id())
                .orElse(null);
        if (userKey == null) {
            return Optional.empty();
        }

        try {
            String payload = Files.readString(payloadPath, StandardCharsets.UTF_8);
            EncryptedPortfolioEnvelope envelope = envelopeEncryptionService.deserializeEnvelope(payload);
            SecretKey dataKey = envelopeEncryptionService.unwrap(userKey.wrappedKey());
            return Optional.of(envelopeEncryptionService.decrypt(envelope, dataKey));
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to import legacy encrypted portfolio document", exception);
        }
    }

    private Path resolveLegacyPayload(String externalUserId) {
        return Paths.get(properties.legacy().portfolioRoot())
                .resolve(normalize(externalUserId))
                .resolve("portfolio.enc.json");
    }

    private String normalize(String externalUserId) {
        return externalUserId.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9_-]", "-");
    }

    public record ImportStatus(String providerType,
                               String providerFileId,
                               String revision,
                               String status,
                               Instant lastPullAt,
                               Instant lastPushAt,
                               String lastError) {
    }
}
