package com.assettracker.service;

import com.assettracker.model.AddHoldingRequest;
import com.assettracker.model.CreateStockPortfolioRequest;
import com.assettracker.model.StockPortfolioView;
import com.assettracker.model.StockPositionView;
import com.assettracker.model.StockSummary;
import com.assettracker.model.StockTransactionRequest;
import com.assettracker.model.StockTransactionView;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
public class StockPortfolioService {
    private static final Duration SUMMARY_CACHE_TTL = Duration.ofSeconds(30);

    private final CurrentUserService currentUserService;
    private final PortfolioQueryService portfolioQueryService;
    private final StockLedgerService stockLedgerService;
    private final ConcurrentMap<String, CachedSummary> summaryCache = new ConcurrentHashMap<>();

    public StockPortfolioService(CurrentUserService currentUserService,
                                 PortfolioQueryService portfolioQueryService,
                                 StockLedgerService stockLedgerService) {
        this.currentUserService = currentUserService;
        this.portfolioQueryService = portfolioQueryService;
        this.stockLedgerService = stockLedgerService;
    }

    public List<StockPositionView> getHoldings(HttpServletRequest request,
                                               String userIdHeader,
                                               String market,
                                               boolean sortByDayChange) {
        Optional<PortfolioMetadataRepository.UserRecord> user = currentUserService.resolveOptionalUser(request, userIdHeader);
        if (user.isEmpty()) {
            return List.of();
        }
        return portfolioQueryService.getStockHoldings(
                user.get(),
                market,
                sortByDayChange
        );
    }

    public List<StockPortfolioView> listPortfolios(HttpServletRequest request,
                                                   String userIdHeader) {
        Optional<PortfolioMetadataRepository.UserRecord> user = currentUserService.resolveOptionalUser(request, userIdHeader);
        return user.map(stockLedgerService::listPortfolios).orElseGet(List::of);
    }

    public StockPortfolioView createPortfolio(HttpServletRequest request,
                                              String userIdHeader,
                                              CreateStockPortfolioRequest requestBody) {
        StockPortfolioView created = stockLedgerService.createPortfolio(
                currentUserService.resolveUser(request, userIdHeader),
                requestBody
        );
        invalidateSummaryCache();
        return created;
    }

    public void deletePortfolio(HttpServletRequest request,
                                String userIdHeader,
                                String portfolioId) {
        stockLedgerService.deletePortfolio(
                currentUserService.resolveUser(request, userIdHeader),
                portfolioId
        );
        invalidateSummaryCache();
    }

    public List<StockPositionView> getPortfolioHoldings(HttpServletRequest request,
                                                        String userIdHeader,
                                                        String portfolioId,
                                                        String preferredCurrency,
                                                        boolean sortByDayChange) {
        Optional<PortfolioMetadataRepository.UserRecord> user = currentUserService.resolveOptionalUser(request, userIdHeader);
        if (user.isEmpty()) {
            return List.of();
        }
        return stockLedgerService.getHoldingsByPortfolio(
                user.get(),
                portfolioId,
                preferredCurrency,
                sortByDayChange
        );
    }

    public StockSummary portfolioSummary(HttpServletRequest request,
                                         String userIdHeader,
                                         String portfolioId,
                                         String preferredCurrency) {
        Optional<PortfolioMetadataRepository.UserRecord> user = currentUserService.resolveOptionalUser(request, userIdHeader);
        if (user.isEmpty()) {
            return emptySummary(portfolioId, "All Portfolios", preferredCurrency);
        }
        String cacheKey = summaryCacheKey(user.get(), portfolioId, preferredCurrency);
        CachedSummary cached = summaryCache.get(cacheKey);
        if (cached != null && cached.createdAt().plus(SUMMARY_CACHE_TTL).isAfter(Instant.now())) {
            return cached.summary();
        }
        StockSummary summary = stockLedgerService.getSummaryByPortfolio(
                user.get(),
                portfolioId,
                preferredCurrency
        );
        summaryCache.put(cacheKey, new CachedSummary(summary, Instant.now()));
        return summary;
    }

