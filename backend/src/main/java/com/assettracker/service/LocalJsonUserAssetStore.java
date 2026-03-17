package com.assettracker.service;

import com.assettracker.model.AssetDataset;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Service
public class LocalJsonUserAssetStore implements UserAssetStore {

    private static final String DEFAULT_USER = "user-123";

    private final ObjectMapper objectMapper;
    private final Path storageRoot;

    public LocalJsonUserAssetStore(ObjectMapper objectMapper,
                                   @Value("${asset-tracker.storage.root:data}") String storageRoot) {
        this.objectMapper = objectMapper;
        this.storageRoot = Paths.get(storageRoot);
    }

    @Override
    public AssetDataset load(String userId) {
        String resolvedUserId = normalizeUserId(userId);
        Path file = pathForUser(resolvedUserId);
        ensureSeedFile(file, resolvedUserId);
        try {
            return objectMapper.readValue(file.toFile(), AssetDataset.class);
        } catch (RuntimeException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Unable to read asset data for user: " + resolvedUserId, exception);
        }
    }

    @Override
    public void save(String userId, AssetDataset dataset) {
        String resolvedUserId = normalizeUserId(userId);
        Path file = pathForUser(resolvedUserId);
        try {
            Files.createDirectories(file.getParent());
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(file.toFile(), dataset);
        } catch (IOException | RuntimeException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Unable to save asset data for user: " + resolvedUserId, exception);
        }
    }

    private Path pathForUser(String userId) {
        return storageRoot.resolve(userId + ".json");
    }

    private String normalizeUserId(String userId) {
        if (userId == null || userId.isBlank()) {
            return DEFAULT_USER;
        }
        return userId.replaceAll("[^a-zA-Z0-9_-]", "-");
    }

    private void ensureSeedFile(Path file, String userId) {
        if (Files.exists(file)) {
            return;
        }
        try {
            Files.createDirectories(file.getParent());
            AssetDataset seedDataset = loadSeedDataset(userId);
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(file.toFile(), seedDataset);
        } catch (IOException | RuntimeException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Unable to initialize asset data for user: " + userId, exception);
        }
    }

    private AssetDataset loadSeedDataset(String userId) throws IOException {
        try (InputStream directStream = openSeedStream(userId)) {
            if (directStream != null) {
                return objectMapper.readValue(directStream, AssetDataset.class);
            }
        }

        try (InputStream defaultStream = openSeedStream(DEFAULT_USER)) {
            if (defaultStream == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Default asset data seed is missing");
            }
            return objectMapper.readValue(defaultStream, AssetDataset.class);
        }
    }

    private InputStream openSeedStream(String userId) throws IOException {
        ClassPathResource resource = new ClassPathResource("data/" + userId + ".json");
        return resource.exists() ? resource.getInputStream() : null;
    }
}
