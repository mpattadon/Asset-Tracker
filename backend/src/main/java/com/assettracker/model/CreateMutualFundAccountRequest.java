package com.assettracker.model;

import jakarta.validation.constraints.NotBlank;

public record CreateMutualFundAccountRequest(
        @NotBlank String bankName,
        @NotBlank String accountNumber,
        String notes,
        @NotBlank String currency
) {
}
