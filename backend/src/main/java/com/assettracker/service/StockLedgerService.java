package com.assettracker.service;

import com.assettracker.model.AddHoldingRequest;
import com.assettracker.model.CreateStockPortfolioRequest;
import com.assettracker.model.QuoteResult;
import com.assettracker.model.StockLotView;
import com.assettracker.model.StockPortfolioView;
import com.assettracker.model.StockPositionView;
import com.assettracker.model.StockSummary;
import com.assettracker.model.StockTransactionRequest;
import com.assettracker.model.StockTransactionView;
import com.assettracker.model.StocksData;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Date;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.TreeSet;
import java.util.UUID;

@Service
public class StockLedgerService {

    private static final double EPSILON = 1e-9;

    private final JdbcTemplate jdbcTemplate;
    private final QuoteProvider quoteProvider;
    private final MarketDataProvider marketDataProvider;
    private final ReferenceDataService referenceDataService;

    public StockLedgerService(JdbcTemplate jdbcTemplate,
                              QuoteProvider quoteProvider,
                              MarketDataProvider marketDataProvider,
                              ReferenceDataService referenceDataService) {
        this.jdbcTemplate = jdbcTemplate;
        this.quoteProvider = quoteProvider;
        this.marketDataProvider = marketDataProvider;
        this.referenceDataService = referenceDataService;
    }

    public List<StockPortfolioView> listPortfolios(PortfolioMetadataRepository.UserRecord user) {
        return listPortfolioAccounts(user).stream()
                .map(account -> new StockPortfolioView(
                        account.id().toString(),
                        account.name(),
                        account.marketCode() == null ? null : marketDisplay(account.marketCode()),
                        account.currency()
                ))
                .toList();
    }

