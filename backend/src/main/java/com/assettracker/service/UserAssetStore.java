package com.assettracker.service;

import com.assettracker.model.AssetDataset;

public interface UserAssetStore {
    AssetDataset load(String userId);

    void save(String userId, AssetDataset dataset);
}
