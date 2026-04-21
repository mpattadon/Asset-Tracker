package com.assettracker.model;

import com.assettracker.service.MarketDataProvider;

import java.util.List;

public record StockChartHistoryResponse(List<MarketDataProvider.HistoricalBar> dailyHistory) {
}