    @Transactional
    public StockPortfolioView createPortfolio(PortfolioMetadataRepository.UserRecord user,
                                              CreateStockPortfolioRequest request) {
        String name = request.name().trim();
        String currency = request.currency().trim().toUpperCase(Locale.ROOT);
        UUID institutionId = referenceDataService.upsertInstitution(
                "Portfolio Workspace",
                "BROKER",
                null,
                currency
        );
        UUID accountId = UUID.randomUUID();
        String externalRef = "stock-portfolio-" + accountId;
        jdbcTemplate.update("""
                INSERT INTO accounts
                    (id, user_id, institution_id, account_name, account_number, asset_category_id, base_currency_id,
                     market_id, notes, external_ref, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                accountId.toString(),
                id(user.id()),
                institutionId.toString(),
                name,
                null,
                referenceDataService.assetCategoryId("STOCK").toString(),
                referenceDataService.currencyId(currency).toString(),
                null,
                "Created from stock portfolio workspace",
                externalRef,
                true
        );
        return new StockPortfolioView(accountId.toString(), name, null, currency);
    }

    @Transactional
    public void deletePortfolio(PortfolioMetadataRepository.UserRecord user, String portfolioId) {
        PortfolioAccount account = requireConcretePortfolio(user, portfolioId);
        jdbcTemplate.update("DELETE FROM accounts WHERE id = ? AND user_id = ?", account.id().toString(), id(user.id()));
    }

    public List<StockPositionView> getHoldingsByPortfolio(PortfolioMetadataRepository.UserRecord user,
                                                          String portfolioId,
                                                          String preferredCurrency,
                                                          boolean sortByDayChange) {
        PortfolioAccount selectedAccount = requirePortfolioSelection(user, portfolioId);
        DerivedLedger ledger = deriveLedgerForPortfolio(user, selectedAccount == null ? null : selectedAccount.id(), null);
        List<StockPositionView> positions = new ArrayList<>();
        String targetCurrency = selectedAccount != null && selectedAccount.currency() != null && !selectedAccount.currency().isBlank()
                ? selectedAccount.currency()
                : normalizeCurrencyCode(preferredCurrency);

        for (InstrumentState state : ledger.instrumentStates.values()) {
            if (state.openUnits() <= EPSILON) {
                continue;
            }

            String marketCode = state.marketCode();
            QuoteResult quote = quoteProvider.lookup(user, state.symbol(), marketDisplay(marketCode))
                    .orElse(new QuoteResult(
                            state.symbol(),
                            state.name(),
                            marketCode,
                            state.assetType(),
                            state.currency(),
                            state.averageCost(),
                            0
                    ));

            String displayCurrency = targetCurrency == null ? state.currency() : targetCurrency;
            double conversionRate = conversionRate(user, quote.currency(), displayCurrency);
            double displayPrice = quote.price() * conversionRate;
            double investedAmount = state.investedAmount() * conversionRate;
            double value = displayPrice * state.openUnits();
            double dayGain = value * (quote.dayChangePct() / 100d);
            double totalChange = value - investedAmount;

            List<StockLotView> lots = state.openLots().stream()
                    .sorted(Comparator.comparing(OpenLot::date).reversed())
                    .map(lot -> new StockLotView(
                            lot.id().toString(),
                            lot.date().toString(),
                            roundMoney(lot.costPerUnit() * conversionRate),
                            roundUnits(lot.remainingUnits()),
                            displayPrice,
                            valueForUnits(displayPrice, lot.remainingUnits()) * (quote.dayChangePct() / 100d),
                            quote.dayChangePct(),
                            valueForUnits(displayPrice, lot.remainingUnits())
                    ))
                    .toList();

            positions.add(new StockPositionView(
                    state.symbol(),
                    state.name(),
                    marketDisplay(marketCode),
                    state.assetType(),
                    displayCurrency,
                    displayPrice,
                    roundUnits(state.openUnits()),
                    dayGain,
                    quote.dayChangePct(),
                    value,
                    totalChange,
                    investedAmount <= EPSILON ? 0 : (totalChange / investedAmount) * 100d,
                    lots
            ));
        }

        if (sortByDayChange) {
            return positions.stream()
                    .sorted(Comparator.comparingDouble(StockPositionView::dayChangePct).reversed())
                    .toList();
        }
        return positions.stream()
                .sorted(Comparator.comparing(StockPositionView::symbol))
                .toList();
    }

    public StockSummary getSummaryByPortfolio(PortfolioMetadataRepository.UserRecord user,
                                              String portfolioId,
                                              String preferredCurrency) {
        PortfolioAccount selectedAccount = requirePortfolioSelection(user, portfolioId);
        String requestedCurrency = normalizeCurrencyCode(preferredCurrency);
        List<StockPositionView> positions = getHoldingsByPortfolio(user, portfolioId, requestedCurrency, false);
        String currency = summaryCurrency(selectedAccount, positions, requestedCurrency);
        HistoricalSeriesData intradaySeries = buildPortfolioSeries(
                user,
                selectedAccount == null ? null : selectedAccount.id(),
                currency,
                "5d",
                "5m"
        );
        HistoricalSeriesData dailySeries = buildPortfolioSeries(
                user,
                selectedAccount == null ? null : selectedAccount.id(),
                currency,
                "max",
                "1d"
        );

        List<StocksData.Candlestick> intradayHistory = intradaySeries.valueBars();
        List<StocksData.Candlestick> dailyHistory = dailySeries.valueBars();
        List<StocksData.Candlestick> performanceIntradayHistory = intradaySeries.performanceBars();
        List<StocksData.Candlestick> performanceDailyHistory = dailySeries.performanceBars();
        List<StocksData.Candlestick> candles = !dailyHistory.isEmpty() ? dailyHistory : intradayHistory;

        double totalValue = !intradayHistory.isEmpty()
                ? intradayHistory.get(intradayHistory.size() - 1).close()
                : !dailyHistory.isEmpty()
                ? dailyHistory.get(dailyHistory.size() - 1).close()
                : positions.stream().mapToDouble(StockPositionView::value).sum();
        double totalChange = positions.stream().mapToDouble(StockPositionView::totalChange).sum();
        double totalCost = positions.stream().mapToDouble(position -> position.value() - position.totalChange()).sum();
        double dayChange = latestDayChange(dailyHistory, totalValue);
        List<Double> series = candles.stream().map(StocksData.Candlestick::close).toList();
        if (series.isEmpty()) {
            series = syntheticSeries(totalValue);
            candles = syntheticCandles(series);
            dailyHistory = candles;
            intradayHistory = List.of();
            performanceDailyHistory = syntheticPerformanceCandles(candles, totalCost);
            performanceIntradayHistory = List.of();
        }
        return new StockSummary(
                selectedAccount == null ? "all" : selectedAccount.id().toString(),
                selectedAccount == null ? "All Portfolios" : selectedAccount.name(),
                currency,
                totalValue,
                dayChange,
                totalValue == 0 ? 0 : (dayChange / totalValue) * 100d,
                totalChange,
                totalCost == 0 ? 0 : (totalChange / totalCost) * 100d,
                series,
                candles,
                intradayHistory,
                dailyHistory,
                performanceIntradayHistory,
                performanceDailyHistory
        );
    }

    public List<StockTransactionView> getTransactionsByPortfolio(PortfolioMetadataRepository.UserRecord user,
                                                                 String portfolioId) {
        PortfolioAccount selectedAccount = requirePortfolioSelection(user, portfolioId);
        DerivedLedger ledger = deriveLedgerForPortfolio(user, selectedAccount == null ? null : selectedAccount.id(), null);
        return ledger.transactionViews.stream()
                .sorted(Comparator.comparing(StockTransactionView::date, Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(StockTransactionView::id, Comparator.reverseOrder()))
                .toList();
    }

    @Transactional
    public StockTransactionView addTransactionByPortfolio(PortfolioMetadataRepository.UserRecord user,
                                                          String portfolioId,
                                                          StockTransactionRequest request) {
        PortfolioAccount account = requireConcretePortfolio(user, portfolioId == null ? request.portfolioId() : portfolioId);
        String marketCode = normalizeMarketCode(request.market());
        String transactionType = normalizeTransactionType(request.transactionType());
        validateRequest(transactionType, marketCode, request);

        UUID instrumentId = ensureInstrument(user, marketCode, request);
        LocalDate transactionDate = request.transactionDate();

        if ("SELL".equals(transactionType)) {
            double availableUnits = openUnitsOnOrBeforeInPortfolio(user, account.id(), request.symbol(), transactionDate);
            double quantity = defaultNumber(request.quantity());
            if (quantity > availableUnits + EPSILON) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Sell quantity exceeds open units for " + request.symbol()
                );
            }
        }

        double unitsEntitled = 0;
        if ("DIVIDEND".equals(transactionType)) {
            LocalDate entitlementDate = request.exDate() == null ? transactionDate : request.exDate();
            unitsEntitled = openUnitsOnOrBeforeInPortfolio(user, account.id(), request.symbol(), entitlementDate);
            if (unitsEntitled <= EPSILON) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "No open units entitled to dividend for " + request.symbol()
                );
            }
        }

        UUID transactionId = UUID.randomUUID();
        String currencyId = referenceDataService.currencyId(request.currency()).toString();
        String transactionTypeId = referenceDataService.transactionTypeId(transactionType).toString();
        double quantity = defaultNumber(request.quantity());
        double pricePerUnit = defaultNumber(request.pricePerUnit());
        double grossAmount = "DIVIDEND".equals(transactionType)
                ? roundMoney(unitsEntitled * defaultNumber(request.dividendPerShare()))
                : roundMoney(quantity * pricePerUnit);

        jdbcTemplate.update("""
                INSERT INTO transactions
                    (id, user_id, account_id, instrument_id, transaction_type_id, trade_date, settlement_date,
                     payment_date, ex_date, units, price_per_unit, gross_amount, gross_currency_id,
                     exchange_rate_to_account, exchange_rate_to_base, notes, source_type, source_ref, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                transactionId.toString(),
                id(user.id()),
                account.id().toString(),
                instrumentId.toString(),
                transactionTypeId,
                "DIVIDEND".equals(transactionType) ? null : Date.valueOf(transactionDate),
                "DIVIDEND".equals(transactionType) ? null : Date.valueOf(transactionDate),
                "DIVIDEND".equals(transactionType) ? Date.valueOf(transactionDate) : null,
                "DIVIDEND".equals(transactionType) && request.exDate() != null ? Date.valueOf(request.exDate()) : null,
                quantityOrNull(transactionType, quantity),
                numberOrNull(transactionType, pricePerUnit),
                grossAmount,
                currencyId,
                request.fxActualRate(),
                request.fxDimeRate(),
                "Recorded from stock ledger",
                "MANUAL",
                request.symbol().toUpperCase(Locale.ROOT) + ":" + transactionType + ":" + transactionDate
        );

        jdbcTemplate.update("""
                INSERT INTO stock_transaction_details
                    (transaction_id, fee_net_usd, fee_net_thb, fee_net_local, fee_vat_local, ats_fee_local,
                     fx_actual_rate, fx_dime_rate, withholding_tax_rate, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """,
                transactionId.toString(),
                defaultNumber(request.feeNetUsd()),
                defaultNumber(request.feeNetThb()),
                defaultNumber(request.feeNetLocal()),
                defaultNumber(request.feeVatLocal()),
                defaultNumber(request.atsFeeLocal()),
                request.fxActualRate(),
                request.fxDimeRate(),
                request.withholdingTaxRate()
        );

        if ("DIVIDEND".equals(transactionType)) {
            double dividendPerShare = defaultNumber(request.dividendPerShare());
            double grossDividend = roundMoney(unitsEntitled * dividendPerShare);
            double withholdingTaxRate = defaultNumber(request.withholdingTaxRate());
            double withholdingTaxAmount = roundMoney(grossDividend * withholdingTaxRate);
            double netDividend = roundMoney(grossDividend - withholdingTaxAmount);
            jdbcTemplate.update("""
                    INSERT INTO cash_flows
                        (id, transaction_id, cash_flow_type, gross_amount, gross_currency_id, tax_amount, tax_currency_id,
                         net_amount, net_currency_id, units_entitled, amount_per_unit, tax_already_deducted, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """,
                    UUID.randomUUID().toString(),
                    transactionId.toString(),
                    "DIVIDEND",
                    grossDividend,
                    currencyId,
                    withholdingTaxAmount,
                    currencyId,
                    netDividend,
                    currencyId,
                    unitsEntitled,
                    dividendPerShare,
                    withholdingTaxAmount > 0
            );
        }

        return getTransactionsByPortfolio(user, account.id().toString()).stream()
                .filter(view -> view.id().equals(transactionId.toString()))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.INTERNAL_SERVER_ERROR,
                        "Transaction saved but could not be reloaded"
                ));
    }

    @Transactional
    public StockTransactionView updateTransaction(PortfolioMetadataRepository.UserRecord user,
                                                  String transactionId,
                                                  StockTransactionRequest request) {
        LedgerEntry existing = requireExistingTransaction(user, transactionId);
        String transactionType = normalizeTransactionType(request.transactionType());
        String marketCode = normalizeMarketCode(request.market());

        if (!existing.transactionType().equals(transactionType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Transaction type cannot be changed");
        }
        if (!existing.symbol().equalsIgnoreCase(request.symbol())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ticker cannot be changed");
        }
        if (!existing.marketCode().equals(marketCode)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Market cannot be changed");
        }

        validateRequest(transactionType, marketCode, request);

        UUID accountId = existing.accountId();
        LocalDate transactionDate = request.transactionDate();

        if ("SELL".equals(transactionType)) {
            double availableUnits = openUnitsOnOrBeforeInPortfolioExcludingTransaction(
                    user,
                    accountId,
                    request.symbol(),
                    transactionDate,
                    existing.id()
            );
            double quantity = defaultNumber(request.quantity());
            if (quantity > availableUnits + EPSILON) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Sell quantity exceeds open units for " + request.symbol()
                );
            }
        }

        double unitsEntitled = 0;
        if ("DIVIDEND".equals(transactionType)) {
            LocalDate entitlementDate = request.exDate() == null ? transactionDate : request.exDate();
            unitsEntitled = openUnitsOnOrBeforeInPortfolioExcludingTransaction(
                    user,
                    accountId,
                    request.symbol(),
                    entitlementDate,
                    existing.id()
            );
            if (unitsEntitled <= EPSILON) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "No open units entitled to dividend for " + request.symbol()
                );
            }
        }

        String currencyId = referenceDataService.currencyId(request.currency()).toString();
        double quantity = defaultNumber(request.quantity());
        double pricePerUnit = defaultNumber(request.pricePerUnit());
        double grossAmount = "DIVIDEND".equals(transactionType)
                ? roundMoney(unitsEntitled * defaultNumber(request.dividendPerShare()))
                : roundMoney(quantity * pricePerUnit);

        jdbcTemplate.update("""
                UPDATE transactions
                SET trade_date = ?,
                    settlement_date = ?,
                    payment_date = ?,
                    ex_date = ?,
                    units = ?,
                    price_per_unit = ?,
                    gross_amount = ?,
                    gross_currency_id = ?,
                    exchange_rate_to_account = ?,
                    exchange_rate_to_base = ?,
                    source_ref = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                  AND user_id = ?
                """,
                "DIVIDEND".equals(transactionType) ? null : Date.valueOf(transactionDate),
                "DIVIDEND".equals(transactionType) ? null : Date.valueOf(transactionDate),
                "DIVIDEND".equals(transactionType) ? Date.valueOf(transactionDate) : null,
                "DIVIDEND".equals(transactionType) && request.exDate() != null ? Date.valueOf(request.exDate()) : null,
                quantityOrNull(transactionType, quantity),
                numberOrNull(transactionType, pricePerUnit),
                grossAmount,
                currencyId,
                request.fxActualRate(),
                request.fxDimeRate(),
                request.symbol().toUpperCase(Locale.ROOT) + ":" + transactionType + ":" + transactionDate,
                existing.id().toString(),
                id(user.id())
        );

        jdbcTemplate.update("""
                UPDATE stock_transaction_details
                SET fee_net_usd = ?,
                    fee_net_thb = ?,
                    fee_net_local = ?,
                    fee_vat_local = ?,
                    ats_fee_local = ?,
                    fx_actual_rate = ?,
                    fx_dime_rate = ?,
                    withholding_tax_rate = ?
                WHERE transaction_id = ?
                """,
                defaultNumber(request.feeNetUsd()),
                defaultNumber(request.feeNetThb()),
                defaultNumber(request.feeNetLocal()),
                defaultNumber(request.feeVatLocal()),
                defaultNumber(request.atsFeeLocal()),
                request.fxActualRate(),
                request.fxDimeRate(),
                request.withholdingTaxRate(),
                existing.id().toString()
        );

        if ("DIVIDEND".equals(transactionType)) {
            double dividendPerShare = defaultNumber(request.dividendPerShare());
            double grossDividend = roundMoney(unitsEntitled * dividendPerShare);
            double withholdingTaxRate = defaultNumber(request.withholdingTaxRate());
            double withholdingTaxAmount = roundMoney(grossDividend * withholdingTaxRate);
            double netDividend = roundMoney(grossDividend - withholdingTaxAmount);
            jdbcTemplate.update("""
                    UPDATE cash_flows
                    SET cash_flow_type = ?,
                        gross_amount = ?,
                        gross_currency_id = ?,
                        tax_amount = ?,
                        tax_currency_id = ?,
                        net_amount = ?,
                        net_currency_id = ?,
                        units_entitled = ?,
                        amount_per_unit = ?,
                        tax_already_deducted = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE transaction_id = ?
                    """,
                    "DIVIDEND",
                    grossDividend,
                    currencyId,
                    withholdingTaxAmount,
                    currencyId,
                    netDividend,
                    currencyId,
                    unitsEntitled,
                    dividendPerShare,
                    withholdingTaxAmount > 0,
                    existing.id().toString()
            );
        } else {
            jdbcTemplate.update("DELETE FROM cash_flows WHERE transaction_id = ?", existing.id().toString());
        }

        return getTransactionsByPortfolio(user, accountId.toString()).stream()
                .filter(view -> view.id().equals(existing.id().toString()))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.INTERNAL_SERVER_ERROR,
                        "Transaction saved but could not be reloaded"
                ));
    }

    @Transactional
    public void deleteTransaction(PortfolioMetadataRepository.UserRecord user,
                                  String transactionId) {
        LedgerEntry existing = requireExistingTransaction(user, transactionId);
        ensureDeleteAllowed(user, existing);
        jdbcTemplate.update("DELETE FROM cash_flows WHERE transaction_id = ?", existing.id().toString());
        jdbcTemplate.update("DELETE FROM stock_transaction_details WHERE transaction_id = ?", existing.id().toString());
        jdbcTemplate.update(
                "DELETE FROM transactions WHERE id = ? AND user_id = ?",
                existing.id().toString(),
                id(user.id())
        );
    }

    public List<StockPositionView> getHoldings(PortfolioMetadataRepository.UserRecord user,
                                               String market,
                                               boolean sortByDayChange) {
        String marketCode = normalizeMarketCode(market);
        DerivedLedger ledger = deriveLedger(user, marketCode);
        List<StockPositionView> positions = new ArrayList<>();

        for (InstrumentState state : ledger.instrumentStates.values()) {
            if (state.openUnits() <= EPSILON) {
                continue;
            }

            QuoteResult quote = quoteProvider.lookup(user, state.symbol(), marketDisplay(marketCode))
                    .orElse(new QuoteResult(
                            state.symbol(),
                            state.name(),
                            marketCode,
                            state.assetType(),
                            state.currency(),
                            state.averageCost(),
                            0
                    ));

            double value = quote.price() * state.openUnits();
            double dayGain = value * (quote.dayChangePct() / 100d);
            double totalChange = value - state.investedAmount();

            List<StockLotView> lots = state.openLots().stream()
                    .sorted(Comparator.comparing(OpenLot::date).reversed())
                    .map(lot -> new StockLotView(
                            lot.id().toString(),
                            lot.date().toString(),
                            roundMoney(lot.costPerUnit()),
                            roundUnits(lot.remainingUnits()),
                            quote.price(),
                            valueForUnits(quote.price(), lot.remainingUnits()) * (quote.dayChangePct() / 100d),
                            quote.dayChangePct(),
                            valueForUnits(quote.price(), lot.remainingUnits())
                    ))
                    .toList();

            positions.add(new StockPositionView(
                    state.symbol(),
                    state.name(),
                    marketDisplay(marketCode),
                    state.assetType(),
                    state.currency(),
                    quote.price(),
                    roundUnits(state.openUnits()),
                    dayGain,
                    quote.dayChangePct(),
                    value,
                    totalChange,
                    state.investedAmount() <= EPSILON ? 0 : (totalChange / state.investedAmount()) * 100d,
                    lots
            ));
        }

        if (sortByDayChange) {
            return positions.stream()
                    .sorted(Comparator.comparingDouble(StockPositionView::dayChangePct).reversed())
                    .toList();
        }
        return positions.stream()
                .sorted(Comparator.comparing(StockPositionView::symbol))
                .toList();
    }

    public StockSummary getSummary(PortfolioMetadataRepository.UserRecord user, String market) {
        List<StockPositionView> positions = getHoldings(user, market, false);
        String marketCode = normalizeMarketCode(market);
        String currency = "US".equals(marketCode) ? "USD" : "THB";
        double totalValue = positions.stream().mapToDouble(StockPositionView::value).sum();
        double dayChange = positions.stream().mapToDouble(StockPositionView::dayGain).sum();
        double totalChange = positions.stream().mapToDouble(StockPositionView::totalChange).sum();
        double totalCost = positions.stream().mapToDouble(position -> position.value() - position.totalChange()).sum();
        List<StocksData.Candlestick> intradayHistory = buildMarketCandles(user, market, positions, "60d", "5m");
        List<StocksData.Candlestick> dailyHistory = buildMarketCandles(user, market, positions, "max", "1d");
        List<StocksData.Candlestick> marketCandles = !dailyHistory.isEmpty() ? dailyHistory : intradayHistory;
        List<Double> series = marketCandles.stream().map(StocksData.Candlestick::close).toList();
        if (series.isEmpty()) {
            series = syntheticSeries(totalValue);
            marketCandles = syntheticCandles(series);
            dailyHistory = marketCandles;
            intradayHistory = List.of();
        }
        return new StockSummary(
                marketDisplay(marketCode),
                "US".equals(marketCode) ? "US Stock" : "Thai Stock",
                currency,
                totalValue,
                dayChange,
                totalValue == 0 ? 0 : (dayChange / totalValue) * 100d,
                totalChange,
                totalCost == 0 ? 0 : (totalChange / totalCost) * 100d,
                series,
                marketCandles,
                intradayHistory,
                dailyHistory,
                List.of(),
                List.of()
        );
    }

    public List<StockTransactionView> getTransactions(PortfolioMetadataRepository.UserRecord user, String market) {
        String marketCode = normalizeMarketCode(market);
        DerivedLedger ledger = deriveLedger(user, marketCode);
        return ledger.transactionViews.stream()
                .sorted(Comparator.comparing(StockTransactionView::date, Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(StockTransactionView::id, Comparator.reverseOrder()))
                .toList();
    }

    @Transactional
    public StockTransactionView addTransaction(PortfolioMetadataRepository.UserRecord user,
                                               String market,
                                               StockTransactionRequest request) {
        String marketCode = normalizeMarketCode(market);
        String transactionType = normalizeTransactionType(request.transactionType());
        validateRequest(transactionType, marketCode, request);

        UUID accountId = ensureStockAccount(user, marketCode, request.currency());
        UUID instrumentId = ensureInstrument(user, marketCode, request);
        LocalDate transactionDate = request.transactionDate();

        if ("SELL".equals(transactionType)) {
            double availableUnits = openUnitsOnOrBefore(user, marketCode, request.symbol(), transactionDate);
            double quantity = defaultNumber(request.quantity());
            if (quantity > availableUnits + EPSILON) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Sell quantity exceeds open units for " + request.symbol()
                );
            }
        }

        double unitsEntitled = 0;
        if ("DIVIDEND".equals(transactionType)) {
            LocalDate entitlementDate = request.exDate() == null ? transactionDate : request.exDate();
            unitsEntitled = openUnitsOnOrBefore(user, marketCode, request.symbol(), entitlementDate);
            if (unitsEntitled <= EPSILON) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "No open units entitled to dividend for " + request.symbol()
                );
            }
        }

        UUID transactionId = UUID.randomUUID();
        String currencyId = referenceDataService.currencyId(request.currency()).toString();
        String transactionTypeId = referenceDataService.transactionTypeId(transactionType).toString();
        double quantity = defaultNumber(request.quantity());
        double pricePerUnit = defaultNumber(request.pricePerUnit());
        double grossAmount = "DIVIDEND".equals(transactionType)
                ? roundMoney(unitsEntitled * defaultNumber(request.dividendPerShare()))
                : roundMoney(quantity * pricePerUnit);

        jdbcTemplate.update("""
                INSERT INTO transactions
                    (id, user_id, account_id, instrument_id, transaction_type_id, trade_date, settlement_date,
                     payment_date, ex_date, units, price_per_unit, gross_amount, gross_currency_id,
                     exchange_rate_to_account, exchange_rate_to_base, notes, source_type, source_ref, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                transactionId.toString(),
                id(user.id()),
                accountId.toString(),
                instrumentId.toString(),
                transactionTypeId,
                "DIVIDEND".equals(transactionType) ? null : Date.valueOf(transactionDate),
                "DIVIDEND".equals(transactionType) ? null : Date.valueOf(transactionDate),
                "DIVIDEND".equals(transactionType) ? Date.valueOf(transactionDate) : null,
                "DIVIDEND".equals(transactionType) && request.exDate() != null ? Date.valueOf(request.exDate()) : null,
                quantityOrNull(transactionType, quantity),
                numberOrNull(transactionType, pricePerUnit),
                grossAmount,
                currencyId,
                request.fxActualRate(),
                request.fxDimeRate(),
                "Recorded from stock ledger",
                "MANUAL",
                request.symbol().toUpperCase(Locale.ROOT) + ":" + transactionType + ":" + transactionDate
        );

        jdbcTemplate.update("""
                INSERT INTO stock_transaction_details
                    (transaction_id, fee_net_usd, fee_net_thb, fee_net_local, fee_vat_local, ats_fee_local,
                     fx_actual_rate, fx_dime_rate, withholding_tax_rate, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """,
                transactionId.toString(),
                defaultNumber(request.feeNetUsd()),
                defaultNumber(request.feeNetThb()),
                defaultNumber(request.feeNetLocal()),
                defaultNumber(request.feeVatLocal()),
                defaultNumber(request.atsFeeLocal()),
                request.fxActualRate(),
                request.fxDimeRate(),
                request.withholdingTaxRate()
        );

        if ("DIVIDEND".equals(transactionType)) {
            double dividendPerShare = defaultNumber(request.dividendPerShare());
            double grossDividend = roundMoney(unitsEntitled * dividendPerShare);
            double withholdingTaxRate = defaultNumber(request.withholdingTaxRate());
            double withholdingTaxAmount = roundMoney(grossDividend * withholdingTaxRate);
            double netDividend = roundMoney(grossDividend - withholdingTaxAmount);
            jdbcTemplate.update("""
                    INSERT INTO cash_flows
                        (id, transaction_id, cash_flow_type, gross_amount, gross_currency_id, tax_amount, tax_currency_id,
                         net_amount, net_currency_id, units_entitled, amount_per_unit, tax_already_deducted, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """,
                    UUID.randomUUID().toString(),
                    transactionId.toString(),
                    "DIVIDEND",
                    grossDividend,
                    currencyId,
                    withholdingTaxAmount,
                    currencyId,
                    netDividend,
                    currencyId,
                    unitsEntitled,
                    dividendPerShare,
                    withholdingTaxAmount > 0
            );
        }

        return getTransactions(user, marketCode).stream()
                .filter(view -> view.id().equals(transactionId.toString()))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.INTERNAL_SERVER_ERROR,
                        "Transaction saved but could not be reloaded"
                ));
    }

    public StockPositionView addBuyFromHoldingRequest(PortfolioMetadataRepository.UserRecord user,
                                                      String market,
                                                      AddHoldingRequest request) {
        addTransaction(user, market, new StockTransactionRequest(
                "BUY",
                request.symbol(),
                request.name(),
                request.market(),
                "US",
                null,
                request.type(),
                request.currency(),
                null,
                request.purchaseDate(),
                request.quantity(),
                request.purchasePrice(),
                0d,
                0d,
                0d,
                0d,
                0d,
                null,
                null,
                null,
                null
        ));
        return getHoldings(user, market, false).stream()
                .filter(position -> position.symbol().equalsIgnoreCase(request.symbol()))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.INTERNAL_SERVER_ERROR,
                        "Holding saved but not found"
                ));
    }

    private DerivedLedger deriveLedger(PortfolioMetadataRepository.UserRecord user, String marketCode) {
        return deriveLedger(user, marketCode, null, null);
    }

    private DerivedLedger deriveLedger(PortfolioMetadataRepository.UserRecord user,
                                       String marketCode,
                                       LocalDate throughDateInclusive) {
        return deriveLedger(user, marketCode, throughDateInclusive, null);
    }

    private DerivedLedger deriveLedger(PortfolioMetadataRepository.UserRecord user,
                                       String marketCode,
                                       LocalDate throughDateInclusive,
                                       UUID excludedTransactionId) {
        List<LedgerEntry> ledger = loadLedger(user, marketCode);
        Map<UUID, InstrumentState> states = new LinkedHashMap<>();
        List<StockTransactionView> views = new ArrayList<>();

        for (LedgerEntry entry : ledger) {
            if (excludedTransactionId != null && excludedTransactionId.equals(entry.id())) {
                continue;
            }
            if (throughDateInclusive != null && entry.date().isAfter(throughDateInclusive)) {
                continue;
            }
            InstrumentState state = states.computeIfAbsent(entry.instrumentId(), ignored -> new InstrumentState(
                    entry.instrumentId(),
                    entry.symbol(),
                    entry.name(),
                    entry.marketCode(),
                    entry.currency(),
                    entry.assetType()
            ));

            switch (entry.transactionType()) {
                case "BUY" -> {
                    double quantity = defaultNumber(entry.quantity());
                    if (quantity <= EPSILON) {
                        continue;
                    }
                    double totalUsd = grossWithFee(entry);
                    double costPerUnit = quantity <= EPSILON ? 0 : totalUsd / quantity;
                    state.openLots().addLast(new OpenLot(
                            entry.id(),
                            entry.date(),
                            quantity,
                            costPerUnit
                    ));
                    views.add(new StockTransactionView(
                            entry.id().toString(),
                            "BUY",
                            entry.date().toString(),
                            entry.symbol(),
                            entry.name(),
                            marketDisplay(marketCode),
                            entry.accountId().toString(),
                            entry.accountName(),
                            entry.assetType(),
                            entry.exDate() == null ? null : entry.exDate().toString(),
                            entry.currency(),
                            quantity,
                            entry.pricePerUnit(),
                            entry.feeNetUsd(),
                            entry.feeNetThb(),
                            entry.feeNetLocal(),
                            entry.feeVatLocal(),
                            entry.atsFeeLocal(),
                            entry.fxActualRate(),
                            entry.fxDimeRate(),
                            totalUsd,
                            multiply(totalUsd, entry.fxActualRate()),
                            totalUsd,
                            multiply(totalUsd, entry.fxDimeRate()),
                            quantity <= EPSILON ? null : totalUsd / quantity,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null
                    ));
                }
                case "SELL" -> {
                    double quantity = defaultNumber(entry.quantity());
                    if (quantity <= EPSILON) {
                        continue;
                    }
                    SellResult sellResult = consumeLots(state.openLots(), quantity, grossWithFee(entry));
                    state.realizedPnl += sellResult.realizedPnl();
                    views.add(new StockTransactionView(
                            entry.id().toString(),
                            "SELL",
                            entry.date().toString(),
                            entry.symbol(),
                            entry.name(),
                            marketDisplay(marketCode),
                            entry.accountId().toString(),
                            entry.accountName(),
                            entry.assetType(),
                            entry.exDate() == null ? null : entry.exDate().toString(),
                            entry.currency(),
                            quantity,
                            entry.pricePerUnit(),
                            entry.feeNetUsd(),
                            entry.feeNetThb(),
                            entry.feeNetLocal(),
                            entry.feeVatLocal(),
                            entry.atsFeeLocal(),
                            entry.fxActualRate(),
                            entry.fxDimeRate(),
                            grossWithFee(entry),
                            multiply(grossWithFee(entry), entry.fxActualRate()),
                            grossWithFee(entry),
                            multiply(grossWithFee(entry), entry.fxDimeRate()),
                            quantity <= EPSILON ? null : grossWithFee(entry) / quantity,
                            sellResult.realizedPnl(),
                            sellResult.costBasis() <= EPSILON ? null : (sellResult.realizedPnl() / sellResult.costBasis()) * 100d,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null
                    ));
                }
                case "DIVIDEND" -> {
                    state.dividendsReceived += defaultNumber(entry.netDividend());
                    views.add(new StockTransactionView(
                            entry.id().toString(),
                            "DIVIDEND",
                            entry.date().toString(),
                            entry.symbol(),
                            entry.name(),
                            marketDisplay(marketCode),
                            entry.accountId().toString(),
                            entry.accountName(),
                            entry.assetType(),
                            entry.exDate() == null ? null : entry.exDate().toString(),
                            entry.currency(),
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            entry.unitsEntitled(),
                            entry.dividendPerShare(),
                            entry.grossDividend(),
                            entry.withholdingTaxRate(),
                            entry.withholdingTaxAmount(),
                            entry.netDividend()
                    ));
                }
                default -> {
                }
            }
        }

        return new DerivedLedger(states, views);
    }

    private DerivedLedger deriveLedgerForPortfolio(PortfolioMetadataRepository.UserRecord user,
                                                   UUID accountId,
                                                   LocalDate throughDateInclusive) {
        return deriveLedgerForPortfolio(user, accountId, throughDateInclusive, null);
    }

    private DerivedLedger deriveLedgerForPortfolio(PortfolioMetadataRepository.UserRecord user,
                                                   UUID accountId,
                                                   LocalDate throughDateInclusive,
                                                   UUID excludedTransactionId) {
        List<LedgerEntry> ledger = loadLedgerByPortfolio(user, accountId);
        Map<UUID, InstrumentState> states = new LinkedHashMap<>();
        List<StockTransactionView> views = new ArrayList<>();

        for (LedgerEntry entry : ledger) {
            if (excludedTransactionId != null && excludedTransactionId.equals(entry.id())) {
                continue;
            }
            if (throughDateInclusive != null && entry.date().isAfter(throughDateInclusive)) {
                continue;
            }
            InstrumentState state = states.computeIfAbsent(entry.instrumentId(), ignored -> new InstrumentState(
                    entry.instrumentId(),
                    entry.symbol(),
                    entry.name(),
                    entry.marketCode(),
                    entry.currency(),
                    entry.assetType()
            ));

            switch (entry.transactionType()) {
                case "BUY" -> {
                    double quantity = defaultNumber(entry.quantity());
                    if (quantity <= EPSILON) {
                        continue;
                    }
                    double totalUsd = grossWithFee(entry);
                    double costPerUnit = quantity <= EPSILON ? 0 : totalUsd / quantity;
                    state.openLots().addLast(new OpenLot(entry.id(), entry.date(), quantity, costPerUnit));
                    views.add(new StockTransactionView(
                            entry.id().toString(),
                            "BUY",
                            entry.date().toString(),
                            entry.symbol(),
                            entry.name(),
                            marketDisplay(entry.marketCode()),
                            entry.accountId().toString(),
                            entry.accountName(),
                            entry.assetType(),
                            entry.exDate() == null ? null : entry.exDate().toString(),
                            entry.currency(),
                            quantity,
                            entry.pricePerUnit(),
                            entry.feeNetUsd(),
                            entry.feeNetThb(),
                            entry.feeNetLocal(),
                            entry.feeVatLocal(),
                            entry.atsFeeLocal(),
                            entry.fxActualRate(),
                            entry.fxDimeRate(),
                            totalUsd,
                            multiply(totalUsd, entry.fxActualRate()),
                            totalUsd,
                            multiply(totalUsd, entry.fxDimeRate()),
                            quantity <= EPSILON ? null : totalUsd / quantity,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null
                    ));
                }
                case "SELL" -> {
                    double quantity = defaultNumber(entry.quantity());
                    if (quantity <= EPSILON) {
                        continue;
                    }
                    SellResult sellResult = consumeLots(state.openLots(), quantity, grossWithFee(entry));
                    state.realizedPnl += sellResult.realizedPnl();
                    views.add(new StockTransactionView(
                            entry.id().toString(),
                            "SELL",
                            entry.date().toString(),
                            entry.symbol(),
                            entry.name(),
                            marketDisplay(entry.marketCode()),
                            entry.accountId().toString(),
                            entry.accountName(),
                            entry.assetType(),
                            entry.exDate() == null ? null : entry.exDate().toString(),
                            entry.currency(),
                            quantity,
                            entry.pricePerUnit(),
                            entry.feeNetUsd(),
                            entry.feeNetThb(),
                            entry.feeNetLocal(),
                            entry.feeVatLocal(),
                            entry.atsFeeLocal(),
                            entry.fxActualRate(),
                            entry.fxDimeRate(),
                            grossWithFee(entry),
                            multiply(grossWithFee(entry), entry.fxActualRate()),
                            grossWithFee(entry),
                            multiply(grossWithFee(entry), entry.fxDimeRate()),
                            quantity <= EPSILON ? null : grossWithFee(entry) / quantity,
                            sellResult.realizedPnl(),
                            sellResult.costBasis() <= EPSILON ? null : (sellResult.realizedPnl() / sellResult.costBasis()) * 100d,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null
                    ));
                }
                case "DIVIDEND" -> {
                    state.dividendsReceived += defaultNumber(entry.netDividend());
                    views.add(new StockTransactionView(
                            entry.id().toString(),
                            "DIVIDEND",
                            entry.date().toString(),
                            entry.symbol(),
                            entry.name(),
                            marketDisplay(entry.marketCode()),
                            entry.accountId().toString(),
                            entry.accountName(),
                            entry.assetType(),
                            entry.exDate() == null ? null : entry.exDate().toString(),
                            entry.currency(),
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            entry.unitsEntitled(),
                            entry.dividendPerShare(),
                            entry.grossDividend(),
                            entry.withholdingTaxRate(),
                            entry.withholdingTaxAmount(),
                            entry.netDividend()
                    ));
                }
                default -> {
                }
            }
        }

        return new DerivedLedger(states, views);
    }

    private List<LedgerEntry> loadLedger(PortfolioMetadataRepository.UserRecord user, String marketCode) {
        return jdbcTemplate.query("""
                        SELECT t.id, t.account_id, a.account_name, t.instrument_id, t.trade_date, t.payment_date, t.ex_date, t.units, t.price_per_unit,
                               t.gross_amount, t.created_at, tt.code AS transaction_type, i.ticker, i.name,
                               c.code AS currency_code, ac.code AS asset_category_code, sd.fee_net_usd, sd.fee_net_thb,
                               sd.fee_net_local, sd.fee_vat_local, sd.ats_fee_local,
                               COALESCE(m.code, 'TH') AS market_code,
                               sd.fx_actual_rate, sd.fx_dime_rate, sd.withholding_tax_rate,
                               cf.units_entitled, cf.amount_per_unit, cf.gross_amount AS gross_dividend,
                               cf.tax_amount, cf.net_amount
                        FROM transactions t
                        JOIN accounts a ON a.id = t.account_id
                        JOIN transaction_types tt ON tt.id = t.transaction_type_id
                        JOIN instruments i ON i.id = t.instrument_id
                        JOIN asset_categories ac ON ac.id = i.asset_category_id
                        LEFT JOIN markets m ON m.id = i.market_id
                        LEFT JOIN currencies c ON c.id = t.gross_currency_id
                        LEFT JOIN stock_transaction_details sd ON sd.transaction_id = t.id
                        LEFT JOIN cash_flows cf ON cf.transaction_id = t.id
                        WHERE t.user_id = ?
                          AND COALESCE(m.code, 'TH') = ?
                          AND ac.code IN ('STOCK', 'MUTUAL_FUND')
                          AND tt.code IN ('BUY', 'SELL', 'DIVIDEND')
                        ORDER BY COALESCE(t.trade_date, t.payment_date) ASC, t.created_at ASC, t.id ASC
                        """,
                (rs, rowNum) -> new LedgerEntry(
                        parseUuid(rs.getString("id")),
                        parseUuid(rs.getString("account_id")),
                        rs.getString("account_name"),
                        parseUuid(rs.getString("instrument_id")),
                        localDate(rs.getString("trade_date"), rs.getString("payment_date")),
                        parseLocalDate(rs.getString("ex_date")),
                        rs.getString("transaction_type"),
                        rs.getString("ticker"),
                        rs.getString("name"),
                        assetTypeForCategory(rs.getString("asset_category_code")),
                        rs.getString("market_code"),
                        rs.getString("currency_code"),
                        nullableDouble(rs, "units"),
                        nullableDouble(rs, "price_per_unit"),
                        nullableDouble(rs, "gross_amount"),
                        nullableDouble(rs, "fee_net_usd"),
                        nullableDouble(rs, "fee_net_thb"),
                        nullableDouble(rs, "fee_net_local"),
                        nullableDouble(rs, "fee_vat_local"),
                        nullableDouble(rs, "ats_fee_local"),
                        nullableDouble(rs, "fx_actual_rate"),
                        nullableDouble(rs, "fx_dime_rate"),
                        nullableDouble(rs, "withholding_tax_rate"),
                        nullableDouble(rs, "units_entitled"),
                        nullableDouble(rs, "amount_per_unit"),
                        nullableDouble(rs, "gross_dividend"),
                        nullableDouble(rs, "tax_amount"),
                        nullableDouble(rs, "net_amount"),
                        parseInstant(rs.getString("created_at"))
                ),
                id(user.id()),
                marketCode
        );
    }

    private List<LedgerEntry> loadLedgerByPortfolio(PortfolioMetadataRepository.UserRecord user, UUID accountId) {
        String sql = """
                        SELECT t.id, t.account_id, a.account_name, t.instrument_id, t.trade_date, t.payment_date, t.ex_date, t.units, t.price_per_unit,
                               t.gross_amount, t.created_at, tt.code AS transaction_type, i.ticker, i.name,
                               c.code AS currency_code, ac.code AS asset_category_code, sd.fee_net_usd, sd.fee_net_thb,
                               sd.fee_net_local, sd.fee_vat_local, sd.ats_fee_local,
                               COALESCE(m.code, 'TH') AS market_code,
                               sd.fx_actual_rate, sd.fx_dime_rate, sd.withholding_tax_rate,
                               cf.units_entitled, cf.amount_per_unit, cf.gross_amount AS gross_dividend,
                               cf.tax_amount, cf.net_amount
                        FROM transactions t
                        JOIN accounts a ON a.id = t.account_id
                        JOIN asset_categories account_category ON account_category.id = a.asset_category_id
                        JOIN transaction_types tt ON tt.id = t.transaction_type_id
                        JOIN instruments i ON i.id = t.instrument_id
                        JOIN asset_categories ac ON ac.id = i.asset_category_id
                        LEFT JOIN markets m ON m.id = i.market_id
                        LEFT JOIN currencies c ON c.id = t.gross_currency_id
                        LEFT JOIN stock_transaction_details sd ON sd.transaction_id = t.id
                        LEFT JOIN cash_flows cf ON cf.transaction_id = t.id
                        WHERE t.user_id = ?
                          AND account_category.code = 'STOCK'
                          AND ac.code IN ('STOCK', 'MUTUAL_FUND')
                          AND tt.code IN ('BUY', 'SELL', 'DIVIDEND')
                        """;
        List<Object> params = new ArrayList<>();
        params.add(id(user.id()));
        if (accountId != null) {
            sql += " AND t.account_id = ?";
            params.add(accountId.toString());
        }
        sql += " ORDER BY COALESCE(t.trade_date, t.payment_date) ASC, t.created_at ASC, t.id ASC";
        return jdbcTemplate.query(
                sql,
                (rs, rowNum) -> new LedgerEntry(
                        parseUuid(rs.getString("id")),
                        parseUuid(rs.getString("account_id")),
                        rs.getString("account_name"),
                        parseUuid(rs.getString("instrument_id")),
                        localDate(rs.getString("trade_date"), rs.getString("payment_date")),
                        parseLocalDate(rs.getString("ex_date")),
                        rs.getString("transaction_type"),
                        rs.getString("ticker"),
                        rs.getString("name"),
                        assetTypeForCategory(rs.getString("asset_category_code")),
                        rs.getString("market_code"),
                        rs.getString("currency_code"),
                        nullableDouble(rs, "units"),
                        nullableDouble(rs, "price_per_unit"),
                        nullableDouble(rs, "gross_amount"),
                        nullableDouble(rs, "fee_net_usd"),
                        nullableDouble(rs, "fee_net_thb"),
                        nullableDouble(rs, "fee_net_local"),
                        nullableDouble(rs, "fee_vat_local"),
                        nullableDouble(rs, "ats_fee_local"),
                        nullableDouble(rs, "fx_actual_rate"),
                        nullableDouble(rs, "fx_dime_rate"),
                        nullableDouble(rs, "withholding_tax_rate"),
                        nullableDouble(rs, "units_entitled"),
                        nullableDouble(rs, "amount_per_unit"),
                        nullableDouble(rs, "gross_dividend"),
                        nullableDouble(rs, "tax_amount"),
                        nullableDouble(rs, "net_amount"),
                        parseInstant(rs.getString("created_at"))
                ),
                params.toArray()
        );
    }

    private SellResult consumeLots(Deque<OpenLot> lots, double quantity, double proceeds) {
        double remaining = quantity;
        double costBasis = 0;
        while (remaining > EPSILON && !lots.isEmpty()) {
            OpenLot lot = lots.peekFirst();
            double consumed = Math.min(remaining, lot.remainingUnits());
            costBasis += consumed * lot.costPerUnit();
            lot.consume(consumed);
            remaining -= consumed;
            if (lot.remainingUnits() <= EPSILON) {
                lots.removeFirst();
            }
        }
        return new SellResult(proceeds - costBasis, costBasis);
    }

    private double openUnitsOnOrBefore(PortfolioMetadataRepository.UserRecord user,
                                       String marketCode,
                                       String symbol,
                                       LocalDate date) {
        DerivedLedger ledger = deriveLedger(user, marketCode, date);
        return ledger.instrumentStates.values().stream()
                .filter(state -> state.symbol().equalsIgnoreCase(symbol))
                .mapToDouble(InstrumentState::openUnits)
                .sum();
    }

    private double openUnitsOnOrBeforeInPortfolio(PortfolioMetadataRepository.UserRecord user,
                                                  UUID accountId,
                                                  String symbol,
                                                  LocalDate date) {
        DerivedLedger ledger = deriveLedgerForPortfolio(user, accountId, date);
        return ledger.instrumentStates.values().stream()
                .filter(state -> state.symbol().equalsIgnoreCase(symbol))
                .mapToDouble(InstrumentState::openUnits)
                .sum();
    }

    private double openUnitsOnOrBeforeInPortfolioExcludingTransaction(PortfolioMetadataRepository.UserRecord user,
                                                                      UUID accountId,
                                                                      String symbol,
                                                                      LocalDate date,
                                                                      UUID excludedTransactionId) {
        DerivedLedger ledger = deriveLedgerForPortfolio(user, accountId, date, excludedTransactionId);
        return ledger.instrumentStates.values().stream()
                .filter(state -> state.symbol().equalsIgnoreCase(symbol))
                .mapToDouble(InstrumentState::openUnits)
                .sum();
    }

    private LedgerEntry requireExistingTransaction(PortfolioMetadataRepository.UserRecord user, String transactionId) {
        UUID requestedId = parseUuid(transactionId);
        if (requestedId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Transaction not found");
        }
        return loadLedgerByPortfolio(user, null).stream()
                .filter(entry -> requestedId.equals(entry.id()))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transaction not found"));
    }

    private void ensureDeleteAllowed(PortfolioMetadataRepository.UserRecord user, LedgerEntry existing) {
        if (!"BUY".equals(existing.transactionType())) {
            return;
        }
        List<LedgerEntry> laterEntries = loadLedgerByPortfolio(user, existing.accountId()).stream()
                .filter(entry -> !entry.id().equals(existing.id()))
                .filter(entry -> entry.symbol().equalsIgnoreCase(existing.symbol()))
                .filter(entry -> {
                    LocalDate relevantDate = "DIVIDEND".equals(entry.transactionType())
                            ? (entry.exDate() == null ? entry.date() : entry.exDate())
                            : entry.date();
                    return relevantDate != null && !relevantDate.isBefore(existing.date());
                })
                .toList();

        boolean hasDependentSell = laterEntries.stream().anyMatch(entry -> "SELL".equals(entry.transactionType()));
        if (hasDependentSell) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Delete later sell transactions for " + existing.symbol() + " before deleting this buy."
            );
        }

        boolean hasDependentDividend = laterEntries.stream().anyMatch(entry -> "DIVIDEND".equals(entry.transactionType()));
        if (hasDependentDividend) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Delete later dividend transactions for " + existing.symbol() + " before deleting this buy."
            );
        }
    }

    private List<StocksData.Candlestick> buildMarketCandles(PortfolioMetadataRepository.UserRecord user,
                                                            String market,
                                                            List<StockPositionView> positions,
                                                            String period,
                                                            String interval) {
        Map<String, AggregateCandle> aggregate = new LinkedHashMap<>();
        for (StockPositionView position : positions) {
            List<MarketDataProvider.HistoricalBar> bars = marketDataProvider.history(
                    user,
                    position.symbol(),
                    market,
                    period,
                    interval
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
                .sorted(Map.Entry.comparingByKey(Comparator.comparing(this::parseInstant)))
                .map(entry -> new StocksData.Candlestick(
                        entry.getKey(),
                        entry.getValue().open,
                        entry.getValue().high,
                        entry.getValue().low,
                        entry.getValue().close
                ))
                .toList();
    }

    private HistoricalSeriesData buildPortfolioSeries(PortfolioMetadataRepository.UserRecord user,
                                                      UUID accountId,
                                                      String targetCurrency,
                                                      String period,
                                                      String interval) {
        List<LedgerEntry> ledger = loadLedgerByPortfolio(user, accountId).stream()
                .filter(entry -> "BUY".equals(entry.transactionType()) || "SELL".equals(entry.transactionType()))
                .toList();
        if (ledger.isEmpty()) {
            return HistoricalSeriesData.empty();
        }

        Map<UUID, List<LedgerEntry>> entriesByInstrument = new LinkedHashMap<>();
        Map<UUID, LedgerEntry> instrumentMetadata = new LinkedHashMap<>();
        for (LedgerEntry entry : ledger) {
            entriesByInstrument.computeIfAbsent(entry.instrumentId(), ignored -> new ArrayList<>()).add(entry);
            instrumentMetadata.putIfAbsent(entry.instrumentId(), entry);
        }

        Map<UUID, List<TimedBar>> barsByInstrument = new LinkedHashMap<>();
        TreeSet<Instant> timelineInstants = new TreeSet<>();
        Map<Instant, String> timelineLabels = new LinkedHashMap<>();
        for (Map.Entry<UUID, List<LedgerEntry>> instrumentEntry : entriesByInstrument.entrySet()) {
            LedgerEntry metadata = instrumentMetadata.get(instrumentEntry.getKey());
            List<TimedBar> bars = loadTimedBars(
                    user,
                    metadata.symbol(),
                    marketDisplay(metadata.marketCode()),
                    period,
                    interval
            );
            if (bars.isEmpty()) {
                continue;
            }
            barsByInstrument.put(instrumentEntry.getKey(), bars);
            for (TimedBar bar : bars) {
                timelineInstants.add(bar.instant());
                timelineLabels.putIfAbsent(bar.instant(), bar.time());
            }
        }

        if (timelineInstants.isEmpty()) {
            return HistoricalSeriesData.empty();
        }

        Map<UUID, Integer> nextLedgerIndex = new HashMap<>();
        Map<UUID, Deque<HistoricalOpenLot>> openLotsByInstrument = new HashMap<>();
        Map<UUID, Integer> nextBarIndex = new HashMap<>();
        Map<UUID, TimedBar> lastBarByInstrument = new HashMap<>();
        Map<String, List<TimedPricePoint>> fxHistoryCache = new HashMap<>();
        Map<String, List<TimedPricePoint>> tradeFxHistoryCache = new HashMap<>();

        List<StocksData.Candlestick> valueBars = new ArrayList<>();
        List<StocksData.Candlestick> performanceBars = new ArrayList<>();

        for (Instant instant : timelineInstants) {
            AggregatePortfolioCandle aggregate = new AggregatePortfolioCandle();
            String label = timelineLabels.getOrDefault(instant, instant.toString());

            for (Map.Entry<UUID, List<LedgerEntry>> instrumentEntry : entriesByInstrument.entrySet()) {
                UUID instrumentId = instrumentEntry.getKey();
                LedgerEntry metadata = instrumentMetadata.get(instrumentId);
                List<TimedBar> bars = barsByInstrument.get(instrumentId);
                if (bars == null || bars.isEmpty()) {
                    continue;
                }

                LocalDate effectiveDate = instant.atZone(marketZoneId(metadata.marketCode())).toLocalDate();
                Deque<HistoricalOpenLot> openLots = openLotsByInstrument.computeIfAbsent(instrumentId, ignored -> new ArrayDeque<>());
                int appliedEntryIndex = applyLedgerEntriesThroughDate(
                        user,
                        instrumentEntry.getValue(),
                        nextLedgerIndex.getOrDefault(instrumentId, 0),
                        effectiveDate,
                        targetCurrency,
                        tradeFxHistoryCache,
                        openLots
                );
                nextLedgerIndex.put(instrumentId, appliedEntryIndex);

                double openUnits = openLots.stream().mapToDouble(HistoricalOpenLot::remainingUnits).sum();
                if (openUnits <= EPSILON) {
                    continue;
                }

                BarCursor barCursor = advanceBarCursor(
                        bars,
                        nextBarIndex.getOrDefault(instrumentId, 0),
                        lastBarByInstrument.get(instrumentId),
                        instant
                );
                nextBarIndex.put(instrumentId, barCursor.nextIndex());
                TimedBar currentBar = barCursor.lastSeenBar();
                lastBarByInstrument.put(instrumentId, currentBar);
                if (currentBar == null) {
                    continue;
                }

                double fxRate = fxRateAtInstant(
                        user,
                        metadata.currency(),
                        targetCurrency,
                        period,
                        interval,
                        instant,
                        fxHistoryCache
                );
                boolean exactTimestampMatch = instant.equals(currentBar.instant());
                double baseOpen = exactTimestampMatch ? currentBar.open() : currentBar.close();
                double baseHigh = exactTimestampMatch ? currentBar.high() : currentBar.close();
                double baseLow = exactTimestampMatch ? currentBar.low() : currentBar.close();
                double baseClose = currentBar.close();

                double contributionOpen = baseOpen * openUnits * fxRate;
                double contributionHigh = baseHigh * openUnits * fxRate;
                double contributionLow = baseLow * openUnits * fxRate;
                double contributionClose = baseClose * openUnits * fxRate;
                double costBasis = openLots.stream().mapToDouble(lot -> lot.remainingUnits() * lot.costPerUnitTarget()).sum();

                aggregate.add(
                        roundMoney(contributionOpen),
                        roundMoney(contributionHigh),
                        roundMoney(contributionLow),
                        roundMoney(contributionClose),
                        roundMoney(costBasis)
                );
            }

            if (!aggregate.hasValue()) {
                continue;
            }

            valueBars.add(new StocksData.Candlestick(
                    label,
                    roundMoney(aggregate.open()),
                    roundMoney(aggregate.high()),
                    roundMoney(aggregate.low()),
                    roundMoney(aggregate.close())
            ));
            performanceBars.add(performanceCandle(
                    label,
                    aggregate.open(),
                    aggregate.high(),
                    aggregate.low(),
                    aggregate.close(),
                    aggregate.costBasis()
            ));
        }

        return new HistoricalSeriesData(valueBars, performanceBars);
    }

    private int applyLedgerEntriesThroughDate(PortfolioMetadataRepository.UserRecord user,
                                              List<LedgerEntry> entries,
                                              int startIndex,
                                              LocalDate effectiveDate,
                                              String targetCurrency,
                                              Map<String, List<TimedPricePoint>> tradeFxHistoryCache,
                                              Deque<HistoricalOpenLot> openLots) {
        int index = startIndex;
        while (index < entries.size() && !entries.get(index).date().isAfter(effectiveDate)) {
            LedgerEntry entry = entries.get(index);
            switch (entry.transactionType()) {
                case "BUY" -> {
                    double quantity = defaultNumber(entry.quantity());
                    if (quantity > EPSILON) {
                        double fxAtTrade = fxRateOnDate(
                                user,
                                entry.currency(),
                                targetCurrency,
                                entry.date(),
                                tradeFxHistoryCache
                        );
                        double costPerUnitTarget = quantity <= EPSILON
                                ? 0
                                : roundMoney((grossWithFee(entry) * fxAtTrade) / quantity);
                        openLots.addLast(new HistoricalOpenLot(quantity, costPerUnitTarget));
                    }
                }
                case "SELL" -> consumeHistoricalLots(openLots, defaultNumber(entry.quantity()));
                default -> {
                }
            }
            index++;
        }
        return index;
    }

    private void consumeHistoricalLots(Deque<HistoricalOpenLot> openLots, double quantity) {
        double remaining = quantity;
        while (remaining > EPSILON && !openLots.isEmpty()) {
            HistoricalOpenLot lot = openLots.peekFirst();
            double consumed = Math.min(remaining, lot.remainingUnits());
            lot.consume(consumed);
            remaining -= consumed;
            if (lot.remainingUnits() <= EPSILON) {
                openLots.removeFirst();
            }
        }
    }

    private BarCursor advanceBarCursor(List<TimedBar> bars,
                                       int startIndex,
                                       TimedBar lastSeenBar,
                                       Instant instant) {
        int index = startIndex;
        TimedBar current = lastSeenBar;
        while (index < bars.size() && !bars.get(index).instant().isAfter(instant)) {
            current = bars.get(index);
            index++;
        }
        return new BarCursor(index, current);
    }

    private List<TimedBar> loadTimedBars(PortfolioMetadataRepository.UserRecord user,
                                         String symbol,
                                         String market,
                                         String period,
                                         String interval) {
        return marketDataProvider.history(user, symbol, market, period, interval).stream()
                .map(bar -> new TimedBar(
                        bar.time(),
                        parseInstant(bar.time()),
                        bar.open(),
                        bar.high(),
                        bar.low(),
                        bar.close()
                ))
                .sorted(Comparator.comparing(TimedBar::instant))
                .toList();
    }

    private double fxRateAtInstant(PortfolioMetadataRepository.UserRecord user,
                                   String fromCurrency,
                                   String toCurrency,
                                   String period,
                                   String interval,
                                   Instant instant,
                                   Map<String, List<TimedPricePoint>> cache) {
        String normalizedFrom = normalizeCurrencyCode(fromCurrency);
        String normalizedTo = normalizeCurrencyCode(toCurrency);
        if (normalizedFrom == null || normalizedTo == null || normalizedFrom.equalsIgnoreCase(normalizedTo)) {
            return 1d;
        }
        List<TimedPricePoint> series = fxHistory(user, normalizedFrom, normalizedTo, period, interval, cache);
        if (series.isEmpty()) {
            return marketDataProvider.fxRate(normalizedFrom, normalizedTo).orElse(1d);
        }
        TimedPricePoint lastSeen = null;
        for (TimedPricePoint point : series) {
            if (point.instant().isAfter(instant)) {
                break;
            }
            lastSeen = point;
        }
        if (lastSeen != null) {
            return lastSeen.close();
        }
        return series.get(0).close();
    }

    private double fxRateOnDate(PortfolioMetadataRepository.UserRecord user,
                                String fromCurrency,
                                String toCurrency,
                                LocalDate date,
                                Map<String, List<TimedPricePoint>> cache) {
        String normalizedFrom = normalizeCurrencyCode(fromCurrency);
        String normalizedTo = normalizeCurrencyCode(toCurrency);
        if (normalizedFrom == null || normalizedTo == null || normalizedFrom.equalsIgnoreCase(normalizedTo)) {
            return 1d;
        }
        Instant lookupInstant = date.plusDays(1).atStartOfDay(ZoneId.of("UTC")).minusSeconds(1).toInstant();
        List<TimedPricePoint> series = fxHistory(user, normalizedFrom, normalizedTo, "max", "1d", cache);
        if (series.isEmpty()) {
            return marketDataProvider.fxRate(normalizedFrom, normalizedTo).orElse(1d);
        }
        TimedPricePoint lastSeen = null;
        for (TimedPricePoint point : series) {
            if (point.instant().isAfter(lookupInstant)) {
                break;
            }
            lastSeen = point;
        }
        if (lastSeen != null) {
            return lastSeen.close();
        }
        return series.get(0).close();
    }

    private List<TimedPricePoint> fxHistory(PortfolioMetadataRepository.UserRecord user,
                                            String fromCurrency,
                                            String toCurrency,
                                            String period,
                                            String interval,
                                            Map<String, List<TimedPricePoint>> cache) {
        if (fromCurrency.equalsIgnoreCase(toCurrency)) {
            return List.of(new TimedPricePoint(Instant.EPOCH, 1d));
        }

        String cacheKey = fromCurrency + "->" + toCurrency + "|" + period + "|" + interval;
        if (cache.containsKey(cacheKey)) {
            return cache.get(cacheKey);
        }

        List<TimedPricePoint> direct = marketDataProvider.history(
                        user,
                        fromCurrency + toCurrency + "=X",
                        "US",
                        period,
                        interval
                ).stream()
                .map(bar -> new TimedPricePoint(parseInstant(bar.time()), bar.close()))
                .sorted(Comparator.comparing(TimedPricePoint::instant))
                .toList();
        if (!direct.isEmpty()) {
            cache.put(cacheKey, direct);
            return direct;
        }

        List<TimedPricePoint> inverse = marketDataProvider.history(
                        user,
                        toCurrency + fromCurrency + "=X",
                        "US",
                        period,
                        interval
                ).stream()
                .map(bar -> new TimedPricePoint(
                        parseInstant(bar.time()),
                        bar.close() <= EPSILON ? 0d : 1d / bar.close()
                ))
                .sorted(Comparator.comparing(TimedPricePoint::instant))
                .toList();
        cache.put(cacheKey, inverse);
        return inverse;
    }

    private StocksData.Candlestick performanceCandle(String time,
                                                     double open,
                                                     double high,
                                                     double low,
                                                     double close,
                                                     double costBasis) {
        if (costBasis <= EPSILON) {
            return new StocksData.Candlestick(time, 0, 0, 0, 0);
        }
        return new StocksData.Candlestick(
                time,
                roundMoney(((open - costBasis) / costBasis) * 100d),
                roundMoney(((high - costBasis) / costBasis) * 100d),
                roundMoney(((low - costBasis) / costBasis) * 100d),
                roundMoney(((close - costBasis) / costBasis) * 100d)
        );
    }

    private List<StocksData.Candlestick> syntheticPerformanceCandles(List<StocksData.Candlestick> valueCandles,
                                                                     double costBasis) {
        return valueCandles.stream()
                .map(candle -> performanceCandle(
                        candle.time(),
                        candle.open(),
                        candle.high(),
                        candle.low(),
                        candle.close(),
                        costBasis
                ))
                .toList();
    }

    private double latestDayChange(List<StocksData.Candlestick> dailyHistory, double fallbackTotalValue) {
        if (dailyHistory.size() >= 2) {
            double latest = dailyHistory.get(dailyHistory.size() - 1).close();
            double previous = dailyHistory.get(dailyHistory.size() - 2).close();
            return roundMoney(latest - previous);
        }
        if (dailyHistory.size() == 1) {
            return roundMoney(dailyHistory.get(0).close() - fallbackTotalValue);
        }
        return 0d;
    }

    private double conversionRate(PortfolioMetadataRepository.UserRecord user,
                                  String fromCurrency,
                                  String toCurrency) {
        if (fromCurrency == null || fromCurrency.isBlank() || toCurrency == null || toCurrency.isBlank()) {
            return 1d;
        }
        if (fromCurrency.equalsIgnoreCase(toCurrency) || "MIXED".equalsIgnoreCase(toCurrency)) {
            return 1d;
        }
        return marketDataProvider.fxRate(fromCurrency, toCurrency).orElse(1d);
    }

    private UUID ensureStockAccount(PortfolioMetadataRepository.UserRecord user,
                                    String marketCode,
                                    String currencyCode) {
        String externalRef = "stock-ledger-" + marketCode.toLowerCase(Locale.ROOT);
        List<String> existing = jdbcTemplate.query("""
                        SELECT id
                        FROM accounts
                        WHERE user_id = ?
                          AND external_ref = ?
                        LIMIT 1
                        """,
                (rs, rowNum) -> rs.getString("id"),
                id(user.id()),
                externalRef
        );
        if (!existing.isEmpty()) {
            return UUID.fromString(existing.get(0));
        }

        UUID institutionId = referenceDataService.upsertInstitution(
                marketInstitutionName(marketCode),
                "BROKER",
                marketCode,
                currencyCode
        );
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
                marketAccountName(marketCode),
                null,
                referenceDataService.assetCategoryId("STOCK").toString(),
                referenceDataService.currencyId(currencyCode).toString(),
                referenceDataService.marketId(marketCode).toString(),
                "Created from stock ledger",
                externalRef,
                true
        );
        return accountId;
    }

    private List<PortfolioAccount> listPortfolioAccounts(PortfolioMetadataRepository.UserRecord user) {
        return jdbcTemplate.query("""
                        SELECT a.id,
                               a.account_name,
                               COALESCE(m.code, '') AS market_code,
                               COALESCE(c.code, '') AS currency_code
                        FROM accounts a
                        JOIN asset_categories ac ON ac.id = a.asset_category_id
                        LEFT JOIN markets m ON m.id = a.market_id
                        LEFT JOIN currencies c ON c.id = a.base_currency_id
                        WHERE a.user_id = ?
                          AND ac.code = 'STOCK'
                          AND a.is_active = 1
                        ORDER BY a.created_at ASC, a.id ASC
                        """,
                (rs, rowNum) -> new PortfolioAccount(
                        parseUuid(rs.getString("id")),
                        rs.getString("account_name"),
                        blankToNull(rs.getString("market_code")),
                        blankToNull(rs.getString("currency_code"))
                ),
                id(user.id())
        );
    }

    private PortfolioAccount requirePortfolioSelection(PortfolioMetadataRepository.UserRecord user, String portfolioId) {
        if (portfolioId == null || portfolioId.isBlank() || "all".equalsIgnoreCase(portfolioId)) {
            return null;
        }
        return requireConcretePortfolio(user, portfolioId);
    }

    private PortfolioAccount requireConcretePortfolio(PortfolioMetadataRepository.UserRecord user, String portfolioId) {
        UUID requestedId = parseUuid(portfolioId);
        if (requestedId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Select a portfolio first");
        }
        return listPortfolioAccounts(user).stream()
                .filter(account -> Objects.equals(account.id(), requestedId))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Portfolio not found"));
    }

    private String summaryCurrency(PortfolioAccount selectedAccount,
                                   List<StockPositionView> positions,
                                   String preferredCurrency) {
        if (selectedAccount != null && selectedAccount.currency() != null && !selectedAccount.currency().isBlank()) {
            return selectedAccount.currency();
        }
        if (preferredCurrency != null && !preferredCurrency.isBlank()) {
            return preferredCurrency;
        }
        String distinctCurrency = positions.stream()
                .map(StockPositionView::currency)
                .filter(Objects::nonNull)
                .distinct()
                .reduce((left, right) -> "__MIXED__")
                .orElse("USD");
        return "__MIXED__".equals(distinctCurrency) ? "MIXED" : distinctCurrency;
    }

    private String normalizeCurrencyCode(String currency) {
        if (currency == null || currency.isBlank()) {
            return null;
        }
        return currency.trim().toUpperCase(Locale.ROOT);
    }

    private UUID ensureInstrument(PortfolioMetadataRepository.UserRecord user,
                                  String marketCode,
                                  StockTransactionRequest request) {
        String symbol = request.symbol().toUpperCase(Locale.ROOT);
        List<String> existing = jdbcTemplate.query("""
                        SELECT i.id
                        FROM instruments i
                        LEFT JOIN markets m ON m.id = i.market_id
                        WHERE i.owner_user_id = ?
                          AND i.ticker = ?
                          AND COALESCE(m.code, 'TH') = ?
                        LIMIT 1
                        """,
                (rs, rowNum) -> rs.getString("id"),
                id(user.id()),
                symbol,
                marketCode
        );
        if (!existing.isEmpty()) {
            return UUID.fromString(existing.get(0));
        }

        if (!"BUY".equals(normalizeTransactionType(request.transactionType()))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ticker must exist before recording this transaction");
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
                referenceDataService.marketId(marketCode).toString(),
                id(referenceDataService.exchangeId(defaultExchangeCode(marketCode))),
                symbol,
                request.name(),
                null,
                referenceDataService.currencyId(request.currency()).toString(),
                true,
                "{\"source\":\"stock-ledger\"}",
                symbol.toLowerCase(Locale.ROOT)
        );
        return instrumentId;
    }

    private void validateRequest(String transactionType,
                                 String marketCode,
                                 StockTransactionRequest request) {
        if (!normalizeMarketCode(request.market()).equals(marketCode)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Market mismatch");
        }

        switch (transactionType) {
            case "BUY", "SELL" -> {
                if (defaultNumber(request.quantity()) <= EPSILON) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Quantity must be greater than zero");
                }
                if (defaultNumber(request.pricePerUnit()) <= EPSILON) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Price per share must be greater than zero");
                }
            }
            case "DIVIDEND" -> {
                if (defaultNumber(request.dividendPerShare()) <= EPSILON) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Dividend per share must be greater than zero");
                }
                if (request.exDate() == null) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "XD date is required");
                }
                if (request.exDate().isAfter(request.transactionDate())) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "XD date must be on or before received date");
                }
                double withholding = defaultNumber(request.withholdingTaxRate());
                if (withholding < 0 || withholding >= 1) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Withholding tax rate must be between 0 and 1");
                }
            }
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported stock transaction type");
        }
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
        LocalDate start = LocalDate.now().minusDays(Math.max(series.size() - 1L, 0L));
        for (int index = 0; index < series.size(); index++) {
            double close = series.get(index);
            candles.add(new StocksData.Candlestick(
                    start.plusDays(index).toString(),
                    close * 0.99,
                    close * 1.01,
                    close * 0.98,
                    close
            ));
        }
        return candles;
    }

    private String normalizeMarketCode(String market) {
        return switch (market == null ? "" : market.trim().toUpperCase(Locale.ROOT)) {
            case "US" -> "US";
            case "TH", "THAI", "THAILAND" -> "TH";
            case "UK" -> "UK";
            case "TW", "TAIWAN" -> "TW";
            default -> "TH";
        };
    }

    private String normalizeTransactionType(String transactionType) {
        return transactionType == null ? "" : transactionType.trim().toUpperCase(Locale.ROOT);
    }

    private String marketDisplay(String marketCode) {
        return switch (marketCode) {
            case "US" -> "us";
            case "UK" -> "uk";
            case "TW" -> "tw";
            default -> "thai";
        };
    }

    private String marketLabel(String marketCode) {
        return "US".equals(marketCode) ? "us" : "thai";
    }

    private String marketInstitutionName(String marketCode) {
        return switch (marketCode) {
            case "US" -> "User US Stocks";
            case "UK" -> "User UK Stocks";
            case "TW" -> "User Taiwan Stocks";
            default -> "User Thai Stocks";
        };
    }

    private String marketAccountName(String marketCode) {
        return switch (marketCode) {
            case "US" -> "US Stocks";
            case "UK" -> "UK Stocks";
            case "TW" -> "Taiwan Stocks";
            default -> "Thai Stocks";
        };
    }

    private String defaultExchangeCode(String marketCode) {
        return switch (marketCode) {
            case "US" -> "NASDAQ";
            case "UK" -> "LSE";
            case "TW" -> "TWSE";
            default -> "SET";
        };
    }

    private String assetTypeForCategory(String assetCategoryCode) {
        return "MUTUAL_FUND".equalsIgnoreCase(assetCategoryCode) ? "ETF" : "Stock";
    }

    private Double numberOrNull(String transactionType, double value) {
        return "DIVIDEND".equals(transactionType) ? null : value;
    }

    private Double quantityOrNull(String transactionType, double quantity) {
        return "DIVIDEND".equals(transactionType) ? null : quantity;
    }

    private double grossWithFee(LedgerEntry entry) {
        double thaiFeeTotal = totalThaiFees(entry);
        if (thaiFeeTotal > EPSILON) {
            return roundMoney(defaultNumber(entry.grossAmount()) + thaiFeeTotal);
        }
        if ("TH".equals(entry.marketCode())) {
            return roundMoney(defaultNumber(entry.grossAmount()) + defaultNumber(entry.feeNetThb()));
        }
        return roundMoney(defaultNumber(entry.grossAmount()) + defaultNumber(entry.feeNetUsd()));
    }

    private double totalThaiFees(LedgerEntry entry) {
        return roundMoney(
                defaultNumber(entry.feeNetLocal())
                        + defaultNumber(entry.feeVatLocal())
                        + defaultNumber(entry.atsFeeLocal())
        );
    }

    private double valueForUnits(double price, double units) {
        return roundMoney(price * units);
    }

    private Double multiply(Double left, Double right) {
        if (left == null || right == null) {
            return null;
        }
        return roundMoney(left * right);
    }

    private double defaultNumber(Double value) {
        return value == null ? 0 : value;
    }

    private Double nullableDouble(java.sql.ResultSet rs, String column) throws java.sql.SQLException {
        double value = rs.getDouble(column);
        return rs.wasNull() ? null : value;
    }

    private LocalDate localDate(String tradeDate, String paymentDate) {
        LocalDate parsedTradeDate = parseLocalDate(tradeDate);
        if (parsedTradeDate != null) {
            return parsedTradeDate;
        }
        LocalDate parsedPaymentDate = parseLocalDate(paymentDate);
        if (parsedPaymentDate != null) {
            return parsedPaymentDate;
        }
        return LocalDate.now();
    }

    private LocalDate parseLocalDate(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }

        String normalized = raw.trim();
        if (normalized.chars().allMatch(Character::isDigit)) {
            return instantFromEpoch(normalized).atZone(ZoneId.systemDefault()).toLocalDate();
        }
        if (normalized.length() >= 10 && normalized.charAt(4) == '-' && normalized.charAt(7) == '-') {
            return LocalDate.parse(normalized.substring(0, 10));
        }
        return null;
    }

    private Instant parseInstant(String raw) {
        if (raw == null || raw.isBlank()) {
            return Instant.EPOCH;
        }

        String normalized = raw.trim();
        if (normalized.chars().allMatch(Character::isDigit)) {
            return instantFromEpoch(normalized);
        }
        if (normalized.length() == 10 && normalized.charAt(4) == '-' && normalized.charAt(7) == '-') {
            try {
                return LocalDate.parse(normalized).atStartOfDay(ZoneId.of("UTC")).toInstant();
            } catch (Exception ignored) {
            }
        }
        try {
            return OffsetDateTime.parse(normalized).toInstant();
        } catch (Exception ignored) {
        }
        try {
            return Instant.parse(normalized);
        } catch (Exception ignored) {
        }
        try {
            return LocalDateTime.parse(normalized.replace(' ', 'T')).atZone(ZoneId.of("UTC")).toInstant();
        } catch (Exception ignored) {
        }
        return Instant.EPOCH;
    }

    private ZoneId marketZoneId(String marketCode) {
        return switch (normalizeMarketCode(marketCode)) {
            case "TH" -> ZoneId.of("Asia/Bangkok");
            case "UK" -> ZoneId.of("Europe/London");
            case "TW" -> ZoneId.of("Asia/Taipei");
            case "US" -> ZoneId.of("America/New_York");
            default -> ZoneId.of("UTC");
        };
    }

    private Instant instantFromEpoch(String raw) {
        long epoch = Long.parseLong(raw);
        if (raw.length() <= 10) {
            return Instant.ofEpochSecond(epoch);
        }
        return Instant.ofEpochMilli(epoch);
    }

    private UUID parseUuid(String raw) {
        return raw == null || raw.isBlank() ? null : UUID.fromString(raw);
    }

    private String id(UUID value) {
        return value == null ? null : value.toString();
    }

    private double roundMoney(double value) {
        return Math.round(value * 100d) / 100d;
    }

    private double roundUnits(double value) {
        return Math.round(value * 1_000_000d) / 1_000_000d;
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private record LedgerEntry(
            UUID id,
            UUID accountId,
            String accountName,
            UUID instrumentId,
            LocalDate date,
            LocalDate exDate,
            String transactionType,
            String symbol,
            String name,
            String assetType,
            String marketCode,
            String currency,
            Double quantity,
            Double pricePerUnit,
            Double grossAmount,
            Double feeNetUsd,
            Double feeNetThb,
            Double feeNetLocal,
            Double feeVatLocal,
            Double atsFeeLocal,
            Double fxActualRate,
            Double fxDimeRate,
            Double withholdingTaxRate,
            Double unitsEntitled,
            Double dividendPerShare,
            Double grossDividend,
            Double withholdingTaxAmount,
            Double netDividend,
            Instant createdAt
    ) {
    }

    private record DerivedLedger(
            Map<UUID, InstrumentState> instrumentStates,
            List<StockTransactionView> transactionViews
    ) {
    }

    private static final class InstrumentState {
        private final UUID instrumentId;
        private final String symbol;
        private final String name;
        private final String marketCode;
        private final String currency;
        private final String assetType;
        private final Deque<OpenLot> openLots = new ArrayDeque<>();
        private double realizedPnl;
        private double dividendsReceived;

        private InstrumentState(UUID instrumentId, String symbol, String name, String marketCode, String currency, String assetType) {
            this.instrumentId = instrumentId;
            this.symbol = symbol;
            this.name = name;
            this.marketCode = marketCode;
            this.currency = currency;
            this.assetType = assetType;
        }

        private UUID instrumentId() {
            return instrumentId;
        }

        private String symbol() {
            return symbol;
        }

        private String name() {
            return name;
        }

        private String marketCode() {
            return marketCode;
        }

        private String currency() {
            return currency;
        }

        private String assetType() {
            return assetType;
        }

        private Deque<OpenLot> openLots() {
            return openLots;
        }

        private double openUnits() {
            return openLots.stream().mapToDouble(OpenLot::remainingUnits).sum();
        }

        private double investedAmount() {
            return openLots.stream().mapToDouble(lot -> lot.remainingUnits() * lot.costPerUnit()).sum();
        }

        private double averageCost() {
            double units = openUnits();
            return units <= EPSILON ? 0 : investedAmount() / units;
        }
    }

    private record PortfolioAccount(
            UUID id,
            String name,
            String marketCode,
            String currency
    ) {
    }

    private record HistoricalSeriesData(
            List<StocksData.Candlestick> valueBars,
            List<StocksData.Candlestick> performanceBars
    ) {
        private static HistoricalSeriesData empty() {
            return new HistoricalSeriesData(List.of(), List.of());
        }
    }

    private record TimedBar(
            String time,
            Instant instant,
            double open,
            double high,
            double low,
            double close
    ) {
    }

    private record TimedPricePoint(
            Instant instant,
            double close
    ) {
    }

    private record BarCursor(
            int nextIndex,
            TimedBar lastSeenBar
    ) {
    }

    private static final class OpenLot {
        private final UUID id;
        private final LocalDate date;
        private double remainingUnits;
        private final double costPerUnit;

        private OpenLot(UUID id, LocalDate date, double remainingUnits, double costPerUnit) {
            this.id = id;
            this.date = date;
            this.remainingUnits = remainingUnits;
            this.costPerUnit = costPerUnit;
        }

        private UUID id() {
            return id;
        }

        private LocalDate date() {
            return date;
        }

        private double remainingUnits() {
            return remainingUnits;
        }

        private double costPerUnit() {
            return costPerUnit;
        }

        private void consume(double units) {
            remainingUnits = Math.max(0, remainingUnits - units);
        }
    }

    private record SellResult(double realizedPnl, double costBasis) {
    }

    private static final class HistoricalOpenLot {
        private double remainingUnits;
        private final double costPerUnitTarget;

        private HistoricalOpenLot(double remainingUnits, double costPerUnitTarget) {
            this.remainingUnits = remainingUnits;
            this.costPerUnitTarget = costPerUnitTarget;
        }

        private double remainingUnits() {
            return remainingUnits;
        }

        private double costPerUnitTarget() {
            return costPerUnitTarget;
        }

        private void consume(double units) {
            remainingUnits = Math.max(0, remainingUnits - units);
        }
    }

    private static final class AggregateCandle {
        private double open;
        private double high;
        private double low;
        private double close;
    }

    private static final class AggregatePortfolioCandle {
        private double open;
        private double high;
        private double low;
        private double close;
        private double costBasis;
        private boolean hasValue;

        private void add(double open, double high, double low, double close, double costBasis) {
            this.open += open;
            this.high += high;
            this.low += low;
            this.close += close;
            this.costBasis += costBasis;
            this.hasValue = true;
        }

        private double open() {
            return open;
        }

        private double high() {
            return high;
        }

        private double low() {
            return low;
        }

        private double close() {
            return close;
        }

        private double costBasis() {
            return costBasis;
        }

        private boolean hasValue() {
            return hasValue;
        }
    }
}
