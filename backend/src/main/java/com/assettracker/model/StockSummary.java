package com.assettracker.model;

import java.util.List;

public record StockSummary(
        String market,
        String title,
        String currency,
        double totalValue,
        double dayChange,
        double dayChangePct,
        double totalChange,
        double totalChangePct,
        List<Double> series,
        List<StocksData.Candlestick> candlesticks
) {
}
