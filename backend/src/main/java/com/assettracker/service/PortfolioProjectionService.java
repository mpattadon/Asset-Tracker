package com.assettracker.service;

import com.assettracker.model.document.CanonicalPortfolioDocument;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class PortfolioProjectionService {

    private final JdbcTemplate jdbcTemplate;
    private final ReferenceDataService referenceDataService;

    public PortfolioProjectionService(JdbcTemplate jdbcTemplate, ReferenceDataService referenceDataService) {
        this.jdbcTemplate = jdbcTemplate;
        this.referenceDataService = referenceDataService;
    }

    @Transactional
    public void rebuild(PortfolioMetadataRepository.UserRecord user, CanonicalPortfolioDocument document) {
        clearUserProjection(user.id());
        insertAccounts(user, safeList(document.accounts()));
        insertInstruments(user, safeList(document.instruments()));
        insertTransactions(user, safeList(document.transactions()));
        insertBankSnapshots(user, safeList(document.bankBalanceSnapshots()));
        insertLotteryEntries(user, safeList(document.lotteryEntries()));
        insertMutualFundSnapshots(user, safeList(document.mutualFundSnapshots()));
        insertBondCoupons(user, safeList(document.bondCouponSchedules()));
        insertOptionDetails(user, safeList(document.optionContractDetails()));
        insertExpenses(user, safeList(document.expenseItems()));
        insertDerivedData(user, document.derived());
        recomputeHoldingsAndSummaries(user, document);
    }

    private void clearUserProjection(UUID userId) {
        String userIdValue = userId.toString();
        jdbcTemplate.update("DELETE FROM import_rows WHERE import_id IN (SELECT id FROM imports WHERE user_id = ?)", userIdValue);
        jdbcTemplate.update("DELETE FROM imports WHERE user_id = ?", userIdValue);
        jdbcTemplate.update("DELETE FROM expense_items WHERE user_id = ?", userIdValue);
        jdbcTemplate.update("DELETE FROM option_contract_details WHERE user_id = ?", userIdValue);
        jdbcTemplate.update("DELETE FROM bond_coupon_schedules WHERE user_id = ?", userIdValue);
        jdbcTemplate.update("DELETE FROM mutual_fund_monthly_snapshots WHERE user_id = ?", userIdValue);
        jdbcTemplate.update("DELETE FROM lottery_entries WHERE user_id = ?", userIdValue);
        jdbcTemplate.update("DELETE FROM bank_balance_snapshots WHERE user_id = ?", userIdValue);
        jdbcTemplate.update("DELETE FROM instrument_yearly_summaries WHERE user_id = ?", userIdValue);
        jdbcTemplate.update("DELETE FROM portfolio_snapshots WHERE user_id = ?", userIdValue);
        jdbcTemplate.update("DELETE FROM holdings WHERE user_id = ?", userIdValue);
        jdbcTemplate.update("DELETE FROM cash_flows WHERE transaction_id IN (SELECT id FROM transactions WHERE user_id = ?)", userIdValue);
        jdbcTemplate.update("DELETE FROM transaction_charges WHERE transaction_id IN (SELECT id FROM transactions WHERE user_id = ?)", userIdValue);
        jdbcTemplate.update("DELETE FROM transactions WHERE user_id = ?", userIdValue);
        jdbcTemplate.update("DELETE FROM instrument_aliases WHERE instrument_id IN (SELECT id FROM instruments WHERE owner_user_id = ?)", userIdValue);
        jdbcTemplate.update("DELETE FROM market_prices WHERE instrument_id IN (SELECT id FROM instruments WHERE owner_user_id = ?)", userIdValue);
        jdbcTemplate.update("DELETE FROM instruments WHERE owner_user_id = ?", userIdValue);
        jdbcTemplate.update("DELETE FROM accounts WHERE user_id = ?", userIdValue);
    }

    private void insertAccounts(PortfolioMetadataRepository.UserRecord user,
                                List<CanonicalPortfolioDocument.DocumentAccount> accounts) {
        for (CanonicalPortfolioDocument.DocumentAccount account : accounts) {
            UUID institutionId = referenceDataService.upsertInstitution(
                    account.institutionName(),
                    account.institutionType(),
                    account.marketCode(),
                    account.baseCurrencyCode()
            );
            jdbcTemplate.update("""
                    INSERT INTO accounts
                        (id, user_id, institution_id, account_name, account_number, asset_category_id, base_currency_id,
                         market_id, notes, external_ref, is_active, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """,
                    uuid(account.id()),
                    id(user.id()),
                    id(institutionId),
                    account.accountName(),
                    account.accountNumber(),
                    id(referenceDataService.assetCategoryId(account.assetCategoryCode())),
                    nullableCurrency(account.baseCurrencyCode()),
                    id(referenceDataService.marketId(account.marketCode())),
                    account.notes(),
                    account.externalRef(),
                    account.active()
            );
        }
    }

    private void insertInstruments(PortfolioMetadataRepository.UserRecord user,
                                   List<CanonicalPortfolioDocument.DocumentInstrument> instruments) {
        for (CanonicalPortfolioDocument.DocumentInstrument instrument : instruments) {
            jdbcTemplate.update("""
                    INSERT INTO instruments
                        (id, owner_user_id, asset_category_id, market_id, exchange_id, ticker, name, isin, currency_id,
                         is_active, metadata_json, external_ref, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """,
                    uuid(instrument.id()),
                    id(user.id()),
                    id(referenceDataService.assetCategoryId(instrument.assetCategoryCode())),
                    id(referenceDataService.marketId(instrument.marketCode())),
                    id(referenceDataService.exchangeId(instrument.exchangeCode())),
                    instrument.ticker(),
                    instrument.name(),
                    instrument.isin(),
                    nullableCurrency(instrument.currencyCode()),
                    instrument.active(),
                    JsonHelper.toJson(instrument.metadata()),
                    instrument.externalRef()
            );
            for (CanonicalPortfolioDocument.DocumentInstrumentAlias alias : safeList(instrument.aliases())) {
                jdbcTemplate.update("""
                        INSERT INTO instrument_aliases (id, instrument_id, provider_name, symbol, is_primary, created_at)
                        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                        """,
                        UUID.randomUUID().toString(),
                        uuid(instrument.id()),
                        alias.providerName(),
                        alias.symbol(),
                        alias.primary()
                );
            }
        }
    }

    private void insertTransactions(PortfolioMetadataRepository.UserRecord user,
                                    List<CanonicalPortfolioDocument.DocumentTransaction> transactions) {
        for (CanonicalPortfolioDocument.DocumentTransaction transaction : transactions) {
            jdbcTemplate.update("""
                    INSERT INTO transactions
                        (id, user_id, account_id, instrument_id, transaction_type_id, trade_date, settlement_date,
                         payment_date, ex_date, units, price_per_unit, gross_amount, gross_currency_id,
                         exchange_rate_to_account, exchange_rate_to_base, notes, source_type, source_ref, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """,
                    uuid(transaction.id()),
                    id(user.id()),
                    uuid(transaction.accountId()),
                    nullableUuid(transaction.instrumentId()),
                    id(referenceDataService.transactionTypeId(transaction.transactionTypeCode())),
                    localDate(transaction.tradeDate()),
                    localDate(transaction.settlementDate()),
                    localDate(transaction.paymentDate()),
                    localDate(transaction.exDate()),
                    transaction.units(),
                    transaction.pricePerUnit(),
                    transaction.grossAmount(),
                    nullableCurrency(transaction.grossCurrencyCode()),
                    transaction.exchangeRateToAccount(),
                    transaction.exchangeRateToBase(),
                    transaction.notes(),
                    transaction.sourceType(),
                    transaction.sourceRef()
            );
            for (CanonicalPortfolioDocument.DocumentTransactionCharge charge : safeList(transaction.charges())) {
                jdbcTemplate.update("""
                        INSERT INTO transaction_charges
                            (id, transaction_id, charge_type, amount, currency_id, is_inclusive, notes, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                        """,
                        uuidOrRandom(charge.id()),
                        uuid(transaction.id()),
                        charge.chargeType(),
                        charge.amount(),
                        nullableCurrency(charge.currencyCode()),
                        charge.inclusive(),
                        charge.notes()
                );
            }
            if (transaction.cashFlow() != null) {
                CanonicalPortfolioDocument.DocumentCashFlow cashFlow = transaction.cashFlow();
                jdbcTemplate.update("""
                        INSERT INTO cash_flows
                            (id, transaction_id, cash_flow_type, gross_amount, gross_currency_id, tax_amount, tax_currency_id,
                             net_amount, net_currency_id, units_entitled, amount_per_unit, tax_already_deducted,
                             created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        """,
                        uuidOrRandom(cashFlow.id()),
                        uuid(transaction.id()),
                        cashFlow.cashFlowType(),
                        cashFlow.grossAmount(),
                        nullableCurrency(cashFlow.grossCurrencyCode()),
                        cashFlow.taxAmount(),
                        nullableCurrency(cashFlow.taxCurrencyCode()),
                        cashFlow.netAmount(),
                        nullableCurrency(cashFlow.netCurrencyCode()),
                        cashFlow.unitsEntitled(),
                        cashFlow.amountPerUnit(),
                        cashFlow.taxAlreadyDeducted()
                );
            }
        }
    }

    private void insertBankSnapshots(PortfolioMetadataRepository.UserRecord user,
                                     List<CanonicalPortfolioDocument.DocumentBankBalanceSnapshot> snapshots) {
        for (CanonicalPortfolioDocument.DocumentBankBalanceSnapshot snapshot : snapshots) {
            jdbcTemplate.update("""
                    INSERT INTO bank_balance_snapshots
                        (id, user_id, account_id, snapshot_date, bank_name, balance, currency_id, change_text, notes, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    """,
                    uuid(snapshot.id()),
                    id(user.id()),
                    nullableUuid(snapshot.accountId()),
                    localDate(snapshot.snapshotDate()),
                    snapshot.bankName(),
                    snapshot.balance(),
                    nullableCurrency(snapshot.currencyCode()),
                    snapshot.changeText(),
                    snapshot.notes()
            );
        }
    }

    private void insertLotteryEntries(PortfolioMetadataRepository.UserRecord user,
                                      List<CanonicalPortfolioDocument.DocumentLotteryEntry> entries) {
        for (CanonicalPortfolioDocument.DocumentLotteryEntry entry : entries) {
            jdbcTemplate.update("""
                    INSERT INTO lottery_entries
                        (id, user_id, draw_name, tickets, committed_amount, committed_currency_id, estimated_payout, notes, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    """,
                    uuid(entry.id()),
                    id(user.id()),
                    entry.drawName(),
                    entry.tickets(),
                    defaultNumber(entry.committedAmount()),
                    nullableCurrency(entry.committedCurrencyCode()),
                    entry.estimatedPayout(),
                    entry.notes()
            );
        }
    }

    private void insertMutualFundSnapshots(PortfolioMetadataRepository.UserRecord user,
                                           List<CanonicalPortfolioDocument.DocumentMutualFundSnapshot> snapshots) {
        for (CanonicalPortfolioDocument.DocumentMutualFundSnapshot snapshot : snapshots) {
            jdbcTemplate.update("""
                    INSERT INTO mutual_fund_monthly_snapshots
                        (id, user_id, account_id, instrument_id, snapshot_date, nav, currency_id, exposure, change_text, notes, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    """,
                    uuid(snapshot.id()),
                    id(user.id()),
                    nullableUuid(snapshot.accountId()),
                    nullableUuid(snapshot.instrumentId()),
                    localDate(snapshot.snapshotDate()),
                    defaultNumber(snapshot.nav()),
                    nullableCurrency(snapshot.currencyCode()),
                    snapshot.exposure(),
                    snapshot.changeText(),
                    snapshot.notes()
            );
        }
    }

    private void insertBondCoupons(PortfolioMetadataRepository.UserRecord user,
                                   List<CanonicalPortfolioDocument.DocumentBondCouponSchedule> coupons) {
        for (CanonicalPortfolioDocument.DocumentBondCouponSchedule coupon : coupons) {
            jdbcTemplate.update("""
                    INSERT INTO bond_coupon_schedules
                        (id, user_id, account_id, instrument_id, coupon_date, amount, currency_id, notes, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    """,
                    uuid(coupon.id()),
                    id(user.id()),
                    nullableUuid(coupon.accountId()),
                    nullableUuid(coupon.instrumentId()),
                    localDate(coupon.couponDate()),
                    defaultNumber(coupon.amount()),
                    nullableCurrency(coupon.currencyCode()),
                    coupon.notes()
            );
        }
    }

    private void insertOptionDetails(PortfolioMetadataRepository.UserRecord user,
                                     List<CanonicalPortfolioDocument.DocumentOptionContractDetail> optionDetails) {
        for (CanonicalPortfolioDocument.DocumentOptionContractDetail detail : optionDetails) {
            jdbcTemplate.update("""
                    INSERT INTO option_contract_details
                        (id, user_id, account_id, instrument_id, contract_type, strike_price, expiry_date, underlying_symbol, notes, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    """,
                    uuid(detail.id()),
                    id(user.id()),
                    nullableUuid(detail.accountId()),
                    nullableUuid(detail.instrumentId()),
                    detail.contractType(),
                    detail.strikePrice(),
                    localDate(detail.expiryDate()),
                    detail.underlyingSymbol(),
                    detail.notes()
            );
        }
    }

    private void insertExpenses(PortfolioMetadataRepository.UserRecord user,
                                List<CanonicalPortfolioDocument.DocumentExpenseItem> expenseItems) {
        for (CanonicalPortfolioDocument.DocumentExpenseItem item : expenseItems) {
            jdbcTemplate.update("""
                    INSERT INTO expense_items
                        (id, user_id, expense_frequency, name, amount, currency_id, renewal_text, runway_text, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """,
                    uuid(item.id()),
                    id(user.id()),
                    item.expenseFrequency(),
                    item.name(),
                    defaultNumber(item.amount()),
                    nullableCurrency(item.currencyCode()),
                    item.renewalText(),
                    item.runwayText()
            );
        }
    }

    private void insertDerivedData(PortfolioMetadataRepository.UserRecord user,
                                   CanonicalPortfolioDocument.DerivedSections derived) {
        if (derived == null) {
            return;
        }
        for (CanonicalPortfolioDocument.DocumentMarketPrice marketPrice : safeList(derived.marketPrices())) {
            jdbcTemplate.update("""
                    INSERT INTO market_prices
                        (id, instrument_id, price_date, open_price, high_price, low_price, close_price, adjusted_close_price,
                         currency_id, volume, source_name, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    """,
                    UUID.randomUUID().toString(),
                    uuid(marketPrice.instrumentId()),
                    localDate(marketPrice.priceDate()),
                    marketPrice.openPrice(),
                    marketPrice.highPrice(),
                    marketPrice.lowPrice(),
                    defaultNumber(marketPrice.closePrice()),
                    marketPrice.adjustedClosePrice(),
                    nullableCurrency(marketPrice.currencyCode()),
                    marketPrice.volume(),
                    marketPrice.sourceName()
            );
        }
        for (CanonicalPortfolioDocument.DocumentFxRate fxRate : safeList(derived.fxRates())) {
            jdbcTemplate.update("""
                    INSERT INTO fx_rates
                        (id, base_currency_id, quote_currency_id, rate_date, rate, source_name, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    """,
                    UUID.randomUUID().toString(),
                    id(referenceDataService.currencyId(fxRate.baseCurrencyCode())),
                    id(referenceDataService.currencyId(fxRate.quoteCurrencyCode())),
                    localDate(fxRate.rateDate()),
                    defaultNumber(fxRate.rate()),
                    fxRate.sourceName()
            );
        }
        for (CanonicalPortfolioDocument.DocumentPortfolioSnapshot snapshot : safeList(derived.portfolioSnapshots())) {
            jdbcTemplate.update("""
                    INSERT INTO portfolio_snapshots
                        (id, user_id, account_id, instrument_id, snapshot_date, market_value, market_value_currency_id,
                         invested_value, dividend_total, unrealized_gain_loss, notes, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    """,
                    uuid(snapshot.id()),
                    id(user.id()),
                    nullableUuid(snapshot.accountId()),
                    nullableUuid(snapshot.instrumentId()),
                    localDate(snapshot.snapshotDate()),
                    defaultNumber(snapshot.marketValue()),
                    nullableCurrency(snapshot.marketValueCurrencyCode()),
                    snapshot.investedValue(),
                    snapshot.dividendTotal(),
                    snapshot.unrealizedGainLoss(),
                    snapshot.notes()
            );
        }
        for (CanonicalPortfolioDocument.DocumentInstrumentYearlySummary summary : safeList(derived.instrumentYearlySummaries())) {
            jdbcTemplate.update("""
                    INSERT INTO instrument_yearly_summaries
                        (id, user_id, account_id, instrument_id, summary_year, total_buy_amount, total_sell_amount,
                         total_dividend_amount, realized_gain_loss, currency_id, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    """,
                    uuid(summary.id()),
                    id(user.id()),
                    nullableUuid(summary.accountId()),
                    uuid(summary.instrumentId()),
                    summary.year(),
                    defaultNumber(summary.totalBuyAmount()),
                    defaultNumber(summary.totalSellAmount()),
                    defaultNumber(summary.totalDividendAmount()),
                    defaultNumber(summary.realizedGainLoss()),
                    nullableCurrency(summary.currencyCode())
            );
        }
    }

    private void recomputeHoldingsAndSummaries(PortfolioMetadataRepository.UserRecord user,
                                               CanonicalPortfolioDocument document) {
        Map<String, RunningHolding> runningHoldings = new HashMap<>();
        for (CanonicalPortfolioDocument.DocumentTransaction transaction : safeList(document.transactions()).stream()
                .sorted(Comparator.comparing(this::transactionSortDate))
                .toList()) {
            if (transaction.instrumentId() == null || transaction.accountId() == null) {
                continue;
            }
            String key = transaction.accountId() + ":" + transaction.instrumentId();
            RunningHolding runningHolding = runningHoldings.computeIfAbsent(key, ignored -> new RunningHolding(
                    transaction.accountId(),
                    transaction.instrumentId(),
                    transaction.grossCurrencyCode()
            ));
            String typeCode = transaction.transactionTypeCode().toUpperCase(Locale.ROOT);
            double units = defaultNumber(transaction.units());
            double price = defaultNumber(transaction.pricePerUnit());
            double grossAmount = defaultNumber(transaction.grossAmount());
            double totalCharges = safeList(transaction.charges()).stream()
                    .mapToDouble(charge -> defaultNumber(charge.amount()))
                    .sum();

            switch (typeCode) {
                case "BUY" -> runningHolding.buy(units, price, grossAmount + totalCharges);
                case "SELL" -> runningHolding.sell(units, price, totalCharges);
                case "DIVIDEND" -> runningHolding.dividend(transaction.cashFlow() == null
                        ? grossAmount
                        : defaultNumber(transaction.cashFlow().netAmount()));
                default -> {
                    // Ignore unsupported synthetic transaction types for current holdings.
                }
            }
        }

        Map<String, YearlySummaryAccumulator> yearly = new HashMap<>();
        for (CanonicalPortfolioDocument.DocumentTransaction transaction : safeList(document.transactions())) {
            if (transaction.instrumentId() == null || transaction.accountId() == null) {
                continue;
            }
            LocalDate yearDate = transactionSortDate(transaction);
            int year = yearDate.getYear();
            String key = transaction.accountId() + ":" + transaction.instrumentId() + ":" + year;
            YearlySummaryAccumulator accumulator = yearly.computeIfAbsent(key, ignored ->
                    new YearlySummaryAccumulator(transaction.accountId(), transaction.instrumentId(), year,
                            transaction.grossCurrencyCode()));
            String typeCode = transaction.transactionTypeCode().toUpperCase(Locale.ROOT);
            double grossAmount = defaultNumber(transaction.grossAmount());
            switch (typeCode) {
                case "BUY" -> accumulator.totalBuyAmount += grossAmount;
                case "SELL" -> accumulator.totalSellAmount += grossAmount;
                case "DIVIDEND" -> accumulator.totalDividendAmount += transaction.cashFlow() == null
                        ? grossAmount
                        : defaultNumber(transaction.cashFlow().netAmount());
                default -> {
                }
            }
        }

        Instant now = Instant.now();
        for (RunningHolding holding : runningHoldings.values()) {
            if (holding.unitsHeld <= 0) {
                continue;
            }
            jdbcTemplate.update("""
                    INSERT INTO holdings
                        (id, user_id, account_id, instrument_id, units_held, avg_cost_per_unit, invested_amount,
                         invested_currency_id, realized_pnl, dividends_received, market_value, market_value_currency_id,
                         last_recomputed_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    UUID.randomUUID().toString(),
                    id(user.id()),
                    uuid(holding.accountId),
                    uuid(holding.instrumentId),
                    holding.unitsHeld,
                    holding.averageCost(),
                    holding.investedAmount(),
                    nullableCurrency(holding.currencyCode),
                    holding.realizedPnl,
                    holding.dividendsReceived,
                    holding.marketValue,
                    nullableCurrency(holding.currencyCode),
                    Timestamp.from(now),
                    Timestamp.from(now)
            );
        }

        for (YearlySummaryAccumulator accumulator : yearly.values()) {
            jdbcTemplate.update("""
                    INSERT INTO instrument_yearly_summaries
                        (id, user_id, account_id, instrument_id, summary_year, total_buy_amount, total_sell_amount,
                         total_dividend_amount, realized_gain_loss, currency_id, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    """,
                    UUID.randomUUID().toString(),
                    id(user.id()),
                    nullableUuid(accumulator.accountId),
                    uuid(accumulator.instrumentId),
                    accumulator.year,
                    accumulator.totalBuyAmount,
                    accumulator.totalSellAmount,
                    accumulator.totalDividendAmount,
                    accumulator.realizedGainLoss,
                    nullableCurrency(accumulator.currencyCode)
            );
        }
    }

    private LocalDate transactionSortDate(CanonicalPortfolioDocument.DocumentTransaction transaction) {
        if (transaction.tradeDate() != null) {
            return LocalDate.parse(transaction.tradeDate());
        }
        if (transaction.paymentDate() != null) {
            return LocalDate.parse(transaction.paymentDate());
        }
        return LocalDate.now();
    }

    private String nullableCurrency(String currencyCode) {
        return currencyCode == null || currencyCode.isBlank() ? null : id(referenceDataService.currencyId(currencyCode));
    }

    private String id(UUID value) {
        return value == null ? null : value.toString();
    }

    private String nullableUuid(String raw) {
        return raw == null || raw.isBlank() ? null : UUID.fromString(raw).toString();
    }

    private String uuid(String raw) {
        return UUID.fromString(raw).toString();
    }

    private String uuidOrRandom(String raw) {
        return raw == null || raw.isBlank() ? UUID.randomUUID().toString() : UUID.fromString(raw).toString();
    }

    private Date localDate(String raw) {
        return raw == null || raw.isBlank() ? null : Date.valueOf(LocalDate.parse(raw));
    }

    private double defaultNumber(Double value) {
        return value == null ? 0 : value;
    }

    private <T> List<T> safeList(List<T> values) {
        return values == null ? List.of() : values;
    }

    private static class RunningHolding {
        private final String accountId;
        private final String instrumentId;
        private final String currencyCode;
        private double unitsHeld;
        private double totalCost;
        private double realizedPnl;
        private double dividendsReceived;
        private double marketValue;

        private RunningHolding(String accountId, String instrumentId, String currencyCode) {
            this.accountId = accountId;
            this.instrumentId = instrumentId;
            this.currencyCode = currencyCode;
        }

        private void buy(double units, double price, double grossAmount) {
            if (units <= 0) {
                return;
            }
            unitsHeld += units;
            totalCost += grossAmount > 0 ? grossAmount : units * price;
            marketValue = unitsHeld * price;
        }

        private void sell(double units, double price, double charges) {
            if (units <= 0 || unitsHeld <= 0) {
                return;
            }
            double averageCost = averageCost();
            double unitsToSell = Math.min(units, unitsHeld);
            double proceeds = (unitsToSell * price) - charges;
            realizedPnl += proceeds - (unitsToSell * averageCost);
            unitsHeld -= unitsToSell;
            totalCost -= unitsToSell * averageCost;
            marketValue = unitsHeld * price;
        }

        private void dividend(double amount) {
            dividendsReceived += amount;
        }

        private double averageCost() {
            return unitsHeld <= 0 ? 0 : totalCost / unitsHeld;
        }

        private double investedAmount() {
            return totalCost;
        }
    }

    private static class YearlySummaryAccumulator {
        private final String accountId;
        private final String instrumentId;
        private final int year;
        private final String currencyCode;
        private double totalBuyAmount;
        private double totalSellAmount;
        private double totalDividendAmount;
        private double realizedGainLoss;

        private YearlySummaryAccumulator(String accountId, String instrumentId, int year, String currencyCode) {
            this.accountId = accountId;
            this.instrumentId = instrumentId;
            this.year = year;
            this.currencyCode = currencyCode;
        }
    }

    private static final class JsonHelper {
        private JsonHelper() {
        }

        private static String toJson(Map<String, Object> metadata) {
            if (metadata == null || metadata.isEmpty()) {
                return "{}";
            }
            StringBuilder builder = new StringBuilder("{");
            boolean first = true;
            for (Map.Entry<String, Object> entry : metadata.entrySet()) {
                if (!first) {
                    builder.append(",");
                }
                builder.append("\"").append(entry.getKey().replace("\"", "\\\"")).append("\":");
                Object value = entry.getValue();
                if (value instanceof Number || value instanceof Boolean) {
                    builder.append(value);
                } else {
                    builder.append("\"").append(String.valueOf(value).replace("\"", "\\\"")).append("\"");
                }
                first = false;
            }
            builder.append("}");
            return builder.toString();
        }
    }
}
