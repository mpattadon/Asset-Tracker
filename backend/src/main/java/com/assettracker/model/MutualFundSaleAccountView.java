package com.assettracker.model;

import java.util.List;

public record MutualFundSaleAccountView(
        String id,
        String bankName,
        String accountNumber,
        String notes,
        String currency,
        Double realizedGainLoss,
        Double dividends,
        Double totalGainLoss,
        List<MutualFundSaleView> sales
) {
}
