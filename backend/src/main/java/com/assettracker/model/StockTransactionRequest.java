package com.assettracker.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record StockTransactionRequest(
        @NotBlank String transactionType,
        @NotBlank String symbol,
        @NotBlank String name,
        @NotBlank String market,
        @NotBlank String type,
        @NotBlank String currency,
        @NotNull LocalDate transactionDate,
        Double quantity,
        Double pricePerUnit,
        Double feeNetUsd,
        Double feeNetThb,
        Double fxActualRate,
        Double fxDimeRate,
        Double dividendPerShare,
        Double withholdingTaxRate
) {
}
