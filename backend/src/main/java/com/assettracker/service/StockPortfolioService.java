package com.assettracker.service;

import com.assettracker.model.AddHoldingRequest;
import com.assettracker.model.StockPositionView;
import com.assettracker.model.StockSummary;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class StockPortfolioService {

    private final CurrentUserService currentUserService;
    private final PortfolioQueryService portfolioQueryService;

    public StockPortfolioService(CurrentUserService currentUserService,
                                 PortfolioQueryService portfolioQueryService) {
        this.currentUserService = currentUserService;
        this.portfolioQueryService = portfolioQueryService;
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
        return portfolioQueryService.addStockHolding(
                currentUserService.resolveUser(request, userIdHeader),
                market,
                requestBody
        );
    }

    public StockSummary summary(HttpServletRequest request,
                                String userIdHeader,
                                String market) {
        return portfolioQueryService.getStockSummary(
                currentUserService.resolveUser(request, userIdHeader),
                market
        );
    }
}
