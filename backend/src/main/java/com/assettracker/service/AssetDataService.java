package com.assettracker.service;

import com.assettracker.model.BanksData;
import com.assettracker.model.BondHolding;
import com.assettracker.model.ExpensesData;
import com.assettracker.model.FundHolding;
import com.assettracker.model.GoldPosition;
import com.assettracker.model.LotteryEntry;
import com.assettracker.model.StocksData;
import com.assettracker.model.SummaryData;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AssetDataService {

    private final CurrentUserService currentUserService;
    private final PortfolioQueryService portfolioQueryService;

    public AssetDataService(CurrentUserService currentUserService,
                            PortfolioQueryService portfolioQueryService) {
        this.currentUserService = currentUserService;
        this.portfolioQueryService = portfolioQueryService;
    }

    public SummaryData getSummary(HttpServletRequest request, String userIdHeader) {
        return portfolioQueryService.getSummary(currentUserService.resolveUser(request, userIdHeader));
    }

    public StocksData.StockMarketData getStocks(HttpServletRequest request, String userIdHeader, String market) {
        return portfolioQueryService.getStocks(currentUserService.resolveUser(request, userIdHeader), market);
    }

    public List<BondHolding> getBonds(HttpServletRequest request, String userIdHeader) {
        return portfolioQueryService.getBonds(currentUserService.resolveUser(request, userIdHeader));
    }

    public List<GoldPosition> getGold(HttpServletRequest request, String userIdHeader) {
        return portfolioQueryService.getGold(currentUserService.resolveUser(request, userIdHeader));
    }

    public List<FundHolding> getFunds(HttpServletRequest request, String userIdHeader) {
        return portfolioQueryService.getFunds(currentUserService.resolveUser(request, userIdHeader));
    }

    public BanksData.BankRegionData getBanks(HttpServletRequest request, String userIdHeader, String region) {
        return portfolioQueryService.getBanks(currentUserService.resolveUser(request, userIdHeader), region);
    }

    public List<LotteryEntry> getLottery(HttpServletRequest request, String userIdHeader) {
        return portfolioQueryService.getLottery(currentUserService.resolveUser(request, userIdHeader));
    }

    public ExpensesData getExpenses(HttpServletRequest request, String userIdHeader) {
        return portfolioQueryService.getExpenses(currentUserService.resolveUser(request, userIdHeader));
    }
}
