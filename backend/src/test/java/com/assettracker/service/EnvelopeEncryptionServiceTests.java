package com.assettracker.service;

import com.assettracker.config.AssetTrackerProperties;
import com.assettracker.model.document.CanonicalPortfolioDocument;
import com.assettracker.model.document.EncryptedPortfolioEnvelope;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;

class EnvelopeEncryptionServiceTests {

    private final EnvelopeEncryptionService service =
            new EnvelopeEncryptionService(new ObjectMapper(), testProperties());

    @Test
    void encryptDecryptRoundTripPreservesDocument() {
        CanonicalPortfolioDocument document = sampleDocument();
        EnvelopeEncryptionService.WrappedKey wrappedKey = service.generateWrappedKey();

        EncryptedPortfolioEnvelope envelope = service.encrypt(document, service.unwrap(wrappedKey.wrappedKey()), wrappedKey.keyVersion());
        CanonicalPortfolioDocument restored = service.decrypt(envelope, service.unwrap(wrappedKey.wrappedKey()));

        assertEquals(document, restored);
        assertNotEquals(envelope.ciphertext(), new String(new ObjectMapper().valueToTree(document).toString()));
    }

    @Test
    void tamperedAuthTagFailsToDecrypt() {
        CanonicalPortfolioDocument document = sampleDocument();
        EnvelopeEncryptionService.WrappedKey wrappedKey = service.generateWrappedKey();
        EncryptedPortfolioEnvelope envelope = service.encrypt(document, service.unwrap(wrappedKey.wrappedKey()), wrappedKey.keyVersion());

        EncryptedPortfolioEnvelope tampered = new EncryptedPortfolioEnvelope(
                envelope.schemaVersion(),
                envelope.revisionId(),
                envelope.encryptionAlgorithm(),
                envelope.keyVersion(),
                envelope.nonce(),
                envelope.ciphertext(),
                envelope.authTag().substring(0, envelope.authTag().length() - 2) + "aa",
                envelope.checksumSha256()
        );

        assertThrows(IllegalStateException.class,
                () -> service.decrypt(tampered, service.unwrap(wrappedKey.wrappedKey())));
    }

    private CanonicalPortfolioDocument sampleDocument() {
        return new CanonicalPortfolioDocument(
                1,
                "rev-1",
                new CanonicalPortfolioDocument.DocumentUser("user-123", "user@example.com", "User Example", "local"),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                new CanonicalPortfolioDocument.DerivedSections(List.of(), List.of(), List.of(), List.of())
        );
    }

    private AssetTrackerProperties testProperties() {
        return new AssetTrackerProperties(
                new AssetTrackerProperties.Auth(
                        "http://localhost:5173",
                        "http://localhost:5173/login",
                        false
                ),
                new AssetTrackerProperties.Encryption("MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="),
                new AssetTrackerProperties.Sync(true),
                new AssetTrackerProperties.Fx("stub", "https://example.test"),
                new AssetTrackerProperties.MarketData("stub", "http://127.0.0.1:9001", 10, false, "python"),
                new AssetTrackerProperties.Legacy("./target/test-docs"),
                new AssetTrackerProperties.AppHost(false, 4173, 4273, "../frontend/dist", false)
        );
    }
}
