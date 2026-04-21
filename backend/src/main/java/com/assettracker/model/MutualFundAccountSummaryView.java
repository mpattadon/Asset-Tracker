package com.assettracker.model;

public record MutualFundAccountSummaryView(
        String id,
        String bankName,
        String accountNumber,
        String notes,
        String currency,
        Double totalInvested,
        Double currentValue,
        Double dividends,
        Double gainLoss,
        Double gainLossPct
) {
}
