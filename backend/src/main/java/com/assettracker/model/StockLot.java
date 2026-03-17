package com.assettracker.model;

public record StockLot(
        String id,
        String symbol,
        String name,
        String market,
        String type,
        String currency,
        String purchaseDate,
        double purchasePrice,
        double quantity
) {
}
