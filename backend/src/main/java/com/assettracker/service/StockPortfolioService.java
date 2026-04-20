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

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class StockPortfolioService {

    private final CurrentUserService currentUserService;
    private final PortfolioQueryService portfolioQueryService;
    private final StockLedgerService stockLedgerService;

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
        return stockLedgerService.createPortfolio(
                currentUserService.resolveUser(request, userIdHeader),
                requestBody
        );
    }

    public void deletePortfolio(HttpServletRequest request,
                                String userIdHeader,
                                String portfolioId) {
        stockLedgerService.deletePortfolio(
                currentUserService.resolveUser(request, userIdHeader),
                portfolioId
        );
    }

    public List<StockPositionView> getPortfolioHoldings(HttpServletRequest request,
                                                        String userIdHeader,
                                                        String portfolioId,
                                                        boolean sortByDayChange) {
        Optional<PortfolioMetadataRepository.UserRecord> user = currentUserService.resolveOptionalUser(request, userIdHeader);
        if (user.isEmpty()) {
            return List.of();
        }
        return stockLedgerService.getHoldingsByPortfolio(
                user.get(),
                portfolioId,
                sortByDayChange
        );
    }

    public StockSummary portfolioSummary(HttpServletRequest request,
                                         String userIdHeader,
                                         String portfolioId) {
        Optional<PortfolioMetadataRepository.UserRecord> user = currentUserService.resolveOptionalUser(request, userIdHeader);
        if (user.isEmpty()) {
            return emptySummary(portfolioId, "All Portfolios");
        }
        return stockLedgerService.getSummaryByPortfolio(
                user.get(),
                portfolioId
        );
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
        return stockLedgerService.addTransactionByPortfolio(
                currentUserService.resolveUser(request, userIdHeader),
                portfolioId,
                requestBody
        );
    }

    public StockPositionView addHolding(HttpServletRequest request,
                                        String userIdHeader,
                                        String market,
                                        AddHoldingRequest requestBody) {
        return stockLedgerService.addBuyFromHoldingRequest(
                currentUserService.resolveUser(request, userIdHeader),
                market,
                requestBody
        );
    }

    public StockSummary summary(HttpServletRequest request,
                                String userIdHeader,
                                String market) {
        Optional<PortfolioMetadataRepository.UserRecord> user = currentUserService.resolveOptionalUser(request, userIdHeader);
        if (user.isEmpty()) {
            return emptySummary(market, "Stocks");
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
        return stockLedgerService.addTransaction(
                currentUserService.resolveUser(request, userIdHeader),
                market,
                requestBody
        );
    }

    private StockSummary emptySummary(String scope, String title) {
        return new StockSummary(
                scope == null || scope.isBlank() ? "all" : scope,
                title,
                "USD",
                0,
                0,
                0,
                0,
                0,
                new ArrayList<>(),
                new ArrayList<>()
        );
    }
}
