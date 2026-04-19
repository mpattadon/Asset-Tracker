package com.assettracker.service;

import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Primary
@Service
public class CompositeFxRateProvider implements FxRateProvider {

    private final FrankfurterFxRateProvider frankfurterFxRateProvider;
    private final StubFxRateProvider stubFxRateProvider;

    public CompositeFxRateProvider(FrankfurterFxRateProvider frankfurterFxRateProvider,
                                   StubFxRateProvider stubFxRateProvider) {
        this.frankfurterFxRateProvider = frankfurterFxRateProvider;
        this.stubFxRateProvider = stubFxRateProvider;
    }

    @Override
    public Optional<FxRateQuote> latestRate(String baseCurrencyCode, String quoteCurrencyCode) {
        Optional<FxRateQuote> liveQuote = frankfurterFxRateProvider.latestRate(baseCurrencyCode, quoteCurrencyCode);
        return liveQuote.isPresent() ? liveQuote : stubFxRateProvider.latestRate(baseCurrencyCode, quoteCurrencyCode);
    }
}
