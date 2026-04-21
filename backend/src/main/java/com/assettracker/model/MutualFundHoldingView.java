package com.assettracker.model;

import java.util.List;

public record MutualFundHoldingView(
        String fundName,
        Integer riskLevel,
        String currency,
        Double totalInvested,
        Double currentValue,
        Double dividends,
        Double gainLoss,
        Double gainLossPct,
        java.util.List<MutualFundPurchaseView> purchases,
        List<MutualFundMonthlyLogView> monthlyLogs
) {
}
