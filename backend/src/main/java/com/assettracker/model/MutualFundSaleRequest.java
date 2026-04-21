package com.assettracker.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record MutualFundSaleRequest(
        @NotBlank String accountId,
        @NotBlank String fundName,
        @NotNull Double unitsSold,
        @NotNull Double salePricePerUnit,
        @NotNull LocalDate saleDate
) {
}
