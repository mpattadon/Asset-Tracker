package com.assettracker.model;

public record MutualFundSaleView(
        String id,
        String fundName,
        String saleDate,
        Double unitsSold,
        Double salePricePerUnit,
        Double proceeds,
        Double realizedGainLoss,
        Double fundDividends
) {
}
