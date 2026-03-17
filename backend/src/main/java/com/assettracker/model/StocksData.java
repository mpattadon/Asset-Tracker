package com.assettracker.model;

import java.util.List;

public record StocksData(StockMarketData thai, StockMarketData us) {
    public record StockMarketData(
            String title,
            String currency,
            double value,
            double dayChange,
            double dayChangePct,
            double totalChange,
            double totalChangePct,
            List<StockSlice> breakdown,
            StockPerformance performance,
            List<Double> series,
            List<Candlestick> candlesticks,
            List<Holding> holdings,
            List<StockLot> lots
    ) {
    }

    public record StockSlice(String label, int value, String color) {
    }

    public record StockPerformance(String change, List<Double> series) {
    }

    public record Candlestick(String time, double open, double high, double low, double close) {
    }
}
