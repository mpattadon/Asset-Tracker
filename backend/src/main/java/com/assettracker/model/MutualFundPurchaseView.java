package com.assettracker.model;

public record MutualFundPurchaseView(
        String id,
        String purchaseDate,
        Double averageCostPerUnit,
        Double unitsPurchased,
        Double totalCost,
        Integer riskLevel
) {
}
