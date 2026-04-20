package com.assettracker.model;

public record ExchangeRateResponse(
        String baseCurrency,
        String quoteCurrency,
        double rate,
        double inverseRate
) {
}
