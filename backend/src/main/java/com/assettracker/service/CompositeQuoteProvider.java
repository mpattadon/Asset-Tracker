package com.assettracker.service;

import com.assettracker.model.QuoteResult;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Primary
@Component
public class CompositeQuoteProvider implements QuoteProvider, MarketDataProvider {

    private final YfinanceSidecarMarketDataProvider yfinanceSidecarMarketDataProvider;
    private final StubQuoteProvider stubQuoteProvider;

    public CompositeQuoteProvider(YfinanceSidecarMarketDataProvider yfinanceSidecarMarketDataProvider,
                                  StubQuoteProvider stubQuoteProvider) {
        this.yfinanceSidecarMarketDataProvider = yfinanceSidecarMarketDataProvider;
        this.stubQuoteProvider = stubQuoteProvider;
    }

    @Override
    public Optional<QuoteResult> lookup(PortfolioMetadataRepository.UserRecord user, String symbol, String market) {
        Optional<QuoteResult> sidecarQuote = yfinanceSidecarMarketDataProvider.lookup(user, symbol, market);
        if (sidecarQuote.isPresent()) {
            return sidecarQuote;
        }
        return stubQuoteProvider.lookup(user, symbol, market);
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
        return stubQuoteProvider.search(user, query, market, types);
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
        return stubQuoteProvider.inspect(user, symbol, market, period, interval);
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
        return stubQuoteProvider.history(user, symbol, market, period, interval);
    }
}
