package com.assettracker.model;

import java.util.List;

public record StocksData(StockMarketData thai, StockMarketData us) {
    public record StockMarketData(List<StockSlice> breakdown, StockPerformance performance) {
    }

    public record StockSlice(String label, int value, String color) {
    }

    public record StockPerformance(String change, List<Integer> series) {
    }
}
