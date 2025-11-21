package com.assettracker.model;

import java.util.List;

public record StockSummary(
        String market,
        double totalValue,
        double dayChange,
        double dayChangePct,
        double totalChange,
        double totalChangePct,
        List<Double> series
) {
}
