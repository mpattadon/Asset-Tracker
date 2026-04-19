package com.assettracker.model.document;

public record EncryptedPortfolioEnvelope(
        int schemaVersion,
        String revisionId,
        String encryptionAlgorithm,
        int keyVersion,
        String nonce,
        String ciphertext,
        String authTag,
        String checksumSha256
) {
}

