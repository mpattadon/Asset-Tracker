package com.assettracker.service;

import com.assettracker.model.AssetDataset;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.InputStream;
import java.util.Optional;

@Service
public class LegacyPortfolioSeedService {

    public static final String DEFAULT_USER = "user-123";

    private final ObjectMapper objectMapper;

    public LegacyPortfolioSeedService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public Optional<AssetDataset> loadIfPresent(String externalUserId) {
        try (InputStream directStream = openSeedStream(externalUserId)) {
            if (directStream != null) {
                return Optional.of(objectMapper.readValue(directStream, AssetDataset.class));
            }
        } catch (IOException ignored) {
            return Optional.empty();
        }
        return Optional.empty();
    }

    public AssetDataset loadDefault() {
        try (InputStream defaultStream = openSeedStream(DEFAULT_USER)) {
            if (defaultStream == null) {
                throw new IllegalStateException("Default legacy asset seed is missing");
            }
            return objectMapper.readValue(defaultStream, AssetDataset.class);
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to load legacy portfolio seed", exception);
        }
    }

    private InputStream openSeedStream(String externalUserId) throws IOException {
        if (externalUserId == null || externalUserId.isBlank()) {
            return null;
        }
        ClassPathResource resource = new ClassPathResource("data/" + externalUserId + ".json");
        return resource.exists() ? resource.getInputStream() : null;
    }
}
