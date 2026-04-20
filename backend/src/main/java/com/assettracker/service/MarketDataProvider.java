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

    Optional<Double> fxRate(String baseCurrency, String quoteCurrency);

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
                            String longBusinessSummary,
                            String headquarters,
                            String country,
                            String ceo,
                            Double fullTimeEmployees,
                            Double trailingPe,
                            Double dividendYield,
                            List<NewsItem> news,
                            FinancialStatement incomeStatement,
                            FinancialStatement balanceSheet,
                            FinancialStatement cashFlow,
                            List<HistoricalBar> history) {
    }

    record NewsItem(String title,
                    String publisher,
                    String link,
                    String publishedAt,
                    String summary) {
    }

    record FinancialStatement(String title,
                              List<String> periods,
                              List<FinancialRow> rows) {
    }

    record FinancialRow(String label,
                        List<Double> values) {
    }

    record HistoricalBar(String time, double open, double high, double low, double close) {
    }
}
