package com.assettracker.service;

import com.assettracker.model.QuoteResult;

import java.util.List;
import java.util.Optional;

public interface MarketDataProvider {

    Optional<QuoteResult> lookup(PortfolioMetadataRepository.UserRecord user, String symbol, String market);

    List<QuoteResult> search(PortfolioMetadataRepository.UserRecord user, String query, String market, List<String> types);

    Optional<InspectionResult> inspect(PortfolioMetadataRepository.UserRecord user,
                                       String symbol,
                                       String market,
                                       String period,
                                       String interval);

    List<HistoricalBar> history(PortfolioMetadataRepository.UserRecord user, String symbol, String market, String period, String interval);

    record InspectionResult(String requestedSymbol,
                            String normalizedSymbol,
                            String market,
                            String name,
                            String type,
                            String currency,
                            double price,
                            double dayChangePct,
                            String exchange,
                            String timezone,
                            Double previousClose,
                            Double openPrice,
                            Double dayHigh,
                            Double dayLow,
                            Double fiftyTwoWeekHigh,
                            Double fiftyTwoWeekLow,
                            Double volume,
                            Double averageVolume,
                            Double marketCap,
                            String sector,
                            String industry,
                            String website,
                            List<HistoricalBar> history) {
    }

    record HistoricalBar(String time, double open, double high, double low, double close) {
    }
}
