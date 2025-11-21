package com.assettracker.controller;

import com.assettracker.model.AddHoldingRequest;
import com.assettracker.model.Holding;
import com.assettracker.model.QuoteResult;
import com.assettracker.model.StockSummary;
import com.assettracker.service.QuoteProvider;
import com.assettracker.service.StockPortfolioService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.List;

@RestController
@RequestMapping("/api/stocks")
public class StockController {

    private final StockPortfolioService stockPortfolioService;
    private final QuoteProvider quoteProvider;

    public StockController(StockPortfolioService stockPortfolioService, QuoteProvider quoteProvider) {
        this.stockPortfolioService = stockPortfolioService;
        this.quoteProvider = quoteProvider;
    }

    @GetMapping("/markets/{market}/holdings")
    public List<Holding> holdings(@RequestHeader(value = "X-User-Id", required = false) String userId,
                                  @PathVariable String market,
                                  @RequestParam(name = "sort", required = false) String sort) {
        boolean sortByDayChange = "dayChangePct".equalsIgnoreCase(sort);
        return stockPortfolioService.getHoldings(userId, market, sortByDayChange);
    }

    @PostMapping("/markets/{market}/holdings")
    public Holding addHolding(@RequestHeader(value = "X-User-Id", required = false) String userId,
                              @PathVariable String market,
                              @RequestBody AddHoldingRequest request) {
        return stockPortfolioService.addHolding(userId, request);
    }

    @GetMapping("/markets/{market}/summary")
    public StockSummary summary(@RequestHeader(value = "X-User-Id", required = false) String userId,
                                @PathVariable String market) {
        return stockPortfolioService.summary(userId, market);
    }

    @GetMapping("/search")
    public List<QuoteResult> search(@RequestParam String query,
                                    @RequestParam(required = false) String market,
                                    @RequestParam(required = false) List<String> types) {
        return quoteProvider.search(query, market, types);
    }
}
