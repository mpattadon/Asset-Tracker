package com.assettracker.service;

import com.assettracker.model.CreateMutualFundAccountRequest;
import com.assettracker.model.MutualFundAccountDetailView;
import com.assettracker.model.MutualFundAccountSummaryView;
import com.assettracker.model.MutualFundAccountView;
import com.assettracker.model.MutualFundDashboardResponse;
import com.assettracker.model.MutualFundHoldingView;
import com.assettracker.model.MutualFundMonthlyLogRequest;
import com.assettracker.model.MutualFundMonthlyLogView;
import com.assettracker.model.MutualFundPurchaseRequest;
import com.assettracker.model.MutualFundPurchaseView;
import com.assettracker.model.MutualFundSaleAccountView;
import com.assettracker.model.MutualFundSaleRequest;
import com.assettracker.model.MutualFundSaleView;
import com.assettracker.model.StockSummary;
import com.assettracker.model.StocksData;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class MutualFundService {

    private final CurrentUserService currentUserService;
    private final JdbcTemplate jdbcTemplate;
    private final ReferenceDataService referenceDataService;
    private final FxRateService fxRateService;

    public MutualFundService(CurrentUserService currentUserService,
                             JdbcTemplate jdbcTemplate,
                             ReferenceDataService referenceDataService,
                             FxRateService fxRateService) {
        this.currentUserService = currentUserService;
        this.jdbcTemplate = jdbcTemplate;
        this.referenceDataService = referenceDataService;
        this.fxRateService = fxRateService;
    }

    public MutualFundDashboardResponse dashboard(HttpServletRequest request,
                                                 String userIdHeader,
                                                 String bankName,
                                                 String accountId,
                                                 String preferredCurrency) {
        Optional<PortfolioMetadataRepository.UserRecord> user = currentUserService.resolveOptionalUser(request, userIdHeader);
        if (user.isEmpty()) {
            return emptyDashboard(normalizeCurrency(preferredCurrency));
        }

        String targetCurrency = normalizeCurrency(preferredCurrency);
        List<AccountRow> accounts = filteredAccounts(user.get(), bankName, accountId);
        if (accounts.isEmpty()) {
            return new MutualFundDashboardResponse(
                    emptySummary(bankName, accountId, targetCurrency),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of()
            );
        }

        List<PurchaseRow> purchases = purchasesForAccounts(user.get(), accounts);
        List<LogRow> logs = logsForAccounts(user.get(), accounts);
        List<SaleRow> sales = salesForAccounts(user.get(), accounts);

        List<MutualFundAccountView> accountViews = accounts.stream()
                .map(account -> new MutualFundAccountView(
                        account.id().toString(),
                        account.bankName(),
                        account.accountNumber(),
                        account.notes(),
                        account.currency()
                ))
                .toList();

        List<MutualFundAccountDetailView> accountDetails = accounts.stream()
                .map(account -> toAccountDetail(account, purchases, logs, sales))
                .toList();

        List<MutualFundAccountSummaryView> accountSummaries = accounts.stream()
                .map(account -> toAccountSummary(account, purchases, logs, sales, targetCurrency))
                .toList();

        List<MutualFundSaleAccountView> saleAccounts = accounts.stream()
                .map(account -> toSaleAccount(account, purchases, logs, sales))
                .filter(account -> !account.sales().isEmpty())
                .toList();

        StockSummary summary = buildSummary(accounts, purchases, logs, sales, targetCurrency, bankName, accountId);
        return new MutualFundDashboardResponse(summary, accountViews, accountSummaries, accountDetails, saleAccounts);
    }

    public List<MutualFundAccountView> accounts(HttpServletRequest request, String userIdHeader) {
        Optional<PortfolioMetadataRepository.UserRecord> user = currentUserService.resolveOptionalUser(request, userIdHeader);
        if (user.isEmpty()) {
            return List.of();
        }
        return accountRows(user.get()).stream()
                .map(account -> new MutualFundAccountView(
                        account.id().toString(),
                        account.bankName(),
                        account.accountNumber(),
                        account.notes(),
                        account.currency()
                ))
                .toList();
    }

    @Transactional
    public MutualFundAccountView createAccount(HttpServletRequest request,
                                               String userIdHeader,
                                               CreateMutualFundAccountRequest payload) {
        PortfolioMetadataRepository.UserRecord user = currentUserService.resolveUser(request, userIdHeader);
        UUID accountId = UUID.randomUUID();
        String currency = normalizeCurrency(payload.currency());
        jdbcTemplate.update("""
                INSERT INTO mutual_fund_accounts
                    (id, user_id, bank_name, account_number, notes, currency_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                accountId.toString(),
                id(user.id()),
                payload.bankName().trim(),
                payload.accountNumber().trim(),
                normalizeBlank(payload.notes()),
                id(referenceDataService.currencyId(currency))
        );
        return new MutualFundAccountView(
                accountId.toString(),
                payload.bankName().trim(),
                payload.accountNumber().trim(),
                normalizeBlank(payload.notes()),
                currency
        );
    }

    @Transactional
    public MutualFundAccountView updateAccount(HttpServletRequest request,
                                               String userIdHeader,
                                               String accountId,
                                               CreateMutualFundAccountRequest payload) {
        PortfolioMetadataRepository.UserRecord user = currentUserService.resolveUser(request, userIdHeader);
        requireAccount(user, accountId);
        String currency = normalizeCurrency(payload.currency());
        jdbcTemplate.update("""
                UPDATE mutual_fund_accounts
                SET bank_name = ?,
                    account_number = ?,
                    notes = ?,
                    currency_id = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND user_id = ?
                """,
                payload.bankName().trim(),
                payload.accountNumber().trim(),
                normalizeBlank(payload.notes()),
                id(referenceDataService.currencyId(currency)),
                accountId,
                id(user.id())
        );
        return new MutualFundAccountView(
                accountId,
                payload.bankName().trim(),
                payload.accountNumber().trim(),
                normalizeBlank(payload.notes()),
                currency
        );
    }

    @Transactional
    public void addPurchase(HttpServletRequest request,
                            String userIdHeader,
                            MutualFundPurchaseRequest payload) {
        PortfolioMetadataRepository.UserRecord user = currentUserService.resolveUser(request, userIdHeader);
        AccountRow account = requireAccount(user, payload.accountId());
        jdbcTemplate.update("""
                INSERT INTO mutual_fund_purchase_entries
                    (id, user_id, account_id, fund_name, fund_key, risk_level, purchase_date,
                     average_cost_per_unit, units_purchased, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                UUID.randomUUID().toString(),
                id(user.id()),
                payload.accountId(),
                payload.fundName().trim(),
                fundKey(payload.fundName()),
                payload.riskLevel(),
                payload.purchaseDate().toString(),
                payload.averageCostPerUnit(),
                payload.unitsPurchased()
        );
    }

    @Transactional
    public void updatePurchase(HttpServletRequest request,
                               String userIdHeader,
                               String purchaseId,
                               MutualFundPurchaseRequest payload) {
        PortfolioMetadataRepository.UserRecord user = currentUserService.resolveUser(request, userIdHeader);
        requireAccount(user, payload.accountId());
        PurchaseRow existing = requirePurchase(user, purchaseId);
        String key = fundKey(payload.fundName());
        PurchaseRow updatedPurchase = new PurchaseRow(
                parseUuid(purchaseId),
                parseUuid(payload.accountId()),
                payload.fundName().trim(),
                key,
                payload.riskLevel(),
                payload.purchaseDate(),
                payload.averageCostPerUnit(),
                payload.unitsPurchased()
        );
        if (existing.accountId().equals(updatedPurchase.accountId()) && existing.fundKey().equals(updatedPurchase.fundKey())) {
            List<PurchaseRow> candidatePurchases = purchasesForFund(user, payload.accountId(), key).stream()
                    .map(purchase -> purchase.id().equals(existing.id()) ? updatedPurchase : purchase)
                    .toList();
            ensureSalesCovered(
                    candidatePurchases,
                    salesForFund(user, payload.accountId(), key),
                    "Updated purchase would make existing sales exceed available FIFO lots."
            );
        } else {
            List<PurchaseRow> oldPurchases = purchasesForFund(user, existing.accountId().toString(), existing.fundKey()).stream()
                    .filter(purchase -> !purchase.id().equals(existing.id()))
                    .toList();
            ensureSalesCovered(
                    oldPurchases,
                    salesForFund(user, existing.accountId().toString(), existing.fundKey()),
                    "Cannot move this purchase because existing sales depend on it."
            );
            List<PurchaseRow> newPurchases = new ArrayList<>(purchasesForFund(user, payload.accountId(), key));
            newPurchases.add(updatedPurchase);
            ensureSalesCovered(
                    newPurchases,
                    salesForFund(user, payload.accountId(), key),
                    "Updated purchase would make existing sales exceed available FIFO lots."
            );
        }
        int updated = jdbcTemplate.update("""
                UPDATE mutual_fund_purchase_entries
                SET account_id = ?,
                    fund_name = ?,
                    fund_key = ?,
                    risk_level = ?,
                    purchase_date = ?,
                    average_cost_per_unit = ?,
                    units_purchased = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND user_id = ?
                """,
                payload.accountId(),
                payload.fundName().trim(),
                fundKey(payload.fundName()),
                payload.riskLevel(),
                payload.purchaseDate().toString(),
                payload.averageCostPerUnit(),
                payload.unitsPurchased(),
                purchaseId,
                id(user.id())
        );
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Purchase entry not found");
        }
    }

    @Transactional
    public void deletePurchase(HttpServletRequest request,
                               String userIdHeader,
                               String purchaseId) {
        PortfolioMetadataRepository.UserRecord user = currentUserService.resolveUser(request, userIdHeader);
        PurchaseRow existing = requirePurchase(user, purchaseId);
        List<PurchaseRow> candidatePurchases = purchasesForFund(user, existing.accountId().toString(), existing.fundKey()).stream()
                .filter(purchase -> !purchase.id().equals(existing.id()))
                .toList();
        ensureSalesCovered(
                candidatePurchases,
                salesForFund(user, existing.accountId().toString(), existing.fundKey()),
                "Cannot delete this purchase because existing sales depend on it."
        );
        jdbcTemplate.update(
                "DELETE FROM mutual_fund_purchase_entries WHERE id = ? AND user_id = ?",
                purchaseId,
                id(user.id())
        );
    }

    @Transactional
    public void logMonthlyData(HttpServletRequest request,
                               String userIdHeader,
                               MutualFundMonthlyLogRequest payload) {
        PortfolioMetadataRepository.UserRecord user = currentUserService.resolveUser(request, userIdHeader);
        requireAccount(user, payload.accountId());
        String key = fundKey(payload.fundName());
        boolean hasEligiblePurchase = purchasesForFund(user, payload.accountId(), key).stream()
                .anyMatch(purchase -> !purchase.purchaseDate().isAfter(payload.logDate()));
        if (!hasEligiblePurchase) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Log date must be on or after at least one purchase for this fund."
            );
        }

        String monthKey = YearMonth.from(payload.logDate()).toString();
        int updated = jdbcTemplate.update("""
                UPDATE mutual_fund_monthly_logs
                SET log_date = ?,
                    price_per_unit = ?,
                    dividend_received = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
                  AND account_id = ?
                  AND fund_key = ?
                  AND month_key = ?
                """,
                payload.logDate().toString(),
                payload.pricePerUnit(),
                payload.dividendReceived() == null ? 0d : payload.dividendReceived(),
                id(user.id()),
                payload.accountId(),
                key,
                monthKey
        );
        if (updated == 0) {
            jdbcTemplate.update("""
                    INSERT INTO mutual_fund_monthly_logs
                        (id, user_id, account_id, fund_name, fund_key, month_key, log_date,
                         price_per_unit, dividend_received, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """,
                    UUID.randomUUID().toString(),
                    id(user.id()),
                    payload.accountId(),
                    payload.fundName().trim(),
                    key,
                    monthKey,
                    payload.logDate().toString(),
                    payload.pricePerUnit(),
                    payload.dividendReceived() == null ? 0d : payload.dividendReceived()
            );
        }
    }

    @Transactional
    public void updateMonthlyLog(HttpServletRequest request,
                                 String userIdHeader,
                                 String logId,
                                 MutualFundMonthlyLogRequest payload) {
        PortfolioMetadataRepository.UserRecord user = currentUserService.resolveUser(request, userIdHeader);
        requireAccount(user, payload.accountId());
        String key = fundKey(payload.fundName());
        boolean hasEligiblePurchase = purchasesForFund(user, payload.accountId(), key).stream()
                .anyMatch(purchase -> !purchase.purchaseDate().isAfter(payload.logDate()));
        if (!hasEligiblePurchase) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Log date must be on or after at least one purchase for this fund."
            );
        }
        String monthKey = YearMonth.from(payload.logDate()).toString();
        Integer duplicateCount = jdbcTemplate.queryForObject("""
                        SELECT COUNT(*)
                        FROM mutual_fund_monthly_logs
                        WHERE user_id = ?
                          AND account_id = ?
                          AND fund_key = ?
                          AND month_key = ?
                          AND id <> ?
                        """,
                Integer.class,
                id(user.id()),
                payload.accountId(),
                key,
                monthKey,
                logId
        );
        if (duplicateCount != null && duplicateCount > 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "A monthly log already exists for this fund and month."
            );
        }
        int updated = jdbcTemplate.update("""
                UPDATE mutual_fund_monthly_logs
                SET account_id = ?,
                    fund_name = ?,
                    fund_key = ?,
                    month_key = ?,
                    log_date = ?,
                    price_per_unit = ?,
                    dividend_received = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND user_id = ?
                """,
                payload.accountId(),
                payload.fundName().trim(),
                key,
                monthKey,
                payload.logDate().toString(),
                payload.pricePerUnit(),
                payload.dividendReceived() == null ? 0d : payload.dividendReceived(),
                logId,
                id(user.id())
        );
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Monthly log entry not found");
        }
    }

    @Transactional
    public void deleteMonthlyLog(HttpServletRequest request,
                                 String userIdHeader,
                                 String logId) {
        PortfolioMetadataRepository.UserRecord user = currentUserService.resolveUser(request, userIdHeader);
        int deleted = jdbcTemplate.update(
                "DELETE FROM mutual_fund_monthly_logs WHERE id = ? AND user_id = ?",
                logId,
                id(user.id())
        );
        if (deleted == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Monthly log entry not found");
        }
    }

    @Transactional
    public void addSale(HttpServletRequest request,
                        String userIdHeader,
                        MutualFundSaleRequest payload) {
        PortfolioMetadataRepository.UserRecord user = currentUserService.resolveUser(request, userIdHeader);
        requireAccount(user, payload.accountId());
        String key = fundKey(payload.fundName());
        List<PurchaseRow> fundPurchases = purchasesForFund(user, payload.accountId(), key);
        if (fundPurchases.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No purchases found for this fund.");
        }
        List<SaleRow> fundSales = new ArrayList<>(salesForFund(user, payload.accountId(), key));
        fundSales.add(new SaleRow(
                UUID.randomUUID(),
                parseUuid(payload.accountId()),
                payload.fundName().trim(),
                key,
                payload.saleDate(),
                payload.unitsSold(),
                payload.salePricePerUnit()
        ));
        ensureSalesCovered(fundPurchases, fundSales, "Not enough units available to sell.");
        jdbcTemplate.update("""
                INSERT INTO mutual_fund_sale_entries
                    (id, user_id, account_id, fund_name, fund_key, sale_date,
                     units_sold, sale_price_per_unit, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                UUID.randomUUID().toString(),
                id(user.id()),
                payload.accountId(),
                payload.fundName().trim(),
                key,
                payload.saleDate().toString(),
                payload.unitsSold(),
                payload.salePricePerUnit()
        );
    }

    @Transactional
    public void updateSale(HttpServletRequest request,
                           String userIdHeader,
                           String saleId,
                           MutualFundSaleRequest payload) {
        PortfolioMetadataRepository.UserRecord user = currentUserService.resolveUser(request, userIdHeader);
        requireAccount(user, payload.accountId());
        SaleRow existing = requireSale(user, saleId);
        String key = fundKey(payload.fundName());
        SaleRow updatedSale = new SaleRow(
                parseUuid(saleId),
                parseUuid(payload.accountId()),
                payload.fundName().trim(),
                key,
                payload.saleDate(),
                payload.unitsSold(),
                payload.salePricePerUnit()
        );

        if (existing.accountId().equals(updatedSale.accountId()) && existing.fundKey().equals(updatedSale.fundKey())) {
            List<SaleRow> candidateSales = salesForFund(user, payload.accountId(), key).stream()
                    .map(sale -> sale.id().equals(existing.id()) ? updatedSale : sale)
                    .toList();
            ensureSalesCovered(
                    purchasesForFund(user, payload.accountId(), key),
                    candidateSales,
                    "Updated sale exceeds available FIFO lots."
            );
        } else {
            List<SaleRow> oldSales = salesForFund(user, existing.accountId().toString(), existing.fundKey()).stream()
                    .filter(sale -> !sale.id().equals(existing.id()))
                    .toList();
            ensureSalesCovered(
                    purchasesForFund(user, existing.accountId().toString(), existing.fundKey()),
                    oldSales,
                    "Cannot move this sale because the original fund history would become invalid."
            );
            List<SaleRow> newSales = new ArrayList<>(salesForFund(user, payload.accountId(), key));
            newSales.add(updatedSale);
            ensureSalesCovered(
                    purchasesForFund(user, payload.accountId(), key),
                    newSales,
                    "Updated sale exceeds available FIFO lots."
            );
        }

        int updated = jdbcTemplate.update("""
                UPDATE mutual_fund_sale_entries
                SET account_id = ?,
                    fund_name = ?,
                    fund_key = ?,
                    sale_date = ?,
                    units_sold = ?,
                    sale_price_per_unit = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND user_id = ?
                """,
                payload.accountId(),
                payload.fundName().trim(),
                key,
                payload.saleDate().toString(),
                payload.unitsSold(),
                payload.salePricePerUnit(),
                saleId,
                id(user.id())
        );
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Sale entry not found");
        }
    }

    @Transactional
    public void deleteSale(HttpServletRequest request,
                           String userIdHeader,
                           String saleId) {
        PortfolioMetadataRepository.UserRecord user = currentUserService.resolveUser(request, userIdHeader);
        int deleted = jdbcTemplate.update(
                "DELETE FROM mutual_fund_sale_entries WHERE id = ? AND user_id = ?",
                saleId,
                id(user.id())
        );
        if (deleted == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Sale entry not found");
        }
    }

    @Transactional
    public void deleteAccount(HttpServletRequest request,
                              String userIdHeader,
                              String accountId) {
        PortfolioMetadataRepository.UserRecord user = currentUserService.resolveUser(request, userIdHeader);
        requireAccount(user, accountId);
        jdbcTemplate.update("DELETE FROM mutual_fund_sale_entries WHERE user_id = ? AND account_id = ?", id(user.id()), accountId);
        jdbcTemplate.update("DELETE FROM mutual_fund_monthly_logs WHERE user_id = ? AND account_id = ?", id(user.id()), accountId);
        jdbcTemplate.update("DELETE FROM mutual_fund_purchase_entries WHERE user_id = ? AND account_id = ?", id(user.id()), accountId);
        jdbcTemplate.update("DELETE FROM mutual_fund_accounts WHERE user_id = ? AND id = ?", id(user.id()), accountId);
    }

    private MutualFundAccountDetailView toAccountDetail(AccountRow account,
                                                        List<PurchaseRow> purchases,
                                                        List<LogRow> logs,
                                                        List<SaleRow> sales) {
        List<PurchaseRow> accountPurchases = purchases.stream()
                .filter(purchase -> purchase.accountId().equals(account.id()))
                .sorted(Comparator.comparing(PurchaseRow::purchaseDate))
                .toList();
        List<LogRow> accountLogs = logs.stream()
                .filter(log -> log.accountId().equals(account.id()))
                .sorted(Comparator.comparing(LogRow::logDate))
                .toList();
        List<SaleRow> accountSales = sales.stream()
                .filter(sale -> sale.accountId().equals(account.id()))
                .sorted(Comparator.comparing(SaleRow::saleDate))
                .toList();

        Map<String, List<PurchaseRow>> purchasesByFund = new LinkedHashMap<>();
        for (PurchaseRow purchase : accountPurchases) {
            purchasesByFund.computeIfAbsent(purchase.fundKey(), ignored -> new ArrayList<>()).add(purchase);
        }

        Map<String, List<LogRow>> logsByFund = new HashMap<>();
        for (LogRow log : accountLogs) {
            logsByFund.computeIfAbsent(log.fundKey(), ignored -> new ArrayList<>()).add(log);
        }
        Map<String, List<SaleRow>> salesByFund = new HashMap<>();
        for (SaleRow sale : accountSales) {
            salesByFund.computeIfAbsent(sale.fundKey(), ignored -> new ArrayList<>()).add(sale);
        }

        List<MutualFundHoldingView> funds = new ArrayList<>();
        for (Map.Entry<String, List<PurchaseRow>> entry : purchasesByFund.entrySet()) {
            List<PurchaseRow> fundPurchases = entry.getValue();
            List<LogRow> fundLogs = logsByFund.getOrDefault(entry.getKey(), List.of());
            List<SaleRow> fundSales = salesByFund.getOrDefault(entry.getKey(), List.of());
            String fundName = fundPurchases.get(fundPurchases.size() - 1).fundName();
            int riskLevel = fundPurchases.get(fundPurchases.size() - 1).riskLevel();
            List<LotSlice> remainingLots = remainingLotsAtDate(fundPurchases, fundSales, LocalDate.now());
            if (remainingLots.isEmpty()) {
                continue;
            }
            double invested = remainingLots.stream()
                    .mapToDouble(lot -> lot.purchase().averageCostPerUnit() * lot.remainingUnits())
                    .sum();
            double currentValue = remainingLots.stream()
                    .mapToDouble(lot -> lot.remainingUnits() * latestApplicablePrice(lot.purchase(), fundLogs))
                    .sum();
            double dividends = fundLogs.stream().mapToDouble(LogRow::dividendReceived).sum();
            double realizedGainLoss = realizedGainLoss(fundPurchases, fundSales);
            double totalPurchaseCost = fundPurchases.stream()
                    .mapToDouble(purchase -> purchase.averageCostPerUnit() * purchase.unitsPurchased())
                    .sum();

            List<MutualFundMonthlyLogView> monthlyLogs = fundLogs.stream()
                    .sorted(Comparator.comparing(LogRow::logDate).reversed())
                    .map(log -> new MutualFundMonthlyLogView(
                            log.id().toString(),
                            log.logDate().toString(),
                            roundMoney(log.pricePerUnit()),
                            roundMoney(unitsHeldAtDate(fundPurchases, fundSales, log.logDate()) * log.pricePerUnit()),
                            roundMoney(log.dividendReceived())
                    ))
                    .toList();
            List<MutualFundPurchaseView> purchaseViews = fundPurchases.stream()
                    .sorted(Comparator.comparing(PurchaseRow::purchaseDate).reversed())
                    .map(purchase -> new MutualFundPurchaseView(
                            purchase.id().toString(),
                            purchase.purchaseDate().toString(),
                            roundMoney(purchase.averageCostPerUnit()),
                            roundMoney(purchase.unitsPurchased()),
                            roundMoney(purchase.averageCostPerUnit() * purchase.unitsPurchased()),
                            purchase.riskLevel()
                    ))
                    .toList();

            double gainLoss = (currentValue - invested) + dividends + realizedGainLoss;
            funds.add(new MutualFundHoldingView(
                    fundName,
                    riskLevel,
                    account.currency(),
                    roundMoney(invested),
                    roundMoney(currentValue),
                    roundMoney(dividends),
                    roundMoney(gainLoss),
                    totalPurchaseCost <= 0 ? 0d : roundMoney((gainLoss / totalPurchaseCost) * 100d),
                    purchaseViews,
                    monthlyLogs
            ));
        }

        funds.sort(Comparator.comparing(MutualFundHoldingView::fundName));
        return new MutualFundAccountDetailView(
                account.id().toString(),
                account.bankName(),
                account.accountNumber(),
                account.notes(),
                account.currency(),
                funds
        );
    }

    private MutualFundAccountSummaryView toAccountSummary(AccountRow account,
                                                         List<PurchaseRow> purchases,
                                                         List<LogRow> logs,
                                                         List<SaleRow> sales,
                                                         String preferredCurrency) {
        List<PurchaseRow> accountPurchases = purchases.stream()
                .filter(purchase -> purchase.accountId().equals(account.id()))
                .toList();
        List<LogRow> accountLogs = logs.stream()
                .filter(log -> log.accountId().equals(account.id()))
                .toList();
        List<SaleRow> accountSales = sales.stream()
                .filter(sale -> sale.accountId().equals(account.id()))
                .toList();
        double invested = remainingLotsAtDate(accountPurchases, accountSales, LocalDate.now()).stream()
                .mapToDouble(lot -> lot.purchase().averageCostPerUnit() * lot.remainingUnits())
                .sum();
        double currentValue = remainingLotsAtDate(accountPurchases, accountSales, LocalDate.now()).stream()
                .mapToDouble(lot -> lot.remainingUnits() * latestApplicablePrice(
                        lot.purchase(),
                        accountLogs.stream().filter(log -> log.fundKey().equals(lot.purchase().fundKey())).toList()
                ))
                .sum();
        double dividends = accountLogs.stream().mapToDouble(LogRow::dividendReceived).sum();
        double realizedGainLoss = realizedGainLoss(accountPurchases, accountSales);
        double totalPurchaseCost = accountPurchases.stream()
                .mapToDouble(purchase -> purchase.averageCostPerUnit() * purchase.unitsPurchased())
                .sum();
        double rate = conversionRate(account.currency(), preferredCurrency);
        double displayInvested = invested * rate;
        double displayValue = currentValue * rate;
        double displayDividends = dividends * rate;
        double gainLoss = (displayValue - displayInvested) + displayDividends + (realizedGainLoss * rate);
        return new MutualFundAccountSummaryView(
                account.id().toString(),
                account.bankName(),
                account.accountNumber(),
                account.notes(),
                preferredCurrency,
                roundMoney(displayInvested),
                roundMoney(displayValue),
                roundMoney(displayDividends),
                roundMoney(gainLoss),
                totalPurchaseCost <= 0 ? 0d : roundMoney((gainLoss / (totalPurchaseCost * rate)) * 100d)
        );
    }

    private StockSummary buildSummary(List<AccountRow> accounts,
                                      List<PurchaseRow> purchases,
                                      List<LogRow> logs,
                                      List<SaleRow> sales,
                                      String preferredCurrency,
                                      String bankName,
                                      String accountId) {
        List<LocalDate> timeline = new ArrayList<>();
        purchases.stream().map(PurchaseRow::purchaseDate).forEach(timeline::add);
        logs.stream().map(LogRow::logDate).forEach(timeline::add);
        sales.stream().map(SaleRow::saleDate).forEach(timeline::add);
        timeline.sort(Comparator.naturalOrder());

        List<StocksData.Candlestick> dailyHistory = new ArrayList<>();
        List<StocksData.Candlestick> performanceHistory = new ArrayList<>();

        for (LocalDate date : timeline.stream().distinct().toList()) {
            double invested = 0d;
            double value = 0d;
            for (AccountRow account : accounts) {
                double rate = conversionRate(account.currency(), preferredCurrency);
                List<PurchaseRow> accountPurchases = purchases.stream()
                        .filter(purchase -> purchase.accountId().equals(account.id()))
                        .toList();
                List<LogRow> accountLogs = logs.stream()
                        .filter(log -> log.accountId().equals(account.id()))
                        .toList();
                List<SaleRow> accountSales = sales.stream()
                        .filter(sale -> sale.accountId().equals(account.id()))
                        .toList();
                for (LotSlice lot : remainingLotsAtDate(accountPurchases, accountSales, date)) {
                    invested += lot.purchase().averageCostPerUnit() * lot.remainingUnits() * rate;
                    List<LogRow> fundLogs = accountLogs.stream()
                            .filter(log -> log.fundKey().equals(lot.purchase().fundKey()))
                            .toList();
                    double price = latestApplicablePriceAsOf(lot.purchase(), fundLogs, date);
                    value += lot.remainingUnits() * price * rate;
                }
            }
            dailyHistory.add(flatCandle(date.toString(), value));
            performanceHistory.add(flatCandle(date.toString(), invested <= 0 ? 0d : ((value - invested) / invested) * 100d));
        }

        double totalValue = dailyHistory.isEmpty() ? 0d : dailyHistory.get(dailyHistory.size() - 1).close();
        double totalCost = remainingLotsAtDate(purchases, sales, LocalDate.now()).stream()
                .mapToDouble(lot -> {
                    AccountRow account = accounts.stream()
                            .filter(candidate -> candidate.id().equals(lot.purchase().accountId()))
                            .findFirst()
                            .orElseThrow();
                    return lot.purchase().averageCostPerUnit() * lot.remainingUnits() * conversionRate(account.currency(), preferredCurrency);
                })
                .sum();
        double totalDividends = logs.stream()
                .mapToDouble(log -> {
                    AccountRow account = accounts.stream()
                            .filter(candidate -> candidate.id().equals(log.accountId()))
                            .findFirst()
                            .orElseThrow();
                    return log.dividendReceived() * conversionRate(account.currency(), preferredCurrency);
                })
                .sum();
        double totalRealized = realizedGainLoss(purchases, sales, accounts, preferredCurrency);
        double totalChange = (totalValue - totalCost) + totalDividends + totalRealized;
        double dayChange = dailyHistory.size() >= 2
                ? dailyHistory.get(dailyHistory.size() - 1).close() - dailyHistory.get(dailyHistory.size() - 2).close()
                : 0d;

        String title = accountId != null && !accountId.isBlank()
                ? accounts.get(0).accountNumber()
                : bankName != null && !bankName.isBlank()
                ? bankName + " Mutual Funds"
                : "All Mutual Funds";

        return new StockSummary(
                accountId == null || accountId.isBlank() ? "all" : accountId,
                title,
                preferredCurrency,
                roundMoney(totalValue),
                roundMoney(dayChange),
                totalValue == 0d ? 0d : roundMoney((dayChange / totalValue) * 100d),
                roundMoney(totalChange),
                purchases.isEmpty() ? 0d : roundMoney((totalChange / purchases.stream()
                        .mapToDouble(purchase -> {
                            AccountRow account = accounts.stream()
                                    .filter(candidate -> candidate.id().equals(purchase.accountId()))
                                    .findFirst()
                                    .orElseThrow();
                            return purchase.averageCostPerUnit() * purchase.unitsPurchased() * conversionRate(account.currency(), preferredCurrency);
                        }).sum()) * 100d),
                dailyHistory.stream().map(StocksData.Candlestick::close).toList(),
                dailyHistory,
                List.of(),
                dailyHistory,
                List.of(),
                performanceHistory
        );
    }

    private List<AccountRow> filteredAccounts(PortfolioMetadataRepository.UserRecord user,
                                              String bankName,
                                              String accountId) {
        return accountRows(user).stream()
                .filter(account -> bankName == null || bankName.isBlank() || "all".equalsIgnoreCase(bankName) || account.bankName().equalsIgnoreCase(bankName))
                .filter(account -> accountId == null || accountId.isBlank() || "all".equalsIgnoreCase(accountId) || account.id().toString().equals(accountId))
                .toList();
    }

    private List<AccountRow> accountRows(PortfolioMetadataRepository.UserRecord user) {
        return jdbcTemplate.query("""
                        SELECT a.id,
                               a.bank_name,
                               a.account_number,
                               a.notes,
                               c.code AS currency
                        FROM mutual_fund_accounts a
                        JOIN currencies c ON c.id = a.currency_id
                        WHERE a.user_id = ?
                        ORDER BY a.bank_name, a.account_number
                        """,
                (rs, rowNum) -> mapAccount(rs),
                id(user.id())
        );
    }

    private AccountRow requireAccount(PortfolioMetadataRepository.UserRecord user, String accountId) {
        return accountRows(user).stream()
                .filter(account -> account.id().toString().equals(accountId))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Mutual fund account not found"));
    }

    private List<PurchaseRow> purchasesForAccounts(PortfolioMetadataRepository.UserRecord user, List<AccountRow> accounts) {
        if (accounts.isEmpty()) {
            return List.of();
        }
        List<PurchaseRow> rows = new ArrayList<>();
        for (AccountRow account : accounts) {
            rows.addAll(purchasesForAccount(user, account.id().toString()));
        }
        return rows;
    }

    private List<PurchaseRow> purchasesForAccount(PortfolioMetadataRepository.UserRecord user, String accountId) {
        return jdbcTemplate.query("""
                        SELECT id, account_id, fund_name, fund_key, risk_level, purchase_date,
                               average_cost_per_unit, units_purchased
                        FROM mutual_fund_purchase_entries
                        WHERE user_id = ? AND account_id = ?
                        ORDER BY purchase_date, created_at
                        """,
                (rs, rowNum) -> new PurchaseRow(
                        parseUuid(rs.getString("id")),
                        parseUuid(rs.getString("account_id")),
                        rs.getString("fund_name"),
                        rs.getString("fund_key"),
                        rs.getInt("risk_level"),
                        LocalDate.parse(rs.getString("purchase_date")),
                        rs.getDouble("average_cost_per_unit"),
                        rs.getDouble("units_purchased")
                ),
                id(user.id()),
                accountId
        );
    }

    private List<PurchaseRow> purchasesForFund(PortfolioMetadataRepository.UserRecord user,
                                               String accountId,
                                               String fundKey) {
        return purchasesForAccount(user, accountId).stream()
                .filter(purchase -> purchase.fundKey().equals(fundKey))
                .toList();
    }

    private PurchaseRow requirePurchase(PortfolioMetadataRepository.UserRecord user, String purchaseId) {
        return jdbcTemplate.query("""
                        SELECT id, account_id, fund_name, fund_key, risk_level, purchase_date,
                               average_cost_per_unit, units_purchased
                        FROM mutual_fund_purchase_entries
                        WHERE user_id = ? AND id = ?
                        """,
                (rs, rowNum) -> new PurchaseRow(
                        parseUuid(rs.getString("id")),
                        parseUuid(rs.getString("account_id")),
                        rs.getString("fund_name"),
                        rs.getString("fund_key"),
                        rs.getInt("risk_level"),
                        LocalDate.parse(rs.getString("purchase_date")),
                        rs.getDouble("average_cost_per_unit"),
                        rs.getDouble("units_purchased")
                ),
                id(user.id()),
                purchaseId
        ).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Purchase entry not found"));
    }

    private List<SaleRow> salesForAccounts(PortfolioMetadataRepository.UserRecord user, List<AccountRow> accounts) {
        if (accounts.isEmpty()) {
            return List.of();
        }
        List<SaleRow> rows = new ArrayList<>();
        for (AccountRow account : accounts) {
            rows.addAll(salesForAccount(user, account.id().toString()));
        }
        return rows;
    }

    private List<SaleRow> salesForAccount(PortfolioMetadataRepository.UserRecord user, String accountId) {
        return jdbcTemplate.query("""
                        SELECT id, account_id, fund_name, fund_key, sale_date, units_sold, sale_price_per_unit
                        FROM mutual_fund_sale_entries
                        WHERE user_id = ? AND account_id = ?
                        ORDER BY sale_date, created_at
                        """,
                (rs, rowNum) -> new SaleRow(
                        parseUuid(rs.getString("id")),
                        parseUuid(rs.getString("account_id")),
                        rs.getString("fund_name"),
                        rs.getString("fund_key"),
                        LocalDate.parse(rs.getString("sale_date")),
                        rs.getDouble("units_sold"),
                        rs.getDouble("sale_price_per_unit")
                ),
                id(user.id()),
                accountId
        );
    }

    private List<SaleRow> salesForFund(PortfolioMetadataRepository.UserRecord user,
                                       String accountId,
                                       String fundKey) {
        return salesForAccount(user, accountId).stream()
                .filter(sale -> sale.fundKey().equals(fundKey))
                .toList();
    }

    private SaleRow requireSale(PortfolioMetadataRepository.UserRecord user, String saleId) {
        return jdbcTemplate.query("""
                        SELECT id, account_id, fund_name, fund_key, sale_date, units_sold, sale_price_per_unit
                        FROM mutual_fund_sale_entries
                        WHERE user_id = ? AND id = ?
                        """,
                (rs, rowNum) -> new SaleRow(
                        parseUuid(rs.getString("id")),
                        parseUuid(rs.getString("account_id")),
                        rs.getString("fund_name"),
                        rs.getString("fund_key"),
                        LocalDate.parse(rs.getString("sale_date")),
                        rs.getDouble("units_sold"),
                        rs.getDouble("sale_price_per_unit")
                ),
                id(user.id()),
                saleId
        ).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sale entry not found"));
    }

    private List<LogRow> logsForAccounts(PortfolioMetadataRepository.UserRecord user, List<AccountRow> accounts) {
        if (accounts.isEmpty()) {
            return List.of();
        }
        List<LogRow> rows = new ArrayList<>();
        for (AccountRow account : accounts) {
            rows.addAll(logsForAccount(user, account.id().toString()));
        }
        return rows;
    }

    private List<LogRow> logsForAccount(PortfolioMetadataRepository.UserRecord user, String accountId) {
        return jdbcTemplate.query("""
                        SELECT id, account_id, fund_name, fund_key, month_key, log_date, price_per_unit, dividend_received
                        FROM mutual_fund_monthly_logs
                        WHERE user_id = ? AND account_id = ?
                        ORDER BY log_date, created_at
                        """,
                (rs, rowNum) -> new LogRow(
                        parseUuid(rs.getString("id")),
                        parseUuid(rs.getString("account_id")),
                        rs.getString("fund_name"),
                        rs.getString("fund_key"),
                        rs.getString("month_key"),
                        LocalDate.parse(rs.getString("log_date")),
                        rs.getDouble("price_per_unit"),
                        rs.getDouble("dividend_received")
                ),
                id(user.id()),
                accountId
        );
    }

    private AccountRow mapAccount(ResultSet rs) throws SQLException {
        return new AccountRow(
                parseUuid(rs.getString("id")),
                rs.getString("bank_name"),
                rs.getString("account_number"),
                rs.getString("notes"),
                rs.getString("currency")
        );
    }

    private double latestApplicablePrice(PurchaseRow purchase, List<LogRow> fundLogs) {
        return latestApplicablePriceAsOf(purchase, fundLogs, LocalDate.now());
    }

    private double latestApplicablePriceAsOf(PurchaseRow purchase, List<LogRow> fundLogs, LocalDate asOf) {
        return fundLogs.stream()
                .filter(log -> !log.logDate().isAfter(asOf))
                .filter(log -> !log.logDate().isBefore(purchase.purchaseDate()))
                .max(Comparator.comparing(LogRow::logDate))
                .map(LogRow::pricePerUnit)
                .orElse(purchase.averageCostPerUnit());
    }

    private List<LotSlice> remainingLotsAtDate(List<PurchaseRow> purchases, List<SaleRow> sales, LocalDate asOf) {
        List<PurchaseRow> eligiblePurchases = purchases.stream()
                .filter(purchase -> !purchase.purchaseDate().isAfter(asOf))
                .sorted(Comparator.comparing(PurchaseRow::purchaseDate).thenComparing(PurchaseRow::id))
                .toList();
        Map<UUID, Double> remainingByPurchase = new LinkedHashMap<>();
        for (PurchaseRow purchase : eligiblePurchases) {
            remainingByPurchase.put(purchase.id(), purchase.unitsPurchased());
        }

        for (SaleRow sale : sales.stream()
                .filter(candidate -> !candidate.saleDate().isAfter(asOf))
                .sorted(Comparator.comparing(SaleRow::saleDate).thenComparing(SaleRow::id))
                .toList()) {
            double remainingToSell = sale.unitsSold();
            for (PurchaseRow purchase : eligiblePurchases) {
                if (purchase.purchaseDate().isAfter(sale.saleDate())) {
                    continue;
                }
                double available = remainingByPurchase.getOrDefault(purchase.id(), 0d);
                if (available <= 0d) {
                    continue;
                }
                double consumed = Math.min(available, remainingToSell);
                if (consumed <= 0d) {
                    continue;
                }
                remainingByPurchase.put(purchase.id(), available - consumed);
                remainingToSell -= consumed;
                if (remainingToSell <= 0.0000001d) {
                    break;
                }
            }
        }

        List<LotSlice> slices = new ArrayList<>();
        for (PurchaseRow purchase : eligiblePurchases) {
            double remaining = remainingByPurchase.getOrDefault(purchase.id(), 0d);
            if (remaining > 0.0000001d) {
                slices.add(new LotSlice(purchase, remaining));
            }
        }
        return slices;
    }

    private void ensureSalesCovered(List<PurchaseRow> purchases,
                                    List<SaleRow> sales,
                                    String message) {
        List<PurchaseRow> sortedPurchases = purchases.stream()
                .sorted(Comparator.comparing(PurchaseRow::purchaseDate).thenComparing(PurchaseRow::id))
                .toList();
        Map<UUID, Double> remainingByPurchase = new LinkedHashMap<>();
        for (PurchaseRow purchase : sortedPurchases) {
            remainingByPurchase.put(purchase.id(), purchase.unitsPurchased());
        }

        for (SaleRow sale : sales.stream().sorted(Comparator.comparing(SaleRow::saleDate).thenComparing(SaleRow::id)).toList()) {
            double remainingToSell = sale.unitsSold();
            for (PurchaseRow purchase : sortedPurchases) {
                if (purchase.purchaseDate().isAfter(sale.saleDate())) {
                    continue;
                }
                double available = remainingByPurchase.getOrDefault(purchase.id(), 0d);
                if (available <= 0d) {
                    continue;
                }
                double consumed = Math.min(available, remainingToSell);
                if (consumed <= 0d) {
                    continue;
                }
                remainingByPurchase.put(purchase.id(), available - consumed);
                remainingToSell -= consumed;
                if (remainingToSell <= 0.0000001d) {
                    break;
                }
            }
            if (remainingToSell > 0.0000001d) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
            }
        }
    }

    private double unitsHeldAtDate(List<PurchaseRow> purchases, List<SaleRow> sales, LocalDate date) {
        return remainingLotsAtDate(purchases, sales, date).stream()
                .mapToDouble(LotSlice::remainingUnits)
                .sum();
    }

    private List<MutualFundSaleView> saleViews(List<PurchaseRow> purchases,
                                               List<LogRow> logs,
                                               List<SaleRow> sales) {
        if (sales.isEmpty()) {
            return List.of();
        }
        List<PurchaseRow> sortedPurchases = purchases.stream()
                .sorted(Comparator.comparing(PurchaseRow::purchaseDate).thenComparing(PurchaseRow::id))
                .toList();
        Map<UUID, Double> remainingByPurchase = new LinkedHashMap<>();
        for (PurchaseRow purchase : sortedPurchases) {
            remainingByPurchase.put(purchase.id(), purchase.unitsPurchased());
        }

        List<MutualFundSaleView> views = new ArrayList<>();
        for (SaleRow sale : sales.stream().sorted(Comparator.comparing(SaleRow::saleDate).thenComparing(SaleRow::id)).toList()) {
            double remainingToSell = sale.unitsSold();
            double realized = 0d;
            double fundDividends = logs.stream()
                    .filter(log -> log.fundKey().equals(sale.fundKey()))
                    .mapToDouble(LogRow::dividendReceived)
                    .sum();
            for (PurchaseRow purchase : sortedPurchases) {
                if (purchase.purchaseDate().isAfter(sale.saleDate())) {
                    continue;
                }
                double available = remainingByPurchase.getOrDefault(purchase.id(), 0d);
                if (available <= 0d) {
                    continue;
                }
                double consumed = Math.min(available, remainingToSell);
                if (consumed <= 0d) {
                    continue;
                }
                realized += (sale.salePricePerUnit() - purchase.averageCostPerUnit()) * consumed;
                remainingByPurchase.put(purchase.id(), available - consumed);
                remainingToSell -= consumed;
                if (remainingToSell <= 0.0000001d) {
                    break;
                }
            }
            views.add(new MutualFundSaleView(
                    sale.id().toString(),
                    sale.fundName(),
                    sale.saleDate().toString(),
                    roundMoney(sale.unitsSold()),
                    roundMoney(sale.salePricePerUnit()),
                    roundMoney(sale.unitsSold() * sale.salePricePerUnit()),
                    roundMoney(realized),
                    roundMoney(fundDividends)
            ));
        }
        views.sort(Comparator.comparing(MutualFundSaleView::saleDate).reversed());
        return views;
    }

    private double realizedGainLoss(List<PurchaseRow> purchases, List<SaleRow> sales) {
        return saleViews(purchases, List.of(), sales).stream().mapToDouble(MutualFundSaleView::realizedGainLoss).sum();
    }

    private double realizedGainLoss(List<PurchaseRow> purchases,
                                    List<SaleRow> sales,
                                    List<AccountRow> accounts,
                                    String preferredCurrency) {
        double total = 0d;
        for (AccountRow account : accounts) {
            double rate = conversionRate(account.currency(), preferredCurrency);
            total += realizedGainLoss(
                    purchases.stream().filter(purchase -> purchase.accountId().equals(account.id())).toList(),
                    sales.stream().filter(sale -> sale.accountId().equals(account.id())).toList()
            ) * rate;
        }
        return total;
    }

    private StockSummary emptySummary(String bankName, String accountId, String preferredCurrency) {
        return new StockSummary(
                accountId == null || accountId.isBlank() ? "all" : accountId,
                bankName == null || bankName.isBlank() ? "All Mutual Funds" : bankName + " Mutual Funds",
                preferredCurrency,
                0d,
                0d,
                0d,
                0d,
                0d,
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of()
        );
    }

    private MutualFundDashboardResponse emptyDashboard(String preferredCurrency) {
        return new MutualFundDashboardResponse(
                emptySummary(null, null, preferredCurrency),
                List.of(),
                List.of(),
                List.of(),
                List.of()
        );
    }

    private MutualFundSaleAccountView toSaleAccount(AccountRow account,
                                                    List<PurchaseRow> purchases,
                                                    List<LogRow> logs,
                                                    List<SaleRow> sales) {
        List<PurchaseRow> accountPurchases = purchases.stream()
                .filter(purchase -> purchase.accountId().equals(account.id()))
                .toList();
        List<LogRow> accountLogs = logs.stream()
                .filter(log -> log.accountId().equals(account.id()))
                .toList();
        List<SaleRow> accountSales = sales.stream()
                .filter(sale -> sale.accountId().equals(account.id()))
                .toList();
        List<MutualFundSaleView> saleViews = saleViews(accountPurchases, accountLogs, accountSales);
        double realized = saleViews.stream().mapToDouble(MutualFundSaleView::realizedGainLoss).sum();
        double dividends = accountLogs.stream().mapToDouble(LogRow::dividendReceived).sum();
        return new MutualFundSaleAccountView(
                account.id().toString(),
                account.bankName(),
                account.accountNumber(),
                account.notes(),
                account.currency(),
                roundMoney(realized),
                roundMoney(dividends),
                roundMoney(realized + dividends),
                saleViews
        );
    }

    private StocksData.Candlestick flatCandle(String time, double value) {
        double rounded = roundMoney(value);
        return new StocksData.Candlestick(time, rounded, rounded, rounded, rounded);
    }

    private String normalizeCurrency(String currency) {
        return currency == null || currency.isBlank() ? "THB" : currency.trim().toUpperCase(Locale.ROOT);
    }

    private String normalizeBlank(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String fundKey(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private double conversionRate(String fromCurrency, String toCurrency) {
        return fxRateService.latestRate(
                normalizeCurrency(fromCurrency),
                normalizeCurrency(toCurrency)
        );
    }

    private double roundMoney(double value) {
        return Math.round(value * 100d) / 100d;
    }

    private UUID parseUuid(String raw) {
        return raw == null || raw.isBlank() ? null : UUID.fromString(raw);
    }

    private String id(UUID value) {
        return value == null ? null : value.toString();
    }

    private record AccountRow(
            UUID id,
            String bankName,
            String accountNumber,
            String notes,
            String currency
    ) {
    }

    private record PurchaseRow(
            UUID id,
            UUID accountId,
            String fundName,
            String fundKey,
            int riskLevel,
            LocalDate purchaseDate,
            double averageCostPerUnit,
            double unitsPurchased
    ) {
    }

    private record LogRow(
            UUID id,
            UUID accountId,
            String fundName,
            String fundKey,
            String monthKey,
            LocalDate logDate,
            double pricePerUnit,
            double dividendReceived
    ) {
    }

    private record SaleRow(
            UUID id,
            UUID accountId,
            String fundName,
            String fundKey,
            LocalDate saleDate,
            double unitsSold,
            double salePricePerUnit
    ) {
    }

    private record LotSlice(
            PurchaseRow purchase,
            double remainingUnits
    ) {
    }
}
