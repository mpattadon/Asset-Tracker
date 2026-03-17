package com.assettracker.model;

import java.util.List;

public record StockPositionView(
        String symbol,
        String name,
        String market,
        String type,
        String currency,
        double price,
        double quantity,
        double dayGain,
        double dayChangePct,
        double value,
        double totalChange,
        double totalChangePct,
        List<StockLotView> lots
) {
}
