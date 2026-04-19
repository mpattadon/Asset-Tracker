package com.assettracker.service;

import com.assettracker.config.AssetTrackerProperties;
import com.assettracker.model.document.CanonicalPortfolioDocument;
import com.assettracker.model.document.EncryptedPortfolioEnvelope;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

@Service
public class EnvelopeEncryptionService {

    private static final String DOCUMENT_ALGORITHM = "AES/GCM/NoPadding";
    private static final int GCM_TAG_BITS = 128;
    private static final int NONCE_BYTES = 12;

    private final ObjectMapper objectMapper;
    private final SecretKey masterKey;
    private final SecureRandom secureRandom = new SecureRandom();

    public EnvelopeEncryptionService(ObjectMapper objectMapper, AssetTrackerProperties properties) {
        this.objectMapper = objectMapper;
        byte[] masterKeyBytes = Base64.getDecoder().decode(properties.encryption().masterKey());
        this.masterKey = new SecretKeySpec(masterKeyBytes, "AES");
    }

    public WrappedKey generateWrappedKey() {
        try {
            KeyGenerator keyGenerator = KeyGenerator.getInstance("AES");
            keyGenerator.init(256);
            SecretKey dataKey = keyGenerator.generateKey();
            return wrap(dataKey, 1);
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to generate wrapped key", exception);
        }
    }

    public WrappedKey wrap(SecretKey dataKey, int keyVersion) {
        byte[] nonce = randomBytes(NONCE_BYTES);
        byte[] encrypted = encrypt(masterKey, nonce, dataKey.getEncoded());
        return new WrappedKey(keyVersion, encodeWrappedKey(nonce, encrypted), "AES256_GCM_WRAP");
    }

    public SecretKey unwrap(String wrappedKey) {
        byte[] nonce = decodeWrappedKeyNonce(wrappedKey);
        byte[] encrypted = decodeWrappedKeyCiphertext(wrappedKey);
        byte[] decrypted = decrypt(masterKey, nonce, encrypted);
        return new SecretKeySpec(decrypted, "AES");
    }

    public EncryptedPortfolioEnvelope encrypt(CanonicalPortfolioDocument document, SecretKey dataKey, int keyVersion) {
        try {
            byte[] plaintext = objectMapper.writeValueAsBytes(document);
            byte[] nonce = randomBytes(NONCE_BYTES);
            byte[] encrypted = encrypt(dataKey, nonce, plaintext);
            int tagLength = 16;
            int ciphertextLength = encrypted.length - tagLength;
            byte[] ciphertext = new byte[ciphertextLength];
            byte[] authTag = new byte[tagLength];
            System.arraycopy(encrypted, 0, ciphertext, 0, ciphertextLength);
            System.arraycopy(encrypted, ciphertextLength, authTag, 0, tagLength);
            return new EncryptedPortfolioEnvelope(
                    document.schemaVersion(),
                    document.revisionId(),
                    "AES-256-GCM",
                    keyVersion,
                    Base64.getEncoder().encodeToString(nonce),
                    Base64.getEncoder().encodeToString(ciphertext),
                    Base64.getEncoder().encodeToString(authTag),
                    sha256(plaintext)
            );
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to encrypt portfolio document", exception);
        }
    }

    public CanonicalPortfolioDocument decrypt(EncryptedPortfolioEnvelope envelope, SecretKey dataKey) {
        try {
            byte[] nonce = Base64.getDecoder().decode(envelope.nonce());
            byte[] ciphertext = Base64.getDecoder().decode(envelope.ciphertext());
            byte[] authTag = Base64.getDecoder().decode(envelope.authTag());
            byte[] combined = new byte[ciphertext.length + authTag.length];
            System.arraycopy(ciphertext, 0, combined, 0, ciphertext.length);
            System.arraycopy(authTag, 0, combined, ciphertext.length, authTag.length);
            byte[] plaintext = decrypt(dataKey, nonce, combined);
            return objectMapper.readValue(plaintext, CanonicalPortfolioDocument.class);
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to decrypt portfolio document", exception);
        }
    }

    public String serializeEnvelope(EncryptedPortfolioEnvelope envelope) {
        try {
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(envelope);
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to serialize encrypted portfolio envelope", exception);
        }
    }

    public EncryptedPortfolioEnvelope deserializeEnvelope(String payload) {
        try {
            return objectMapper.readValue(payload, EncryptedPortfolioEnvelope.class);
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to parse encrypted portfolio envelope", exception);
        }
    }

    public String sha256(byte[] payload) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(payload);
            StringBuilder builder = new StringBuilder(hash.length * 2);
            for (byte item : hash) {
                builder.append(String.format("%02x", item));
            }
            return builder.toString();
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to calculate SHA-256", exception);
        }
    }

    public String encryptSecret(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        byte[] nonce = randomBytes(NONCE_BYTES);
        byte[] encrypted = encrypt(masterKey, nonce, value.getBytes(StandardCharsets.UTF_8));
        return Base64.getEncoder().encodeToString(nonce) + ":" + Base64.getEncoder().encodeToString(encrypted);
    }

    public String decryptSecret(String encryptedValue) {
        if (encryptedValue == null || encryptedValue.isBlank()) {
            return null;
        }
        String[] parts = encryptedValue.split(":", 2);
        if (parts.length != 2) {
            throw new IllegalStateException("Invalid encrypted secret payload");
        }
        byte[] nonce = Base64.getDecoder().decode(parts[0]);
        byte[] encrypted = Base64.getDecoder().decode(parts[1]);
        return new String(decrypt(masterKey, nonce, encrypted), StandardCharsets.UTF_8);
    }

    private byte[] encrypt(SecretKey key, byte[] nonce, byte[] plaintext) {
        try {
            Cipher cipher = Cipher.getInstance(DOCUMENT_ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, nonce));
            return cipher.doFinal(plaintext);
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to encrypt payload", exception);
        }
    }

    private byte[] decrypt(SecretKey key, byte[] nonce, byte[] ciphertext) {
        try {
            Cipher cipher = Cipher.getInstance(DOCUMENT_ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, nonce));
            return cipher.doFinal(ciphertext);
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to decrypt payload", exception);
        }
    }

    private byte[] randomBytes(int length) {
        byte[] bytes = new byte[length];
        secureRandom.nextBytes(bytes);
        return bytes;
    }

    private String encodeWrappedKey(byte[] nonce, byte[] encrypted) {
        return Base64.getEncoder().encodeToString(nonce) + ":" + Base64.getEncoder().encodeToString(encrypted);
    }

    private byte[] decodeWrappedKeyNonce(String wrappedKey) {
        return Base64.getDecoder().decode(wrappedKey.split(":", 2)[0]);
    }

    private byte[] decodeWrappedKeyCiphertext(String wrappedKey) {
        return Base64.getDecoder().decode(wrappedKey.split(":", 2)[1]);
    }

    public record WrappedKey(int keyVersion, String wrappedKey, String wrappingAlgorithm) {
    }
}
