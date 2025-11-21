package com.assettracker.service;

import com.assettracker.model.AssetDataset;
import com.assettracker.model.BanksData;
import com.assettracker.model.BondHolding;
import com.assettracker.model.ExpensesData;
import com.assettracker.model.FundHolding;
import com.assettracker.model.GoldPosition;
import com.assettracker.model.LotteryEntry;
import com.assettracker.model.StocksData;
import com.assettracker.model.SummaryData;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AssetDataService {

    private final ObjectMapper objectMapper;
    private final Map<String, AssetDataset> cache = new ConcurrentHashMap<>();
    private static final String DEFAULT_USER = "user-123";

    public AssetDataService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public SummaryData getSummary(String userId) {
        return getDataset(userId).summary();
    }

    public StocksData.StockMarketData getStocks(String userId, String market) {
        StocksData stocks = getDataset(userId).stocks();
        if ("us".equalsIgnoreCase(market)) {
            return stocks.us();
        }
        return stocks.thai();
    }

    public List<BondHolding> getBonds(String userId) {
        return getDataset(userId).bonds();
    }

    public List<GoldPosition> getGold(String userId) {
        return getDataset(userId).gold();
    }

    public List<FundHolding> getFunds(String userId) {
        return getDataset(userId).funds();
    }

    public BanksData.BankRegionData getBanks(String userId, String region) {
        BanksData banks = getDataset(userId).banks();
        if ("uk".equalsIgnoreCase(region)) {
            return banks.uk();
        }
        return banks.thai();
    }

    public List<LotteryEntry> getLottery(String userId) {
        return getDataset(userId).lottery();
    }

    public ExpensesData getExpenses(String userId) {
        return getDataset(userId).expenses();
    }

    private AssetDataset getDataset(String userId) {
        String id = (userId == null || userId.isBlank()) ? DEFAULT_USER : userId;
        return cache.computeIfAbsent(id, this::loadFromResource);
    }

    private AssetDataset loadFromResource(String userId) {
        String path = "data/" + userId + ".json";
        try (InputStream is = new ClassPathResource(path).getInputStream()) {
            return objectMapper.readValue(is, AssetDataset.class);
        } catch (IOException notFound) {
            if (!DEFAULT_USER.equals(userId)) {
                return loadFromResource(DEFAULT_USER);
            }
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Asset data not found for user: " + userId);
        }
    }
}
