package com.assettracker.model;

public record AddHoldingRequest(
        String symbol,
        String name,
        String market,
        String type,
        String currency,
        double price,
        double quantity
) {
}
