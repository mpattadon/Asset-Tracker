package com.assettracker.controller;

import com.assettracker.model.AddHoldingRequest;
import com.assettracker.model.QuoteResult;
import com.assettracker.model.StockPositionView;
import com.assettracker.model.StockSummary;
import com.assettracker.service.CurrentUserService;
import com.assettracker.service.MarketDataProvider;
import com.assettracker.service.QuoteProvider;
import com.assettracker.service.PortfolioMetadataRepository;
import com.assettracker.service.StockPortfolioService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/stocks")
public class StockController {

    private final StockPortfolioService stockPortfolioService;
    private final QuoteProvider quoteProvider;
    private final MarketDataProvider marketDataProvider;
    private final CurrentUserService currentUserService;

    public StockController(StockPortfolioService stockPortfolioService,
                           QuoteProvider quoteProvider,
                           MarketDataProvider marketDataProvider,
                           CurrentUserService currentUserService) {
        this.stockPortfolioService = stockPortfolioService;
        this.quoteProvider = quoteProvider;
        this.marketDataProvider = marketDataProvider;
        this.currentUserService = currentUserService;
    }

    @GetMapping("/markets/{market}/holdings")
    public List<StockPositionView> holdings(HttpServletRequest request,
                                            @RequestHeader(value = "X-User-Id", required = false) String userId,
                                            @PathVariable String market,
                                            @RequestParam(name = "sort", required = false) String sort) {
        boolean sortByDayChange = "dayChangePct".equalsIgnoreCase(sort);
        return stockPortfolioService.getHoldings(request, userId, market, sortByDayChange);
    }

    @PostMapping("/markets/{market}/holdings")
    public StockPositionView addHolding(HttpServletRequest httpRequest,
                                        @RequestHeader(value = "X-User-Id", required = false) String userId,
                                        @PathVariable String market,
                                        @Valid @RequestBody AddHoldingRequest request) {
        return stockPortfolioService.addHolding(httpRequest, userId, market, request);
    }

    @GetMapping("/markets/{market}/summary")
    public StockSummary summary(HttpServletRequest request,
                                @RequestHeader(value = "X-User-Id", required = false) String userId,
                                @PathVariable String market) {
        return stockPortfolioService.summary(request, userId, market);
    }

    @GetMapping("/search")
    public List<QuoteResult> search(HttpServletRequest request,
                                    @RequestHeader(value = "X-User-Id", required = false) String userId,
                                    @RequestParam String query,
                                    @RequestParam(required = false) String market,
                                    @RequestParam(required = false) List<String> types) {
        PortfolioMetadataRepository.UserRecord user = currentUserService.resolveUser(request, userId);
        return quoteProvider.search(user, query, market, types);
    }

    @GetMapping("/inspect")
    public MarketDataProvider.InspectionResult inspect(HttpServletRequest request,
                                                       @RequestHeader(value = "X-User-Id", required = false) String userId,
                                                       @RequestParam String symbol,
                                                       @RequestParam(required = false) String market,
                                                       @RequestParam(defaultValue = "1d") String period,
                                                       @RequestParam(defaultValue = "5m") String interval) {
        PortfolioMetadataRepository.UserRecord user = currentUserService.resolveUser(request, userId);
        return marketDataProvider.inspect(user, symbol, market, period, interval)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticker not found"));
    }
}