    public List<StockTransactionView> portfolioTransactions(HttpServletRequest request,
                                                            String userIdHeader,
                                                            String portfolioId) {
        Optional<PortfolioMetadataRepository.UserRecord> user = currentUserService.resolveOptionalUser(request, userIdHeader);
        if (user.isEmpty()) {
            return List.of();
        }
        return stockLedgerService.getTransactionsByPortfolio(
                user.get(),
                portfolioId
        );
    }

    public StockTransactionView addPortfolioTransaction(HttpServletRequest request,
                                                        String userIdHeader,
                                                        String portfolioId,
                                                        StockTransactionRequest requestBody) {
        StockTransactionView created = stockLedgerService.addTransactionByPortfolio(
                currentUserService.resolveUser(request, userIdHeader),
                portfolioId,
                requestBody
        );
        invalidateSummaryCache();
        return created;
    }

    public StockTransactionView updatePortfolioTransaction(HttpServletRequest request,
                                                           String userIdHeader,
                                                           String transactionId,
                                                           StockTransactionRequest requestBody) {
        StockTransactionView updated = stockLedgerService.updateTransaction(
                currentUserService.resolveUser(request, userIdHeader),
                transactionId,
                requestBody
        );
        invalidateSummaryCache();
        return updated;
    }

    public void deletePortfolioTransaction(HttpServletRequest request,
                                           String userIdHeader,
                                           String transactionId) {
        stockLedgerService.deleteTransaction(
                currentUserService.resolveUser(request, userIdHeader),
                transactionId
        );
        invalidateSummaryCache();
    }

    public StockPositionView addHolding(HttpServletRequest request,
                                        String userIdHeader,
                                        String market,
                                        AddHoldingRequest requestBody) {
        StockPositionView created = stockLedgerService.addBuyFromHoldingRequest(
                currentUserService.resolveUser(request, userIdHeader),
                market,
                requestBody
        );
        invalidateSummaryCache();
        return created;
    }

    public StockSummary summary(HttpServletRequest request,
                                String userIdHeader,
                                String market) {
        Optional<PortfolioMetadataRepository.UserRecord> user = currentUserService.resolveOptionalUser(request, userIdHeader);
        if (user.isEmpty()) {
            return emptySummary(market, "Stocks", "USD");
        }
        return stockLedgerService.getSummary(
                user.get(),
                market
        );
    }

    public List<StockTransactionView> transactions(HttpServletRequest request,
                                                   String userIdHeader,
                                                   String market) {
        Optional<PortfolioMetadataRepository.UserRecord> user = currentUserService.resolveOptionalUser(request, userIdHeader);
        if (user.isEmpty()) {
            return List.of();
        }
        return stockLedgerService.getTransactions(
                user.get(),
                market
        );
    }

    public StockTransactionView addTransaction(HttpServletRequest request,
                                               String userIdHeader,
                                               String market,
                                               StockTransactionRequest requestBody) {
        StockTransactionView created = stockLedgerService.addTransaction(
                currentUserService.resolveUser(request, userIdHeader),
                market,
                requestBody
        );
        invalidateSummaryCache();
        return created;
    }

    private void invalidateSummaryCache() {
        summaryCache.clear();
    }

    private String summaryCacheKey(PortfolioMetadataRepository.UserRecord user,
                                   String portfolioId,
                                   String preferredCurrency) {
        return user.id() + "|" +
                (portfolioId == null || portfolioId.isBlank() ? "all" : portfolioId) + "|" +
                (preferredCurrency == null || preferredCurrency.isBlank() ? "" : preferredCurrency.trim().toUpperCase());
    }

    private record CachedSummary(StockSummary summary, Instant createdAt) {
    }

    private StockSummary emptySummary(String scope, String title, String currency) {
        return new StockSummary(
                scope == null || scope.isBlank() ? "all" : scope,
                title,
                currency == null || currency.isBlank() ? "USD" : currency,
                0,
                0,
                0,
                0,
                0,
                new ArrayList<>(),
                new ArrayList<>(),
                new ArrayList<>(),
                new ArrayList<>(),
                new ArrayList<>(),
                new ArrayList<>()
        );
    }
}
