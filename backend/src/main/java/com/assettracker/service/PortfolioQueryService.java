package com.assettracker.service;

import com.assettracker.model.BanksData;
import com.assettracker.model.BondHolding;
import com.assettracker.model.ExpensesData;
import com.assettracker.model.FundHolding;
import com.assettracker.model.GoldPosition;
import com.assettracker.model.LotteryEntry;
import com.assettracker.model.StockPositionView;
import com.assettracker.model.StockSummary;
import com.assettracker.model.StocksData;
import com.assettracker.model.SummaryData;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class PortfolioQueryService {

    private final JdbcTemplate jdbcTemplate;
    private final PortfolioSyncService portfolioSyncService;
    private final FxRateService fxRateService;
    private final StockLedgerService stockLedgerService;

    public PortfolioQueryService(JdbcTemplate jdbcTemplate,
                                 PortfolioSyncService portfolioSyncService,
                                 FxRateService fxRateService,
                                 StockLedgerService stockLedgerService) {
        this.jdbcTemplate = jdbcTemplate;
        this.portfolioSyncService = portfolioSyncService;
        this.fxRateService = fxRateService;
        this.stockLedgerService = stockLedgerService;
    }

    public SummaryData getSummary(PortfolioMetadataRepository.UserRecord user) {
        portfolioSyncService.ensureSynchronized(user);

        double usEquitiesUsd = totalHoldingsValue(user, "US");
        double usToThb = fxRateService.latestRate("USD", "THB");
        double usEquitiesThb = usEquitiesUsd * usToThb;
        double thaiEquities = totalHoldingsValue(user, "TH");
        double bondValue = totalBondValue(user.id());
        double fundValue = totalFundValue(user.id());
        double goldValue = totalGoldValue(user.id());
        double cashValue = totalCashValue(user.id(), "TH");
        double lotteryValue = totalLotteryValue(user.id());

        double equities = thaiEquities + usEquitiesThb;
        double fixedIncome = bondValue + fundValue;
        double netWorth = equities + fixedIncome + goldValue + cashValue + lotteryValue;

        List<SummaryData.SummaryCard> cards = List.of(
                new SummaryData.SummaryCard("Net Worth", formatCompactThb(netWorth), "SQLite-backed workspace"),
                new SummaryData.SummaryCard("Invested", formatCompactThb(equities + fixedIncome), "DB projections + live quotes"),
                new SummaryData.SummaryCard("Cash & Savings", formatCompactThb(cashValue), "SQLite balances"),
                new SummaryData.SummaryCard("Alternatives", formatCompactThb(goldValue + lotteryValue), "Gold + lottery")
        );

        List<AllocationSlice> slices = List.of(
                new AllocationSlice("Equities", equities, "#3B82F6"),
                new AllocationSlice("Fixed Income", fixedIncome, "#F59E0B"),
                new AllocationSlice("Gold", goldValue, "#EAB308"),
                new AllocationSlice("Cash", cashValue, "#22D3EE"),
                new AllocationSlice("Lottery", lotteryValue, "#10B981")
        );

        double total = slices.stream().mapToDouble(AllocationSlice::amount).sum();
        List<SummaryData.AllocationItem> allocation = new ArrayList<>();
        int running = 0;
        for (int i = 0; i < slices.size(); i++) {
            AllocationSlice slice = slices.get(i);
            int percent = i == slices.size() - 1
                    ? Math.max(0, 100 - running)
                    : total == 0 ? 0 : (int) Math.round((slice.amount / total) * 100);
            running += percent;
            allocation.add(new SummaryData.AllocationItem(slice.label, percent, slice.color));
        }
        return new SummaryData(cards, allocation);
    }

    public StocksData.StockMarketData getStocks(PortfolioMetadataRepository.UserRecord user, String market) {
        portfolioSyncService.ensureSynchronized(user);
        List<StockPositionView> holdings = getStockHoldings(user, market, false);
        StockSummary summary = getStockSummary(user, market);
        List<StocksData.StockSlice> breakdown = buildBreakdown(holdings);
        List<Double> series = !summary.series().isEmpty() ? summary.series() : syntheticSeries(summary.totalValue());
        List<StocksData.Candlestick> candles = !summary.candlesticks().isEmpty()
                ? summary.candlesticks()
                : syntheticCandles(series);
        String change = String.format(Locale.US, "%+.2f%% total", summary.totalChangePct());
        return new StocksData.StockMarketData(
                summary.title(),
                summary.currency(),
                summary.totalValue(),
                summary.dayChange(),
                summary.dayChangePct(),
                summary.totalChange(),
                summary.totalChangePct(),
                breakdown,
                new StocksData.StockPerformance(change, series),
                series,
                candles,
                List.of(),
                List.of()
        );
    }

    public List<BondHolding> getBonds(PortfolioMetadataRepository.UserRecord user) {
        portfolioSyncService.ensureSynchronized(user);
        return jdbcTemplate.query("""
                        SELECT i.name, i.metadata_json, t.gross_amount,
                               c.code AS currency_code
                        FROM transactions t
                        JOIN instruments i ON i.id = t.instrument_id
                        JOIN asset_categories ac ON ac.id = i.asset_category_id
                        LEFT JOIN currencies c ON c.id = t.gross_currency_id
                        WHERE t.user_id = ?
                          AND ac.code = 'BOND'
                        ORDER BY i.name
                        """,
                (rs, rowNum) -> new BondHolding(
                        rs.getString("name"),
                        jsonField(rs.getString("metadata_json"), "yield"),
                        formatMoney(rs.getString("currency_code"), rs.getDouble("gross_amount")),
                        jsonField(rs.getString("metadata_json"), "duration")
                ),
                id(user.id())
        );
    }

    public List<GoldPosition> getGold(PortfolioMetadataRepository.UserRecord user) {
        portfolioSyncService.ensureSynchronized(user);
        return jdbcTemplate.query("""
                        SELECT i.name, i.metadata_json, h.market_value, c.code AS currency_code
                        FROM holdings h
                        JOIN instruments i ON i.id = h.instrument_id
                        JOIN asset_categories ac ON ac.id = i.asset_category_id
                        LEFT JOIN currencies c ON c.id = h.market_value_currency_id
                        WHERE h.user_id = ?
                          AND ac.code = 'GOLD'
                        ORDER BY i.name
                        """,
                (rs, rowNum) -> new GoldPosition(
                        rs.getString("name"),
                        jsonField(rs.getString("metadata_json"), "weight"),
                        formatMoney(rs.getString("currency_code"), rs.getDouble("market_value")),
                        jsonField(rs.getString("metadata_json"), "change")
                ),
                id(user.id())
        );
    }

    public List<FundHolding> getFunds(PortfolioMetadataRepository.UserRecord user) {
        portfolioSyncService.ensureSynchronized(user);
        return jdbcTemplate.query("""
                        SELECT i.name, COALESCE(mf.exposure, '') AS exposure_value, mf.nav,
                               c.code AS currency_code, COALESCE(mf.change_text, '') AS change_value
                        FROM mutual_fund_monthly_snapshots mf
                        LEFT JOIN instruments i ON i.id = mf.instrument_id
                        LEFT JOIN currencies c ON c.id = mf.currency_id
                        WHERE mf.user_id = ?
                        ORDER BY i.name
                        """,
                (rs, rowNum) -> new FundHolding(
                        rs.getString("name"),
                        rs.getString("exposure_value"),
                        formatMoney(rs.getString("currency_code"), rs.getDouble("nav")),
                        rs.getString("change_value")
                ),
                id(user.id())
        );
    }

    public BanksData.BankRegionData getBanks(PortfolioMetadataRepository.UserRecord user, String region) {
        portfolioSyncService.ensureSynchronized(user);
        String regionCode = "uk".equalsIgnoreCase(region) ? "UK" : "TH";
        List<BanksData.BankAccount> accounts = jdbcTemplate.query("""
                        SELECT b.bank_name, b.balance, c.code AS currency_code, COALESCE(b.change_text, '') AS change_text
                        FROM bank_balance_snapshots b
                        LEFT JOIN currencies c ON c.id = b.currency_id
                        LEFT JOIN accounts a ON a.id = b.account_id
                        LEFT JOIN markets m ON m.id = a.market_id
                        WHERE b.user_id = ?
                          AND COALESCE(m.code, 'TH') = ?
                        ORDER BY b.bank_name
                        """,
                (rs, rowNum) -> new BanksData.BankAccount(
                        rs.getString("bank_name"),
                        formatMoney(rs.getString("currency_code"), rs.getDouble("balance")),
                        rs.getString("change_text")
                ),
                id(user.id()),
                regionCode
        );
        double total = accounts.stream().mapToDouble(item -> parseMoney(item.balance())).sum();
        return new BanksData.BankRegionData(
                formatMoney("UK".equals(regionCode) ? "GBP" : "THB", total),
                accounts,
                syntheticSeries(total)
        );
    }

    public List<LotteryEntry> getLottery(PortfolioMetadataRepository.UserRecord user) {
        portfolioSyncService.ensureSynchronized(user);
        return jdbcTemplate.query("""
                        SELECT draw_name, tickets, committed_amount, committed_currency_id, estimated_payout
                        FROM lottery_entries
                        WHERE user_id = ?
                        ORDER BY draw_name
                        """,
                (rs, rowNum) -> new LotteryEntry(
                        rs.getString("draw_name"),
                        rs.getInt("tickets"),
                        formatMoney(currencyCode(parseUuid(rs.getString("committed_currency_id"))), rs.getDouble("committed_amount")),
                        rs.getString("estimated_payout")
                ),
                id(user.id())
        );
    }

    public ExpensesData getExpenses(PortfolioMetadataRepository.UserRecord user) {
        portfolioSyncService.ensureSynchronized(user);
        List<ExpensesData.ExpenseItem> monthly = loadExpenses(user.id(), "MONTHLY");
        List<ExpensesData.ExpenseItem> yearly = loadExpenses(user.id(), "YEARLY");
        String runway = jdbcTemplate.query("""
                        SELECT runway_text
                        FROM expense_items
                        WHERE user_id = ?
                          AND runway_text IS NOT NULL
                          AND runway_text <> ''
                        LIMIT 1
                        """,
                (rs, rowNum) -> rs.getString("runway_text"),
                id(user.id())
        ).stream().findFirst().orElse("");
        return new ExpensesData(monthly, yearly, runway);
    }

    public List<StockPositionView> getStockHoldings(PortfolioMetadataRepository.UserRecord user,
                                                    String market,
                                                    boolean sortByDayChange) {
        portfolioSyncService.ensureSynchronized(user);
        return stockLedgerService.getHoldings(user, market, sortByDayChange);
    }

    public StockPositionView addStockHolding(PortfolioMetadataRepository.UserRecord user,
                                             String market,
                                             com.assettracker.model.AddHoldingRequest request) {
        portfolioSyncService.ensureSynchronized(user);
        return stockLedgerService.addBuyFromHoldingRequest(user, market, request);
    }

    public StockSummary getStockSummary(PortfolioMetadataRepository.UserRecord user, String market) {
        portfolioSyncService.ensureSynchronized(user);
        return stockLedgerService.getSummary(user, market);
    }

    private List<ExpensesData.ExpenseItem> loadExpenses(UUID userId, String frequency) {
        return jdbcTemplate.query("""
                        SELECT name, amount, c.code AS currency_code, renewal_text
                        FROM expense_items ei
                        LEFT JOIN currencies c ON c.id = ei.currency_id
                        WHERE ei.user_id = ?
                          AND ei.expense_frequency = ?
                        ORDER BY name
                        """,
                (rs, rowNum) -> new ExpensesData.ExpenseItem(
                        rs.getString("name"),
                        formatMoney(rs.getString("currency_code"), rs.getDouble("amount")),
                        rs.getString("renewal_text")
                ),
                id(userId),
                frequency
        );
    }

    private List<StocksData.StockSlice> buildBreakdown(List<StockPositionView> holdings) {
        double total = holdings.stream().mapToDouble(StockPositionView::value).sum();
        String[] palette = {"#3B82F6", "#F59E0B", "#10B981", "#06B6D4", "#8B5CF6"};
        List<StocksData.StockSlice> slices = new ArrayList<>();
        List<StockPositionView> top = holdings.stream()
                .sorted(Comparator.comparingDouble(StockPositionView::value).reversed())
                .limit(5)
                .toList();
        int index = 0;
        for (StockPositionView holding : top) {
            int percent = total == 0 ? 0 : (int) Math.round((holding.value() / total) * 100);
            slices.add(new StocksData.StockSlice(holding.symbol(), percent, palette[index % palette.length]));
            index++;
        }
        return slices;
    }

    private List<Double> syntheticSeries(double currentValue) {
        if (currentValue <= 0) {
            return List.of(0d, 0d, 0d, 0d, 0d, 0d);
        }
        return List.of(
                currentValue * 0.88,
                currentValue * 0.90,
                currentValue * 0.93,
                currentValue * 0.95,
                currentValue * 0.98,
                currentValue
        );
    }

    private List<StocksData.Candlestick> syntheticCandles(List<Double> series) {
        List<StocksData.Candlestick> candles = new ArrayList<>();
        for (int index = 0; index < series.size(); index++) {
            double close = series.get(index);
            candles.add(new StocksData.Candlestick(
                    "P" + (index + 1),
                    close * 0.99,
                    close * 1.01,
                    close * 0.98,
                    close
            ));
        }
        return candles;
    }

    private double totalHoldingsValue(PortfolioMetadataRepository.UserRecord user, String marketCode) {
        List<StockPositionView> holdings = stockLedgerService.getHoldings(user, marketCode, false);
        return holdings.stream().mapToDouble(StockPositionView::value).sum();
    }

    private double totalBondValue(UUID userId) {
        return jdbcTemplate.query("SELECT COALESCE(SUM(gross_amount), 0) FROM transactions t JOIN instruments i ON i.id = t.instrument_id JOIN asset_categories ac ON ac.id = i.asset_category_id WHERE t.user_id = ? AND ac.code = 'BOND'",
                rs -> rs.next() ? rs.getDouble(1) : 0, id(userId));
    }

    private double totalFundValue(UUID userId) {
        return jdbcTemplate.query("SELECT COALESCE(SUM(nav), 0) FROM mutual_fund_monthly_snapshots WHERE user_id = ?",
                rs -> rs.next() ? rs.getDouble(1) : 0, id(userId));
    }

    private double totalGoldValue(UUID userId) {
        return jdbcTemplate.query("SELECT COALESCE(SUM(market_value), 0) FROM holdings h JOIN instruments i ON i.id = h.instrument_id JOIN asset_categories ac ON ac.id = i.asset_category_id WHERE h.user_id = ? AND ac.code = 'GOLD'",
                rs -> rs.next() ? rs.getDouble(1) : 0, id(userId));
    }

    private double totalCashValue(UUID userId, String marketCode) {
        return jdbcTemplate.query("""
                SELECT COALESCE(SUM(balance), 0)
                FROM bank_balance_snapshots b
                LEFT JOIN accounts a ON a.id = b.account_id
                LEFT JOIN markets m ON m.id = a.market_id
                WHERE b.user_id = ?
                  AND COALESCE(m.code, 'TH') = ?
                """, rs -> rs.next() ? rs.getDouble(1) : 0, id(userId), marketCode);
    }

    private double totalLotteryValue(UUID userId) {
        return jdbcTemplate.query("SELECT COALESCE(SUM(committed_amount), 0) FROM lottery_entries WHERE user_id = ?",
                rs -> rs.next() ? rs.getDouble(1) : 0, id(userId));
    }


    private double parseMoney(String value) {
        if (value == null || value.isBlank()) {
            return 0;
        }
        String normalized = value.replaceAll("[^0-9.]", "");
        return normalized.isBlank() ? 0 : Double.parseDouble(normalized);
    }

    private String formatCompactThb(double amount) {
        if (amount >= 1_000_000) {
            return "THB " + String.format(Locale.US, "%.1fM", amount / 1_000_000d);
        }
        return formatMoney("THB", amount);
    }

    private String formatMoney(String currencyCode, double amount) {
        if (currencyCode == null || currencyCode.isBlank()) {
            currencyCode = "THB";
        }
        return currencyCode + " " + String.format(Locale.US, "%,.2f", amount);
    }

    private String currencyCode(UUID currencyId) {
        if (currencyId == null) {
            return "THB";
        }
        return jdbcTemplate.queryForObject("SELECT code FROM currencies WHERE id = ?", String.class, id(currencyId));
    }

    private UUID parseUuid(String raw) {
        return raw == null || raw.isBlank() ? null : UUID.fromString(raw);
    }

    private String id(UUID value) {
        return value == null ? null : value.toString();
    }

    private String jsonField(String json, String field) {
        if (json == null || json.isBlank() || field == null || field.isBlank()) {
            return "";
        }
        String quotedKey = "\"" + field + "\"";
        int keyIndex = json.indexOf(quotedKey);
        if (keyIndex < 0) {
            return "";
        }
        int colonIndex = json.indexOf(':', keyIndex + quotedKey.length());
        if (colonIndex < 0) {
            return "";
        }
        int valueStart = colonIndex + 1;
        while (valueStart < json.length() && Character.isWhitespace(json.charAt(valueStart))) {
            valueStart++;
        }
        if (valueStart >= json.length()) {
            return "";
        }
        if (json.charAt(valueStart) == '"') {
            int valueEnd = json.indexOf('"', valueStart + 1);
            return valueEnd < 0 ? "" : json.substring(valueStart + 1, valueEnd);
        }
        int valueEnd = valueStart;
        while (valueEnd < json.length() && json.charAt(valueEnd) != ',' && json.charAt(valueEnd) != '}') {
            valueEnd++;
        }
        return json.substring(valueStart, valueEnd).trim();
    }

    private record AllocationSlice(String label, double amount, String color) {
    }
}
