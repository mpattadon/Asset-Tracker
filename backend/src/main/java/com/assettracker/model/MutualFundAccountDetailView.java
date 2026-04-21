package com.assettracker.model;

import java.util.List;

public record MutualFundAccountDetailView(
        String id,
        String bankName,
        String accountNumber,
        String notes,
        String currency,
        List<MutualFundHoldingView> funds
) {
}
