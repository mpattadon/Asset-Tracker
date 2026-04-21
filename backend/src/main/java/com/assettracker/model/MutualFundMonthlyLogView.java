package com.assettracker.model;

public record MutualFundMonthlyLogView(
        String id,
        String logDate,
        Double pricePerUnit,
        Double marketValue,
        Double dividendReceived
) {
}
