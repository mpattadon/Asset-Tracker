package com.assettracker.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.time.LocalDate;

public record AddHoldingRequest(
        @NotBlank String symbol,
        @NotBlank String name,
        @NotBlank String market,
        @NotBlank String type,
        @NotBlank String currency,
        @NotNull LocalDate purchaseDate,
        @Positive double purchasePrice,
        @Positive double quantity
) {
}
