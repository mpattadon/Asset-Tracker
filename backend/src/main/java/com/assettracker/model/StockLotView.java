package com.assettracker.model;

public record StockLotView(
        String id,
        String purchaseDate,
        double purchasePrice,
        double quantity,
        double currentPrice,
        double dayGain,
        double dayChangePct,
        double value
) {
}
