package com.assettracker.service;

import java.util.Optional;

public interface FxRateProvider {
    Optional<FxRateQuote> latestRate(String baseCurrencyCode, String quoteCurrencyCode);

    record FxRateQuote(String baseCurrencyCode, String quoteCurrencyCode, double rate, String sourceName) {
    }
}
