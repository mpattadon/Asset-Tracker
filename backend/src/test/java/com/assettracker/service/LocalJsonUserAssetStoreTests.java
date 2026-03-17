package com.assettracker.service;

import com.assettracker.model.AssetDataset;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest
class LocalJsonUserAssetStoreTests {

    @Autowired
    private UserAssetStore userAssetStore;

    @Test
    void loadsSeedDatasetForDefaultUser() {
        AssetDataset dataset = userAssetStore.load("user-123");

        assertNotNull(dataset);
        assertNotNull(dataset.stocks());
        assertEquals(3, dataset.stocks().us().lots().size());
    }
}
