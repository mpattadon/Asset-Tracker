package com.assettracker.model;

public record Holding(
        String symbol,
        String name,
        String market,
        String type,
        double price,
        double quantity,
        double avgCost,
        double dayChangePct,
        String currency
) {
    public double marketValue() {
        return price * quantity;
    }
}
