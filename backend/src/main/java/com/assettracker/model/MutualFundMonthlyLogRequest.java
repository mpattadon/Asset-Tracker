package com.assettracker.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record MutualFundMonthlyLogRequest(
        @NotBlank String accountId,
        @NotBlank String fundName,
        @NotNull LocalDate logDate,
        @NotNull Double pricePerUnit,
        Double dividendReceived
) {
}
