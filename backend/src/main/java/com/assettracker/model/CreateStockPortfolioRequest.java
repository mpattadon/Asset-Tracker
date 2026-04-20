package com.assettracker.model;

import jakarta.validation.constraints.NotBlank;

public record CreateStockPortfolioRequest(
        @NotBlank String name,
        @NotBlank String currency
) {
}
