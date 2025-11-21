package com.assettracker.model;

import java.util.List;

public record AssetDataset(
        SummaryData summary,
        StocksData stocks,
        List<BondHolding> bonds,
        List<GoldPosition> gold,
        List<FundHolding> funds,
        BanksData banks,
        List<LotteryEntry> lottery,
        ExpensesData expenses) {
}
