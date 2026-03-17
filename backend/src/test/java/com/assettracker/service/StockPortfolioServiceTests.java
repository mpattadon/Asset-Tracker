package com.assettracker.service;

import com.assettracker.model.AddHoldingRequest;
import com.assettracker.model.AssetDataset;
import com.assettracker.model.BanksData;
import com.assettracker.model.QuoteResult;
import com.assettracker.model.StockLot;
import com.assettracker.model.StockPositionView;
import com.assettracker.model.StockSummary;
import com.assettracker.model.StocksData;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class StockPortfolioServiceTests {

    @Test
    void groupsLotsByTicker() {
        InMemoryAssetStore assetStore = new InMemoryAssetStore(seedDataset());
        StockPortfolioService service = new StockPortfolioService(new TestQuoteProvider(), assetStore);

        List<StockPositionView> holdings = service.getHoldings("user-123", "us", false);

        assertEquals(2, holdings.size());
        StockPositionView apple = holdings.stream()
                .filter(position -> position.symbol().equals("AAPL"))
                .findFirst()
                .orElseThrow();
        assertEquals(15.0, apple.quantity());
        assertEquals(2, apple.lots().size());
        assertEquals(3000.0, apple.value(), 0.001);
    }

    @Test
    void addHoldingPersistsAndUpdatesSummary() {
        InMemoryAssetStore assetStore = new InMemoryAssetStore(seedDataset());
        StockPortfolioService service = new StockPortfolioService(new TestQuoteProvider(), assetStore);

        service.addHolding("user-123", "us", new AddHoldingRequest(
                "AAPL",
                "Apple Inc.",
                "us",
                "Stock",
                "USD",
                java.time.LocalDate.of(2026, 3, 1),
                150.0,
                2.0
        ));

        List<StockPositionView> holdings = service.getHoldings("user-123", "us", false);
        StockPositionView apple = holdings.stream()
                .filter(position -> position.symbol().equals("AAPL"))
                .findFirst()
                .orElseThrow();
        assertEquals(17.0, apple.quantity());
        assertEquals(3, apple.lots().size());

        StockSummary summary = service.summary("user-123", "us");
        assertTrue(summary.totalValue() > 0);
        assertEquals("US Stock", summary.title());
    }

    private AssetDataset seedDataset() {
        StocksData.StockMarketData thai = new StocksData.StockMarketData(
                "Thai Stock",
                "THB",
                0,
                0,
                0,
                0,
                0,
                List.of(),
                new StocksData.StockPerformance("Flat", List.of()),
                List.of(),
                List.of(),
                List.of(),
                List.of()
        );

        StocksData.StockMarketData us = new StocksData.StockMarketData(
                "US Stock",
                "USD",
                0,
                0,
                0,
                0,
                0,
                List.of(),
                new StocksData.StockPerformance("Flat", List.of()),
                List.of(100.0, 110.0),
                List.of(),
                List.of(),
                List.of(
                        new StockLot("lot-aapl-1", "AAPL", "Apple Inc.", "us", "Stock", "USD", "2025-01-01", 150.0, 10.0),
                        new StockLot("lot-aapl-2", "AAPL", "Apple Inc.", "us", "Stock", "USD", "2025-02-01", 160.0, 5.0),
                        new StockLot("lot-msft-1", "MSFT", "Microsoft Corp.", "us", "Stock", "USD", "2025-03-01", 95.0, 4.0)
                )
        );

        return new AssetDataset(
                new StocksData(thai, us),
                List.of(),
                List.of(),
                List.of(),
                new BanksData(
                        new BanksData.BankRegionData("THB 0", List.of(), List.of()),
                        new BanksData.BankRegionData("£0", List.of(), List.of())
                ),
                List.of(),
                null
        );
    }

    private static class InMemoryAssetStore implements UserAssetStore {
        private AssetDataset dataset;

        private InMemoryAssetStore(AssetDataset dataset) {
            this.dataset = dataset;
        }

        @Override
        public AssetDataset load(String userId) {
            return dataset;
        }

        @Override
        public void save(String userId, AssetDataset dataset) {
            this.dataset = dataset;
        }
    }

    private static class TestQuoteProvider implements QuoteProvider {

        @Override
        public Optional<QuoteResult> lookup(String symbol, String market) {
            return switch (symbol) {
                case "AAPL" -> Optional.of(new QuoteResult("AAPL", "Apple Inc.", "US", "Stock", "USD", 200.0, 1.0));
                case "MSFT" -> Optional.of(new QuoteResult("MSFT", "Microsoft Corp.", "US", "Stock", "USD", 100.0, -2.0));
                default -> Optional.empty();
            };
        }

        @Override
        public List<QuoteResult> search(String query, String market, List<String> types) {
            return List.of();
        }
    }
}
