package com.assettracker.service;

import com.assettracker.model.AddHoldingRequest;
import com.assettracker.model.StockPositionView;
import com.assettracker.model.StockSummary;
import com.assettracker.model.StockTransactionRequest;
import com.assettracker.model.StockTransactionView;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;

import java.util.List;

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
        return portfolioQueryService.getStockHoldings(
                currentUserService.resolveUser(request, userIdHeader),
                market,
                sortByDayChange
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
        return stockLedgerService.getSummary(
                currentUserService.resolveUser(request, userIdHeader),
                market
        );
    }

    public List<StockTransactionView> transactions(HttpServletRequest request,
                                                   String userIdHeader,
                                                   String market) {
        return stockLedgerService.getTransactions(
                currentUserService.resolveUser(request, userIdHeader),
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
}
