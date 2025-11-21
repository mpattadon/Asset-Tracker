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
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/assets")
public class AssetController {

    private final AssetDataService assetDataService;

    public AssetController(AssetDataService assetDataService) {
        this.assetDataService = assetDataService;
    }

    @GetMapping("/summary")
    public SummaryData summary(@RequestHeader(value = "X-User-Id", required = false) String userId) {
        return assetDataService.getSummary(userId);
    }

    @GetMapping("/stocks")
    public StocksData.StockMarketData stocks(@RequestHeader(value = "X-User-Id", required = false) String userId,
                                             @RequestParam(defaultValue = "thai") String market) {
        return assetDataService.getStocks(userId, market);
    }

    @GetMapping("/bonds")
    public List<BondHolding> bonds(@RequestHeader(value = "X-User-Id", required = false) String userId) {
        return assetDataService.getBonds(userId);
    }

    @GetMapping("/gold")
    public List<GoldPosition> gold(@RequestHeader(value = "X-User-Id", required = false) String userId) {
        return assetDataService.getGold(userId);
    }

    @GetMapping("/funds")
    public List<FundHolding> funds(@RequestHeader(value = "X-User-Id", required = false) String userId) {
        return assetDataService.getFunds(userId);
    }

    @GetMapping("/banks")
    public BanksData.BankRegionData banks(@RequestHeader(value = "X-User-Id", required = false) String userId,
                                          @RequestParam(defaultValue = "thai") String region) {
        return assetDataService.getBanks(userId, region);
    }

    @GetMapping("/lottery")
    public List<LotteryEntry> lottery(@RequestHeader(value = "X-User-Id", required = false) String userId) {
        return assetDataService.getLottery(userId);
    }

    @GetMapping("/expenses")
    public ExpensesData expenses(@RequestHeader(value = "X-User-Id", required = false) String userId) {
        return assetDataService.getExpenses(userId);
    }
}
