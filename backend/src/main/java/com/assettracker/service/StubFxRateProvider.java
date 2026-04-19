package com.assettracker.service;

import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;

@Service
public class StubFxRateProvider implements FxRateProvider {

    private final Map<String, Double> rates = Map.of(
            "USD:THB", 35.00,
            "GBP:THB", 44.50,
            "USD:GBP", 0.78,
            "THB:USD", 1 / 35.00,
            "THB:GBP", 1 / 44.50
    );

    @Override
    public Optional<FxRateQuote> latestRate(String baseCurrencyCode, String quoteCurrencyCode) {
        if (baseCurrencyCode == null || quoteCurrencyCode == null) {
            return Optional.empty();
        }
        if (baseCurrencyCode.equalsIgnoreCase(quoteCurrencyCode)) {
            return Optional.of(new FxRateQuote(baseCurrencyCode, quoteCurrencyCode, 1, "identity"));
        }
        Double rate = rates.get(baseCurrencyCode.toUpperCase() + ":" + quoteCurrencyCode.toUpperCase());
        return rate == null
                ? Optional.empty()
                : Optional.of(new FxRateQuote(baseCurrencyCode.toUpperCase(), quoteCurrencyCode.toUpperCase(),
                rate, "stub"));
    }
}
