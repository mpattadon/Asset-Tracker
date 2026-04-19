package com.assettracker.controller;

import com.assettracker.model.BanksData;
import com.assettracker.model.BondHolding;
import com.assettracker.model.ExpensesData;
import com.assettracker.model.FundHolding;
import com.assettracker.model.GoldPosition;
import com.assettracker.model.LotteryEntry;
import com.assettracker.model.StocksData;
import com.assettracker.model.SummaryData;
import com.assettracker.service.AssetDataService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import jakarta.servlet.http.HttpServletRequest;

import java.util.List;

@RestController
@RequestMapping("/api/assets")
public class AssetController {

    private final AssetDataService assetDataService;

    public AssetController(AssetDataService assetDataService) {
        this.assetDataService = assetDataService;
    }

    @GetMapping("/summary")
    public SummaryData summary(HttpServletRequest request,
                               @RequestHeader(value = "X-User-Id", required = false) String userId) {
        return assetDataService.getSummary(request, userId);
    }

    @GetMapping("/stocks")
    public StocksData.StockMarketData stocks(HttpServletRequest request,
                                             @RequestHeader(value = "X-User-Id", required = false) String userId,
                                             @RequestParam(defaultValue = "thai") String market) {
        return assetDataService.getStocks(request, userId, market);
    }

    @GetMapping("/bonds")
    public List<BondHolding> bonds(HttpServletRequest request,
                                   @RequestHeader(value = "X-User-Id", required = false) String userId) {
        return assetDataService.getBonds(request, userId);
    }

    @GetMapping("/gold")
    public List<GoldPosition> gold(HttpServletRequest request,
                                   @RequestHeader(value = "X-User-Id", required = false) String userId) {
        return assetDataService.getGold(request, userId);
    }

    @GetMapping("/funds")
    public List<FundHolding> funds(HttpServletRequest request,
                                   @RequestHeader(value = "X-User-Id", required = false) String userId) {
        return assetDataService.getFunds(request, userId);
    }

    @GetMapping("/banks")
    public BanksData.BankRegionData banks(HttpServletRequest request,
                                          @RequestHeader(value = "X-User-Id", required = false) String userId,
                                          @RequestParam(defaultValue = "thai") String region) {
        return assetDataService.getBanks(request, userId, region);
    }

    @GetMapping("/lottery")
    public List<LotteryEntry> lottery(HttpServletRequest request,
                                      @RequestHeader(value = "X-User-Id", required = false) String userId) {
        return assetDataService.getLottery(request, userId);
    }

    @GetMapping("/expenses")
    public ExpensesData expenses(HttpServletRequest request,
                                 @RequestHeader(value = "X-User-Id", required = false) String userId) {
        return assetDataService.getExpenses(request, userId);
    }
}
