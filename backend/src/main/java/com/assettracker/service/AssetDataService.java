package com.assettracker.service;

import com.assettracker.model.AssetDataset;
import com.assettracker.model.BanksData;
import com.assettracker.model.BondHolding;
import com.assettracker.model.ExpensesData;
import com.assettracker.model.FundHolding;
import com.assettracker.model.GoldPosition;
import com.assettracker.model.LotteryEntry;
import com.assettracker.model.StocksData;
import com.assettracker.model.SummaryData;
import org.springframework.stereotype.Service;

import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
public class AssetDataService {

    private final UserAssetStore userAssetStore;
    private final StockPortfolioService stockPortfolioService;

    public AssetDataService(UserAssetStore userAssetStore, StockPortfolioService stockPortfolioService) {
        this.userAssetStore = userAssetStore;
        this.stockPortfolioService = stockPortfolioService;
    }

    public SummaryData getSummary(String userId) {
        AssetDataset dataset = userAssetStore.load(userId);

        double usEquities = stockPortfolioService.summary(userId, "us").totalValue();
        double thaiEquities = dataset.stocks().thai() != null ? dataset.stocks().thai().value() : 0;
        double fixedIncome = sumAmounts(dataset.bonds().stream().map(BondHolding::amount).toList())
                + sumAmounts(dataset.funds().stream().map(FundHolding::nav).toList());
        double gold = sumAmounts(dataset.gold().stream().map(GoldPosition::value).toList());
        double cash = dataset.banks() != null && dataset.banks().thai() != null
                ? parseMoney(dataset.banks().thai().total())
                : 0;
        double lottery = sumAmounts(dataset.lottery().stream().map(LotteryEntry::committed).toList());

        double equities = usEquities + thaiEquities;
        double netWorth = equities + fixedIncome + gold + cash + lottery;

        List<SummaryData.SummaryCard> cards = List.of(
                new SummaryData.SummaryCard("Net Worth", formatCompactCurrency(netWorth), "Live priced"),
                new SummaryData.SummaryCard("Invested", formatCompactCurrency(equities + fixedIncome), "US quotes + stored assets"),
                new SummaryData.SummaryCard("Cash & Savings", formatCompactCurrency(cash), "Stored balances"),
                new SummaryData.SummaryCard("Alternatives", formatCompactCurrency(gold + lottery), "Gold + lottery")
        );

        List<AllocationSlice> slices = List.of(
                new AllocationSlice("Equities", equities, "#3B82F6"),
                new AllocationSlice("Fixed Income", fixedIncome, "#F59E0B"),
                new AllocationSlice("Gold", gold, "#EAB308"),
                new AllocationSlice("Cash", cash, "#22D3EE"),
                new AllocationSlice("Lottery", lottery, "#10B981")
        );

        return new SummaryData(cards, toAllocationItems(slices));
    }

    public StocksData.StockMarketData getStocks(String userId, String market) {
        StocksData stocks = userAssetStore.load(userId).stocks();
        if ("us".equalsIgnoreCase(market)) {
            return stocks.us();
        }
        return stocks.thai();
    }

    public List<BondHolding> getBonds(String userId) {
        return userAssetStore.load(userId).bonds();
    }

    public List<GoldPosition> getGold(String userId) {
        return userAssetStore.load(userId).gold();
    }

    public List<FundHolding> getFunds(String userId) {
        return userAssetStore.load(userId).funds();
    }

    public BanksData.BankRegionData getBanks(String userId, String region) {
        BanksData banks = userAssetStore.load(userId).banks();
        if ("uk".equalsIgnoreCase(region)) {
            return banks.uk();
        }
        return banks.thai();
    }

    public List<LotteryEntry> getLottery(String userId) {
        return userAssetStore.load(userId).lottery();
    }

    public ExpensesData getExpenses(String userId) {
        return userAssetStore.load(userId).expenses();
    }

    private double sumAmounts(List<String> values) {
        return values.stream().mapToDouble(this::parseMoney).sum();
    }

    private double parseMoney(String rawValue) {
        if (rawValue == null || rawValue.isBlank()) {
            return 0;
        }
        String normalized = rawValue.replaceAll("[^0-9.]", "");
        if (normalized.isBlank()) {
            return 0;
        }
        return Double.parseDouble(normalized);
    }

    private String formatCompactCurrency(double amount) {
        if (amount >= 1_000_000) {
            DecimalFormat decimalFormat = new DecimalFormat("0.0", DecimalFormatSymbols.getInstance(Locale.US));
            return "THB " + decimalFormat.format(amount / 1_000_000d) + "M";
        }
        return "THB " + String.format(Locale.US, "%,.0f", amount);
    }

    private List<SummaryData.AllocationItem> toAllocationItems(List<AllocationSlice> slices) {
        double total = slices.stream().mapToDouble(AllocationSlice::amount).sum();
        if (total <= 0) {
            return List.of();
        }

        List<SummaryData.AllocationItem> items = new ArrayList<>();
        int runningPercent = 0;
        for (int index = 0; index < slices.size(); index++) {
            AllocationSlice slice = slices.get(index);
            int percent = index == slices.size() - 1
                    ? Math.max(0, 100 - runningPercent)
                    : (int) Math.round((slice.amount / total) * 100);
            runningPercent += percent;
            items.add(new SummaryData.AllocationItem(slice.label, percent, slice.color));
        }
        return items;
    }

    private record AllocationSlice(String label, double amount, String color) {
    }
}
