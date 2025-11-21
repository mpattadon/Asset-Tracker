package com.assettracker.model;

public record QuoteResult(
        String symbol,
        String name,
        String market,
        String type,
        String currency,
        double price,
        double dayChangePct
) {
}
