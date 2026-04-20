package com.assettracker.model;

public record StockPortfolioView(
        String id,
        String name,
        String market,
        String currency
) {
}
