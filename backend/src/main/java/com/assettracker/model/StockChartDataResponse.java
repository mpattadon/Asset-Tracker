package com.assettracker.model;

import com.assettracker.service.MarketDataProvider;

import java.util.List;

public record StockChartDataResponse(String requestedSymbol,
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
                                     List<MarketDataProvider.NewsItem> news,
                                     MarketDataProvider.FinancialStatement incomeStatement,
                                     MarketDataProvider.FinancialStatement balanceSheet,
                                     MarketDataProvider.FinancialStatement cashFlow,
                                     List<MarketDataProvider.HistoricalBar> intradayHistory,
                                     List<MarketDataProvider.HistoricalBar> dailyHistory) {
}
