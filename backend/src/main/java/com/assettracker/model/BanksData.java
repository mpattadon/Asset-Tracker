package com.assettracker.model;

import java.util.List;

public record BanksData(BankRegionData thai, BankRegionData uk) {
    public record BankRegionData(String total, List<BankAccount> accounts, List<Double> series) {
    }

    public record BankAccount(String bank, String balance, String change) {
    }
}
