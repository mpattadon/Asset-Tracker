package com.assettracker.model;

public record MutualFundAccountView(
        String id,
        String bankName,
        String accountNumber,
        String notes,
        String currency
) {
}
