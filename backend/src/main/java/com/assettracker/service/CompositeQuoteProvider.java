package com.assettracker.service;

import com.assettracker.model.QuoteResult;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Primary
@Component
public class CompositeQuoteProvider implements QuoteProvider, MarketDataProvider {

    private final YfinanceSidecarMarketDataProvider yfinanceSidecarMarketDataProvider;
    private final ObjectProvider<StubQuoteProvider> stubQuoteProvider;

    public CompositeQuoteProvider(YfinanceSidecarMarketDataProvider yfinanceSidecarMarketDataProvider,
                                  ObjectProvider<StubQuoteProvider> stubQuoteProvider) {
        this.yfinanceSidecarMarketDataProvider = yfinanceSidecarMarketDataProvider;
        this.stubQuoteProvider = stubQuoteProvider;
    }

    @Override
    public Optional<QuoteResult> lookup(PortfolioMetadataRepository.UserRecord user, String symbol, String market) {
        Optional<QuoteResult> sidecarQuote = yfinanceSidecarMarketDataProvider.lookup(user, symbol, market);
        if (sidecarQuote.isPresent()) {
            return sidecarQuote;
        }
        StubQuoteProvider stubProvider = stubQuoteProvider.getIfAvailable();
        if (stubProvider == null) {
            return Optional.empty();
        }
        return stubProvider.lookup(user, symbol, market);
    }

    @Override
    public List<QuoteResult> search(PortfolioMetadataRepository.UserRecord user,
                                    String query,
                                    String market,
                                    List<String> types) {
        List<QuoteResult> sidecarResults = yfinanceSidecarMarketDataProvider.search(user, query, market, types);
        if (!sidecarResults.isEmpty()) {
            return sidecarResults;
        }
        StubQuoteProvider stubProvider = stubQuoteProvider.getIfAvailable();
        if (stubProvider == null) {
            return List.of();
        }
        return stubProvider.search(user, query, market, types);
    }

    @Override
    public Optional<InspectionResult> inspect(PortfolioMetadataRepository.UserRecord user,
                                              String symbol,
                                              String market,
                                              String period,
                                              String interval) {
        Optional<InspectionResult> sidecarInspection = yfinanceSidecarMarketDataProvider.inspect(
                user,
                symbol,
                market,
                period,
                interval
        );
        if (sidecarInspection.isPresent()) {
            return sidecarInspection;
        }
        StubQuoteProvider stubProvider = stubQuoteProvider.getIfAvailable();
        if (stubProvider == null) {
            return Optional.empty();
        }
        return stubProvider.inspect(user, symbol, market, period, interval);
    }

    @Override
    public List<HistoricalBar> history(PortfolioMetadataRepository.UserRecord user,
                                       String symbol,
                                       String market,
                                       String period,
                                       String interval) {
        List<HistoricalBar> sidecarBars = yfinanceSidecarMarketDataProvider.history(user, symbol, market, period, interval);
        if (!sidecarBars.isEmpty()) {
            return sidecarBars;
        }
        StubQuoteProvider stubProvider = stubQuoteProvider.getIfAvailable();
        if (stubProvider == null) {
            return List.of();
        }
        return stubProvider.history(user, symbol, market, period, interval);
    }

    @Override
    public Optional<Double> fxRate(String baseCurrency, String quoteCurrency) {
        Optional<Double> sidecarRate = yfinanceSidecarMarketDataProvider.fxRate(baseCurrency, quoteCurrency);
        if (sidecarRate.isPresent()) {
            return sidecarRate;
        }
        StubQuoteProvider stubProvider = stubQuoteProvider.getIfAvailable();
        if (stubProvider == null) {
            return Optional.empty();
        }
        return stubProvider.fxRate(baseCurrency, quoteCurrency);
    }
}
