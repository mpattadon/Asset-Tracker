package com.assettracker.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record MutualFundPurchaseRequest(
        @NotBlank String accountId,
        @NotBlank String fundName,
        @NotNull Integer riskLevel,
        @NotNull Double averageCostPerUnit,
        @NotNull Double unitsPurchased,
        @NotNull LocalDate purchaseDate
) {
}
