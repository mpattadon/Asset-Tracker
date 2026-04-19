package com.assettracker.service;

import com.assettracker.model.AddHoldingRequest;
import com.assettracker.model.BanksData;
import com.assettracker.model.BondHolding;
import com.assettracker.model.ExpensesData;
import com.assettracker.model.FundHolding;
import com.assettracker.model.GoldPosition;
import com.assettracker.model.LotteryEntry;
import com.assettracker.model.QuoteResult;
import com.assettracker.model.StockLotView;
import com.assettracker.model.StockPositionView;
import com.assettracker.model.StockSummary;
import com.assettracker.model.StocksData;
import com.assettracker.model.SummaryData;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Date;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class PortfolioQueryService {

    private final JdbcTemplate jdbcTemplate;
    private final PortfolioSyncService portfolioSyncService;
    private final QuoteProvider quoteProvider;
    private final MarketDataProvider marketDataProvider;
    private final FxRateService fxRateService;
    private final PortfolioMetadataRepository portfolioMetadataRepository;
    private final ReferenceDataService referenceDataService;

    public PortfolioQueryService(JdbcTemplate jdbcTemplate,
                                 PortfolioSyncService portfolioSyncService,
                                 QuoteProvider quoteProvider,
                                 MarketDataProvider marketDataProvider,
                                 FxRateService fxRateService,
                                 PortfolioMetadataRepository portfolioMetadataRepository,
                                 ReferenceDataService referenceDataService) {
        this.jdbcTemplate = jdbcTemplate;
        this.portfolioSyncService = portfolioSyncService;
        this.quoteProvider = quoteProvider;
        this.marketDataProvider = marketDataProvider;
        this.fxRateService = fxRateService;
        this.portfolioMetadataRepository = portfolioMetadataRepository;
        this.referenceDataService = referenceDataService;
    }

    public SummaryData getSummary(PortfolioMetadataRepository.UserRecord user) {
        portfolioSyncService.ensureSynchronized(user);

        double usEquitiesUsd = totalHoldingsValue(user.id(), "US");
        double usToThb = fxRateService.latestRate("USD", "THB");
        double usEquitiesThb = usEquitiesUsd * usToThb;
        double thaiEquities = totalHoldingsValue(user.id(), "TH");
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
        String marketCode = normalizeMarketCode(market);
        List<HoldingRow> holdingRows = jdbcTemplate.query("""
                        SELECT h.account_id, h.instrument_id, h.units_held, h.avg_cost_per_unit, h.invested_amount,
                               i.ticker, i.name, c.code AS currency_code, ac.code AS asset_category_code
                        FROM holdings h
                        JOIN instruments i ON i.id = h.instrument_id
                        JOIN asset_categories ac ON ac.id = i.asset_category_id
                        LEFT JOIN currencies c ON c.id = h.invested_currency_id
                        LEFT JOIN markets m ON m.id = i.market_id
                        WHERE h.user_id = ?
                          AND COALESCE(m.code, 'TH') = ?
                        ORDER BY i.ticker
                        """,
                (rs, rowNum) -> new HoldingRow(
                        parseUuid(rs.getString("account_id")),
                        parseUuid(rs.getString("instrument_id")),
                        rs.getString("ticker"),
                        rs.getString("name"),
                        rs.getString("asset_category_code"),
                        rs.getString("currency_code"),
                        rs.getDouble("units_held"),
                        rs.getDouble("avg_cost_per_unit"),
                        rs.getDouble("invested_amount")
                ),
                id(user.id()),
                marketCode
        );

        List<StockPositionView> positions = new ArrayList<>();
        for (HoldingRow row : holdingRows) {
            QuoteResult quote = quoteProvider.lookup(user, row.symbol(), marketCode.equals("US") ? "us" : "thai")
                    .orElse(new QuoteResult(
                            row.symbol(),
                            row.name(),
                            marketCode,
                            row.assetCategoryCode().equals("MUTUAL_FUND") ? "ETF" : "Stock",
                            row.currencyCode(),
                            row.avgCostPerUnit(),
                            0
                    ));
            upsertMarketPrice(row.instrumentId(), row.currencyCode(), quote.price(), quote.dayChangePct());
            double value = quote.price() * row.unitsHeld();
            double dayGain = value * (quote.dayChangePct() / 100d);
            double totalChange = (quote.price() - row.avgCostPerUnit()) * row.unitsHeld();
            List<StockLotView> lots = loadLots(user.id(), row.accountId(), row.instrumentId(), row.currencyCode(), quote);
            positions.add(new StockPositionView(
                    row.symbol(),
                    row.name(),
                    marketCode.equals("US") ? "us" : "thai",
                    row.assetCategoryCode().equals("MUTUAL_FUND") ? "ETF" : "Stock",
                    row.currencyCode(),
                    quote.price(),
                    row.unitsHeld(),
                    dayGain,
                    quote.dayChangePct(),
                    value,
                    totalChange,
                    row.avgCostPerUnit() == 0 ? 0 : (totalChange / (row.avgCostPerUnit() * row.unitsHeld())) * 100,
                    lots
            ));
        }

        if (sortByDayChange) {
            return positions.stream()
                    .sorted(Comparator.comparingDouble(StockPositionView::dayChangePct).reversed())
                    .toList();
        }
        return positions;
    }

    public StockPositionView addStockHolding(PortfolioMetadataRepository.UserRecord user,
                                             String market,
                                             AddHoldingRequest request) {
        if (!"us".equalsIgnoreCase(market)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only US holdings are editable right now");
        }
        portfolioSyncService.ensureSynchronized(user);
        UUID accountId = ensureUsStockAccount(user, request.currency());
        UUID instrumentId = ensureInstrument(user, request);
        insertBuyTransaction(user, accountId, instrumentId, request);
        upsertHolding(user, accountId, instrumentId, request);
        upsertYearlySummary(user, accountId, instrumentId, request);
        upsertMarketPrice(instrumentId, request.currency(), request.purchasePrice(), 0);
        return getStockHoldings(user, market, false).stream()
                .filter(position -> position.symbol().equalsIgnoreCase(request.symbol()))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "Holding saved but not found"));
    }

    public StockSummary getStockSummary(PortfolioMetadataRepository.UserRecord user, String market) {
        List<StockPositionView> positions = getStockHoldings(user, market, false);
        String currency = "us".equalsIgnoreCase(market) ? "USD" : "THB";
        double totalValue = positions.stream().mapToDouble(StockPositionView::value).sum();
        double dayChange = positions.stream().mapToDouble(StockPositionView::dayGain).sum();
        double totalChange = positions.stream().mapToDouble(StockPositionView::totalChange).sum();
        double totalCost = positions.stream().mapToDouble(position -> position.value() - position.totalChange()).sum();
        List<StocksData.Candlestick> marketCandles = buildMarketCandles(user, market, positions);
        List<Double> series = marketCandles.stream().map(StocksData.Candlestick::close).toList();
        if (series.isEmpty()) {
            series = loadStockSeries(user.id(), normalizeMarketCode(market), totalValue);
            marketCandles = syntheticCandles(series);
        }
        return new StockSummary(
                normalizeMarketCode(market).equals("US") ? "us" : "thai",
                normalizeMarketCode(market).equals("US") ? "US Stock" : "Thai Stock",
                currency,
                totalValue,
                dayChange,
                totalValue == 0 ? 0 : (dayChange / totalValue) * 100,
                totalChange,
                totalCost == 0 ? 0 : (totalChange / totalCost) * 100,
                series,
                marketCandles
        );
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

    private List<StockLotView> loadLots(UUID userId,
                                        UUID accountId,
                                        UUID instrumentId,
                                        String currencyCode,
                                        QuoteResult quote) {
        return jdbcTemplate.query("""
                        SELECT t.id, t.trade_date, t.units, t.price_per_unit
                        FROM transactions t
                        JOIN transaction_types tt ON tt.id = t.transaction_type_id
                        WHERE t.user_id = ?
                          AND t.account_id = ?
                          AND t.instrument_id = ?
                          AND tt.code = 'BUY'
                        ORDER BY t.trade_date IS NULL, t.trade_date DESC, t.created_at DESC
                        """,
                (rs, rowNum) -> {
                    double units = rs.getDouble("units");
                    double currentValue = quote.price() * units;
                    double dayGain = currentValue * (quote.dayChangePct() / 100d);
                    return new StockLotView(
                            rs.getString("id"),
                            rs.getDate("trade_date") == null ? LocalDate.now().toString() : rs.getDate("trade_date").toLocalDate().toString(),
                            rs.getDouble("price_per_unit"),
                            units,
                            quote.price(),
                            dayGain,
                            quote.dayChangePct(),
                            currentValue
                    );
                },
                id(userId),
                id(accountId),
                id(instrumentId)
        );
    }

    private List<Double> loadStockSeries(UUID userId, String marketCode, double currentValue) {
        List<Double> snapshots = jdbcTemplate.query("""
                        SELECT market_value
                        FROM portfolio_snapshots ps
                        LEFT JOIN accounts a ON a.id = ps.account_id
                        LEFT JOIN markets m ON m.id = a.market_id
                        WHERE ps.user_id = ?
                          AND COALESCE(m.code, 'TH') = ?
                        ORDER BY snapshot_date
                        LIMIT 12
                        """,
                (rs, rowNum) -> rs.getDouble("market_value"),
                id(userId),
                marketCode
        );
        return snapshots.isEmpty() ? syntheticSeries(currentValue) : snapshots;
    }

    private List<StocksData.Candlestick> buildMarketCandles(PortfolioMetadataRepository.UserRecord user,
                                                            String market,
                                                            List<StockPositionView> positions) {
        Map<String, AggregateCandle> aggregate = new LinkedHashMap<>();
        for (StockPositionView position : positions) {
            List<MarketDataProvider.HistoricalBar> bars = marketDataProvider.history(
                    user,
                    position.symbol(),
                    market,
                    "1mo",
                    "1d"
            );
            for (MarketDataProvider.HistoricalBar bar : bars) {
                AggregateCandle candle = aggregate.computeIfAbsent(bar.time(), ignored -> new AggregateCandle());
                candle.open += bar.open() * position.quantity();
                candle.high += bar.high() * position.quantity();
                candle.low += bar.low() * position.quantity();
                candle.close += bar.close() * position.quantity();
            }
        }
        return aggregate.entrySet().stream()
                .map(entry -> new StocksData.Candlestick(
                        entry.getKey(),
                        entry.getValue().open,
                        entry.getValue().high,
                        entry.getValue().low,
                        entry.getValue().close
                ))
                .toList();
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

    private void upsertMarketPrice(UUID instrumentId, String currencyCode, double price, double dayChangePct) {
        double open = price / (1 + (dayChangePct / 100d));
        UUID currencyId = currencyCode == null ? null
                : parseUuid(jdbcTemplate.queryForObject("SELECT id FROM currencies WHERE code = ?", String.class, currencyCode));
        int updated = jdbcTemplate.update("""
                UPDATE market_prices
                SET open_price = ?,
                    high_price = ?,
                    low_price = ?,
                    close_price = ?,
                    adjusted_close_price = ?,
                    currency_id = ?
                WHERE instrument_id = ?
                  AND price_date = ?
                  AND source_name = ?
                """,
                open,
                Math.max(open, price),
                Math.min(open, price),
                price,
                price,
                id(currencyId),
                id(instrumentId),
                Date.valueOf(LocalDate.now()),
                "live-quote"
        );
        if (updated == 0) {
            try {
                jdbcTemplate.update("""
                        INSERT INTO market_prices
                            (id, instrument_id, price_date, open_price, high_price, low_price, close_price, adjusted_close_price,
                             currency_id, volume, source_name, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                        """,
                        UUID.randomUUID().toString(),
                        id(instrumentId),
                        Date.valueOf(LocalDate.now()),
                        open,
                        Math.max(open, price),
                        Math.min(open, price),
                        price,
                        price,
                        id(currencyId),
                        null,
                        "live-quote"
                );
            } catch (DuplicateKeyException ignored) {
                jdbcTemplate.update("""
                        UPDATE market_prices
                        SET open_price = ?,
                            high_price = ?,
                            low_price = ?,
                            close_price = ?,
                            adjusted_close_price = ?,
                            currency_id = ?
                        WHERE instrument_id = ?
                          AND price_date = ?
                          AND source_name = ?
                        """,
                        open,
                        Math.max(open, price),
                        Math.min(open, price),
                        price,
                        price,
                        id(currencyId),
                        id(instrumentId),
                        Date.valueOf(LocalDate.now()),
                        "live-quote"
                );
            }
        }
    }

    private double totalHoldingsValue(UUID userId, String marketCode) {
        List<StockPositionView> holdings = getStockHoldingsInternal(userId, marketCode);
        return holdings.stream().mapToDouble(StockPositionView::value).sum();
    }

    private List<StockPositionView> getStockHoldingsInternal(UUID userId, String marketCode) {
        return jdbcTemplate.query("""
                        SELECT h.account_id, h.instrument_id, h.units_held, h.avg_cost_per_unit,
                               i.ticker, i.name, c.code AS currency_code, ac.code AS asset_category_code
                        FROM holdings h
                        JOIN instruments i ON i.id = h.instrument_id
                        JOIN asset_categories ac ON ac.id = i.asset_category_id
                        LEFT JOIN currencies c ON c.id = h.invested_currency_id
                        LEFT JOIN markets m ON m.id = i.market_id
                        WHERE h.user_id = ?
                          AND COALESCE(m.code, 'TH') = ?
                        ORDER BY i.ticker
                        """,
                (rs, rowNum) -> {
                    String currencyCode = rs.getString("currency_code");
                    String symbol = rs.getString("ticker");
                    QuoteResult quote = quoteProvider.lookup(
                                    portfolioMetadataRepository.findUserById(userId).orElse(null),
                                    symbol,
                                    "US".equals(marketCode) ? "us" : "thai")
                            .orElse(new QuoteResult(symbol, rs.getString("name"), marketCode,
                                    "Stock", currencyCode, rs.getDouble("avg_cost_per_unit"), 0));
                    double unitsHeld = rs.getDouble("units_held");
                    double avgCost = rs.getDouble("avg_cost_per_unit");
                    double value = quote.price() * unitsHeld;
                    double totalChange = (quote.price() - avgCost) * unitsHeld;
                    return new StockPositionView(
                            symbol,
                            rs.getString("name"),
                            "US".equals(marketCode) ? "us" : "thai",
                            rs.getString("asset_category_code").equals("MUTUAL_FUND") ? "ETF" : "Stock",
                            currencyCode,
                            quote.price(),
                            unitsHeld,
                            value * (quote.dayChangePct() / 100d),
                            quote.dayChangePct(),
                            value,
                            totalChange,
                            avgCost == 0 ? 0 : (totalChange / (avgCost * unitsHeld)) * 100,
                            List.of()
                    );
                },
                id(userId),
                marketCode
        );
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

    private String normalizeMarketCode(String market) {
        return "us".equalsIgnoreCase(market) ? "US" : "TH";
    }

    private UUID ensureUsStockAccount(PortfolioMetadataRepository.UserRecord user, String currencyCode) {
        List<String> existing = jdbcTemplate.query("""
                        SELECT id
                        FROM accounts
                        WHERE user_id = ?
                          AND external_ref = ?
                        LIMIT 1
                        """,
                (rs, rowNum) -> rs.getString("id"),
                id(user.id()),
                "us-stocks"
        );
        if (!existing.isEmpty()) {
            return UUID.fromString(existing.get(0));
        }

        UUID institutionId = referenceDataService.upsertInstitution("User US Stocks", "BROKER", "US", currencyCode);
        UUID accountId = UUID.randomUUID();
        jdbcTemplate.update("""
                INSERT INTO accounts
                    (id, user_id, institution_id, account_name, account_number, asset_category_id, base_currency_id,
                     market_id, notes, external_ref, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                accountId.toString(),
                id(user.id()),
                institutionId.toString(),
                "US Stocks",
                null,
                referenceDataService.assetCategoryId("STOCK").toString(),
                referenceDataService.currencyId(currencyCode).toString(),
                referenceDataService.marketId("US").toString(),
                "Created from stock tracker",
                "us-stocks",
                true
        );
        return accountId;
    }

    private UUID ensureInstrument(PortfolioMetadataRepository.UserRecord user, AddHoldingRequest request) {
        String symbol = request.symbol().toUpperCase(Locale.ROOT);
        List<String> existing = jdbcTemplate.query("""
                        SELECT id
                        FROM instruments
                        WHERE owner_user_id = ?
                          AND ticker = ?
                        LIMIT 1
                        """,
                (rs, rowNum) -> rs.getString("id"),
                id(user.id()),
                symbol
        );
        if (!existing.isEmpty()) {
            return UUID.fromString(existing.get(0));
        }

        UUID instrumentId = UUID.randomUUID();
        String assetCategoryCode = "ETF".equalsIgnoreCase(request.type()) ? "MUTUAL_FUND" : "STOCK";
        jdbcTemplate.update("""
                INSERT INTO instruments
                    (id, owner_user_id, asset_category_id, market_id, exchange_id, ticker, name, isin, currency_id,
                     is_active, metadata_json, external_ref, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                instrumentId.toString(),
                id(user.id()),
                referenceDataService.assetCategoryId(assetCategoryCode).toString(),
                referenceDataService.marketId("US").toString(),
                referenceDataService.exchangeId("NASDAQ").toString(),
                symbol,
                request.name(),
                null,
                referenceDataService.currencyId(request.currency()).toString(),
                true,
                "{\"source\":\"manual-add-holding\"}",
                symbol.toLowerCase(Locale.ROOT)
        );
        return instrumentId;
    }

    private void insertBuyTransaction(PortfolioMetadataRepository.UserRecord user,
                                      UUID accountId,
                                      UUID instrumentId,
                                      AddHoldingRequest request) {
        jdbcTemplate.update("""
                INSERT INTO transactions
                    (id, user_id, account_id, instrument_id, transaction_type_id, trade_date, settlement_date,
                     payment_date, ex_date, units, price_per_unit, gross_amount, gross_currency_id,
                     exchange_rate_to_account, exchange_rate_to_base, notes, source_type, source_ref, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                UUID.randomUUID().toString(),
                id(user.id()),
                accountId.toString(),
                instrumentId.toString(),
                referenceDataService.transactionTypeId("BUY").toString(),
                Date.valueOf(request.purchaseDate()),
                Date.valueOf(request.purchaseDate()),
                null,
                null,
                request.quantity(),
                request.purchasePrice(),
                request.purchasePrice() * request.quantity(),
                referenceDataService.currencyId(request.currency()).toString(),
                null,
                null,
                "Added from stock tracker",
                "MANUAL",
                request.symbol().toUpperCase(Locale.ROOT) + ":" + request.purchaseDate()
        );
    }

    private void upsertHolding(PortfolioMetadataRepository.UserRecord user,
                               UUID accountId,
                               UUID instrumentId,
                               AddHoldingRequest request) {
        List<HoldingRow> existing = jdbcTemplate.query("""
                        SELECT account_id, instrument_id, units_held, avg_cost_per_unit, invested_amount,
                               realized_pnl, dividends_received, market_value
                        FROM holdings
                        WHERE user_id = ?
                          AND account_id = ?
                          AND instrument_id = ?
                        LIMIT 1
                        """,
                (rs, rowNum) -> new HoldingRow(
                        parseUuid(rs.getString("account_id")),
                        parseUuid(rs.getString("instrument_id")),
                        request.symbol().toUpperCase(Locale.ROOT),
                        request.name(),
                        "ETF".equalsIgnoreCase(request.type()) ? "MUTUAL_FUND" : "STOCK",
                        request.currency(),
                        rs.getDouble("units_held"),
                        rs.getDouble("avg_cost_per_unit"),
                        rs.getDouble("invested_amount")
                ),
                id(user.id()),
                accountId.toString(),
                instrumentId.toString()
        );

        double purchaseAmount = request.purchasePrice() * request.quantity();
        String currencyId = referenceDataService.currencyId(request.currency()).toString();
        if (existing.isEmpty()) {
            jdbcTemplate.update("""
                    INSERT INTO holdings
                        (id, user_id, account_id, instrument_id, units_held, avg_cost_per_unit, invested_amount,
                         invested_currency_id, realized_pnl, dividends_received, market_value, market_value_currency_id,
                         last_recomputed_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """,
                    UUID.randomUUID().toString(),
                    id(user.id()),
                    accountId.toString(),
                    instrumentId.toString(),
                    request.quantity(),
                    request.purchasePrice(),
                    purchaseAmount,
                    currencyId,
                    0,
                    0,
                    purchaseAmount,
                    currencyId
            );
            return;
        }

        HoldingRow row = existing.get(0);
        double newUnits = row.unitsHeld() + request.quantity();
        double newInvested = row.investedAmount() + purchaseAmount;
        double newAverageCost = newUnits == 0 ? 0 : newInvested / newUnits;
        jdbcTemplate.update("""
                UPDATE holdings
                SET units_held = ?,
                    avg_cost_per_unit = ?,
                    invested_amount = ?,
                    market_value = ?,
                    last_recomputed_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
                  AND account_id = ?
                  AND instrument_id = ?
                """,
                newUnits,
                newAverageCost,
                newInvested,
                newUnits * request.purchasePrice(),
                id(user.id()),
                accountId.toString(),
                instrumentId.toString()
        );
    }

    private void upsertYearlySummary(PortfolioMetadataRepository.UserRecord user,
                                     UUID accountId,
                                     UUID instrumentId,
                                     AddHoldingRequest request) {
        int year = request.purchaseDate().getYear();
        double purchaseAmount = request.purchasePrice() * request.quantity();
        String currencyId = referenceDataService.currencyId(request.currency()).toString();
        int updated = jdbcTemplate.update("""
                UPDATE instrument_yearly_summaries
                SET total_buy_amount = total_buy_amount + ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
                  AND account_id = ?
                  AND instrument_id = ?
                  AND summary_year = ?
                """,
                purchaseAmount,
                id(user.id()),
                accountId.toString(),
                instrumentId.toString(),
                year
        );
        if (updated == 0) {
            jdbcTemplate.update("""
                    INSERT INTO instrument_yearly_summaries
                        (id, user_id, account_id, instrument_id, summary_year, total_buy_amount, total_sell_amount,
                         total_dividend_amount, realized_gain_loss, currency_id, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    """,
                    UUID.randomUUID().toString(),
                    id(user.id()),
                    accountId.toString(),
                    instrumentId.toString(),
                    year,
                    purchaseAmount,
                    0,
                    0,
                    0,
                    currencyId
            );
        }
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

    private static final class AggregateCandle {
        private double open;
        private double high;
        private double low;
        private double close;
    }

    private record HoldingRow(UUID accountId,
                              UUID instrumentId,
                              String symbol,
                              String name,
                              String assetCategoryCode,
                              String currencyCode,
                              double unitsHeld,
                              double avgCostPerUnit,
                              double investedAmount) {
    }
}
