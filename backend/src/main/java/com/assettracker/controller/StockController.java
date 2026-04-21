package com.assettracker.controller;

import com.assettracker.model.AddHoldingRequest;
import com.assettracker.model.CreateStockPortfolioRequest;
import com.assettracker.model.QuoteResult;
import com.assettracker.model.StockChartDataResponse;
import com.assettracker.model.StockChartDetailsResponse;
import com.assettracker.model.StockChartHistoryResponse;
import com.assettracker.model.StockPortfolioView;
import com.assettracker.model.StockPositionView;
import com.assettracker.model.StockSummary;
import com.assettracker.model.StockTransactionRequest;
import com.assettracker.model.StockTransactionView;
import com.assettracker.service.CurrentUserService;
import com.assettracker.service.MarketDataProvider;
import com.assettracker.service.QuoteProvider;
import com.assettracker.service.PortfolioMetadataRepository;
import com.assettracker.service.StockPortfolioService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;

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

    @GetMapping("/portfolios")
    public List<StockPortfolioView> portfolios(HttpServletRequest request,
                                               @RequestHeader(value = "X-User-Id", required = false) String userId) {
        return stockPortfolioService.listPortfolios(request, userId);
    }

    @PostMapping("/portfolios")
    public StockPortfolioView createPortfolio(HttpServletRequest request,
                                              @RequestHeader(value = "X-User-Id", required = false) String userId,
                                              @Valid @RequestBody CreateStockPortfolioRequest requestBody) {
        return stockPortfolioService.createPortfolio(request, userId, requestBody);
    }

    @DeleteMapping("/portfolios/{portfolioId}")
    public ResponseEntity<Void> deletePortfolio(HttpServletRequest request,
                                                @RequestHeader(value = "X-User-Id", required = false) String userId,
                                                @PathVariable String portfolioId) {
        stockPortfolioService.deletePortfolio(request, userId, portfolioId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/holdings")
    public List<StockPositionView> portfolioHoldings(HttpServletRequest request,
                                                     @RequestHeader(value = "X-User-Id", required = false) String userId,
                                                     @RequestHeader(value = "X-Preferred-Currency", required = false) String preferredCurrency,
                                                     @RequestParam(name = "portfolioId", required = false) String portfolioId,
                                                     @RequestParam(name = "sort", required = false) String sort) {
        boolean sortByDayChange = "dayChangePct".equalsIgnoreCase(sort);
        return stockPortfolioService.getPortfolioHoldings(request, userId, portfolioId, preferredCurrency, sortByDayChange);
    }

    @GetMapping("/summary")
    public StockSummary portfolioSummary(HttpServletRequest request,
                                         @RequestHeader(value = "X-User-Id", required = false) String userId,
                                         @RequestHeader(value = "X-Preferred-Currency", required = false) String preferredCurrency,
                                         @RequestParam(name = "portfolioId", required = false) String portfolioId) {
        return stockPortfolioService.portfolioSummary(request, userId, portfolioId, preferredCurrency);
    }

    @GetMapping("/transactions")
    public List<StockTransactionView> portfolioTransactions(HttpServletRequest request,
                                                            @RequestHeader(value = "X-User-Id", required = false) String userId,
                                                            @RequestParam(name = "portfolioId", required = false) String portfolioId) {
        return stockPortfolioService.portfolioTransactions(request, userId, portfolioId);
    }

    @PostMapping("/transactions")
    public StockTransactionView addPortfolioTransaction(HttpServletRequest request,
                                                        @RequestHeader(value = "X-User-Id", required = false) String userId,
                                                        @RequestParam(name = "portfolioId", required = false) String portfolioId,
                                                        @Valid @RequestBody StockTransactionRequest transactionRequest) {
        return stockPortfolioService.addPortfolioTransaction(request, userId, portfolioId, transactionRequest);
    }

    @PutMapping("/transactions/{transactionId}")
    public StockTransactionView updatePortfolioTransaction(HttpServletRequest request,
                                                           @RequestHeader(value = "X-User-Id", required = false) String userId,
                                                           @PathVariable String transactionId,
                                                           @Valid @RequestBody StockTransactionRequest transactionRequest) {
        return stockPortfolioService.updatePortfolioTransaction(request, userId, transactionId, transactionRequest);
    }

    @DeleteMapping("/transactions/{transactionId}")
    public ResponseEntity<Void> deletePortfolioTransaction(HttpServletRequest request,
                                                           @RequestHeader(value = "X-User-Id", required = false) String userId,
                                                           @PathVariable String transactionId) {
        stockPortfolioService.deletePortfolioTransaction(request, userId, transactionId);
        return ResponseEntity.noContent().build();
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

    @GetMapping("/markets/{market}/transactions")
    public List<StockTransactionView> transactions(HttpServletRequest request,
                                                   @RequestHeader(value = "X-User-Id", required = false) String userId,
                                                   @PathVariable String market) {
        return stockPortfolioService.transactions(request, userId, market);
    }

    @PostMapping("/markets/{market}/transactions")
    public StockTransactionView addTransaction(HttpServletRequest request,
                                               @RequestHeader(value = "X-User-Id", required = false) String userId,
                                               @PathVariable String market,
                                               @Valid @RequestBody StockTransactionRequest transactionRequest) {
        return stockPortfolioService.addTransaction(request, userId, market, transactionRequest);
    }

    @GetMapping("/search")
    public List<QuoteResult> search(HttpServletRequest request,
                                    @RequestHeader(value = "X-User-Id", required = false) String userId,
                                    @RequestParam String query,
                                    @RequestParam(required = false) String market,
                                    @RequestParam(required = false) List<String> types) {
        PortfolioMetadataRepository.UserRecord user = currentUserService.resolveOptionalUser(request, userId).orElse(null);
        return quoteProvider.search(user, query, market, types);
    }

    @GetMapping("/inspect")
    public MarketDataProvider.InspectionResult inspect(HttpServletRequest request,
                                                       @RequestHeader(value = "X-User-Id", required = false) String userId,
                                                       @RequestParam String symbol,
                                                       @RequestParam(required = false) String market,
                                                       @RequestParam(defaultValue = "1d") String period,
                                                       @RequestParam(defaultValue = "5m") String interval) {
        PortfolioMetadataRepository.UserRecord user = currentUserService.resolveOptionalUser(request, userId).orElse(null);
        return resolveInspection(user, symbol, market, period, interval)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticker not found"));
    }

    @GetMapping("/chart-data")
    public StockChartDataResponse chartData(HttpServletRequest request,
                                            @RequestHeader(value = "X-User-Id", required = false) String userId,
                                            @RequestParam String symbol,
                                            @RequestParam(required = false) String market) {
        PortfolioMetadataRepository.UserRecord user = currentUserService.resolveOptionalUser(request, userId).orElse(null);
        QuoteResult quote = resolveQuote(user, symbol, market)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticker not found"));
        String resolvedSymbol = quote.symbol();
        String resolvedMarket = quote.market();
        CompletableFuture<List<MarketDataProvider.HistoricalBar>> intradayFuture = CompletableFuture.supplyAsync(
                () -> marketDataProvider.history(user, resolvedSymbol, resolvedMarket, "5d", "5m")
        );
        CompletableFuture<List<MarketDataProvider.HistoricalBar>> dailyFuture = CompletableFuture.supplyAsync(
                () -> marketDataProvider.history(user, resolvedSymbol, resolvedMarket, "5d", "1d")
        );

        try {
            List<MarketDataProvider.HistoricalBar> intradayHistory = intradayFuture.join();
            List<MarketDataProvider.HistoricalBar> dailyHistory = dailyFuture.join();
            MarketDataProvider.HistoricalBar latestBar = !intradayHistory.isEmpty()
                    ? intradayHistory.get(intradayHistory.size() - 1)
                    : !dailyHistory.isEmpty() ? dailyHistory.get(dailyHistory.size() - 1) : null;
            Double previousClose = dailyHistory.size() >= 2
                    ? dailyHistory.get(dailyHistory.size() - 2).close()
                    : intradayHistory.size() >= 2 ? intradayHistory.get(intradayHistory.size() - 2).close() : null;
            return new StockChartDataResponse(
                    symbol.trim().toUpperCase(Locale.ROOT),
                    resolvedSymbol,
                    resolvedMarket,
                    quote.name(),
                    quote.type(),
                    quote.currency(),
                    quote.price(),
                    quote.dayChangePct(),
                    null,
                    null,
                    previousClose,
                    latestBar == null ? null : latestBar.open(),
                    latestBar == null ? null : latestBar.high(),
                    latestBar == null ? null : latestBar.low(),
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    List.of(),
                    null,
                    null,
                    null,
                    intradayHistory,
                    dailyHistory
            );
        } catch (CompletionException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Unable to load chart data", exception);
        }
    }

    @GetMapping("/chart-history")
    public StockChartHistoryResponse chartHistory(HttpServletRequest request,
                                                  @RequestHeader(value = "X-User-Id", required = false) String userId,
                                                  @RequestParam String symbol,
                                                  @RequestParam(required = false) String market) {
        PortfolioMetadataRepository.UserRecord user = currentUserService.resolveOptionalUser(request, userId).orElse(null);
        QuoteResult quote = resolveQuote(user, symbol, market)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticker not found"));
        return new StockChartHistoryResponse(
                marketDataProvider.history(user, quote.symbol(), quote.market(), "max", "1d")
        );
    }

    @GetMapping("/details")
    public StockChartDetailsResponse chartDetails(HttpServletRequest request,
                                                  @RequestHeader(value = "X-User-Id", required = false) String userId,
                                                  @RequestParam String symbol,
                                                  @RequestParam(required = false) String market) {
        PortfolioMetadataRepository.UserRecord user = currentUserService.resolveOptionalUser(request, userId).orElse(null);
        QuoteResult quote = resolveQuote(user, symbol, market)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticker not found"));
        MarketDataProvider.InspectionResult inspection = marketDataProvider.inspect(user, quote.symbol(), quote.market(), "5d", "1d")
                .orElseGet(() -> new MarketDataProvider.InspectionResult(
                        symbol.trim().toUpperCase(Locale.ROOT),
                        quote.symbol(),
                        quote.market(),
                        quote.name(),
                        quote.type(),
                        quote.currency(),
                        quote.price(),
                        quote.dayChangePct(),
                        null, // exchange
                        null, // timezone
                        null, // previousClose
                        null, // openPrice
                        null, // dayHigh
                        null, // dayLow
                        null, // fiftyTwoWeekHigh
                        null, // fiftyTwoWeekLow
                        null, // volume
                        null, // averageVolume
                        null, // marketCap
                        null, // sector
                        null, // industry
                        null, // website
                        null, // longBusinessSummary
                        null, // headquarters
                        null, // country
                        null, // ceo
                        null, // fullTimeEmployees
                        null, // beta
                        null, // trailingPe
                        null, // forwardPe
                        null, // trailingEps
                        null, // forwardEps
                        null, // dividendYield
                        null, // fiftyDayAverage
                        null, // twoHundredDayAverage
                        null, // sharesOutstanding
                        List.of(),
                        null,
                        null,
                        null,
                        List.of()
                ));
        return new StockChartDetailsResponse(
                inspection.requestedSymbol(),
                inspection.normalizedSymbol(),
                inspection.market(),
                inspection.name(),
                inspection.type(),
                inspection.currency(),
                inspection.price(),
                inspection.dayChangePct(),
                inspection.exchange(),
                inspection.timezone(),
                inspection.previousClose(),
                inspection.openPrice(),
                inspection.dayHigh(),
                inspection.dayLow(),
                inspection.fiftyTwoWeekHigh(),
                inspection.fiftyTwoWeekLow(),
                inspection.volume(),
                inspection.averageVolume(),
                inspection.marketCap(),
                inspection.sector(),
                inspection.industry(),
                inspection.website(),
                inspection.longBusinessSummary(),
                inspection.headquarters(),
                inspection.country(),
                inspection.ceo(),
                inspection.fullTimeEmployees(),
                inspection.beta(),
                inspection.trailingPe(),
                inspection.forwardPe(),
                inspection.trailingEps(),
                inspection.forwardEps(),
                inspection.dividendYield(),
                inspection.fiftyDayAverage(),
                inspection.twoHundredDayAverage(),
                inspection.sharesOutstanding(),
                inspection.news(),
                inspection.incomeStatement(),
                inspection.balanceSheet(),
                inspection.cashFlow()
        );
    }

    private Optional<MarketDataProvider.InspectionResult> resolveInspection(PortfolioMetadataRepository.UserRecord user,
                                                                            String symbol,
                                                                            String market,
                                                                            String period,
                                                                            String interval) {
        Optional<MarketDataProvider.InspectionResult> direct = marketDataProvider.inspect(user, symbol, market, period, interval);
        if (direct.isPresent()) {
            return direct;
        }

        for (String queryVariant : queryVariants(symbol)) {
            List<QuoteResult> candidates = marketDataProvider.search(user, queryVariant, market, List.of());
            List<QuoteResult> exactCandidates = candidates.stream()
                    .filter(candidate -> canonicalSymbol(candidate.symbol()).equalsIgnoreCase(canonicalSymbol(symbol)))
                    .filter(candidate -> market == null || market.isBlank() || market.equalsIgnoreCase(candidate.market()))
                    .toList();
            List<QuoteResult> candidatesToTry = exactCandidates.isEmpty()
                    ? candidates.stream()
                    .filter(candidate -> market == null || market.isBlank() || market.equalsIgnoreCase(candidate.market()))
                    .sorted((left, right) -> Integer.compare(
                            scoreCandidate(right, symbol, market),
                            scoreCandidate(left, symbol, market)
                    ))
                    .toList()
                    : exactCandidates;
            Optional<MarketDataProvider.InspectionResult> resolved = candidatesToTry.stream()
                    .filter(candidate -> market == null || market.isBlank() || market.equalsIgnoreCase(candidate.market()))
                    .map(candidate -> marketDataProvider.inspect(user, candidate.symbol(), candidate.market(), period, interval))
                    .flatMap(Optional::stream)
                    .findFirst();
            if (resolved.isPresent()) {
                return resolved;
            }
        }

        return Optional.empty();
    }

    private Optional<QuoteResult> resolveQuote(PortfolioMetadataRepository.UserRecord user,
                                               String symbol,
                                               String market) {
        Optional<QuoteResult> direct = quoteProvider.lookup(user, symbol, market);
        if (direct.isPresent()) {
            return direct;
        }

        for (String queryVariant : queryVariants(symbol)) {
            Optional<QuoteResult> candidate = quoteProvider.search(user, queryVariant, market, List.of()).stream()
                    .filter(result -> market == null || market.isBlank() || market.equalsIgnoreCase(result.market()))
                    .sorted((left, right) -> Integer.compare(
                            scoreCandidate(right, symbol, market),
                            scoreCandidate(left, symbol, market)
                    ))
                    .findFirst();
            if (candidate.isPresent()) {
                return candidate;
            }
        }

        return Optional.empty();
    }

    private List<String> queryVariants(String symbol) {
        String trimmed = symbol == null ? "" : symbol.trim();
        if (trimmed.isBlank()) {
            return List.of();
        }
        String withoutPrefix = trimmed.contains(":") ? trimmed.substring(trimmed.indexOf(':') + 1) : trimmed;
        String withoutSuffix = withoutPrefix.contains(".")
                ? withoutPrefix.substring(0, withoutPrefix.indexOf('.'))
                : withoutPrefix;
        return List.of(trimmed, withoutPrefix, withoutSuffix).stream()
                .filter(value -> !value.isBlank())
                .distinct()
                .toList();
    }

    private int scoreCandidate(QuoteResult candidate, String requestedSymbol, String requestedMarket) {
        int score = 0;
        String candidateSymbol = canonicalSymbol(candidate.symbol());
        String requestedCanonical = canonicalSymbol(requestedSymbol);
        if (candidateSymbol.equalsIgnoreCase(requestedCanonical)) {
            score += 4;
        }
        if (candidate.symbol().equalsIgnoreCase(requestedSymbol)) {
            score += 2;
        }
        if (requestedMarket != null && requestedMarket.equalsIgnoreCase(candidate.market())) {
            score += 2;
        }
        return score;
    }

    private String canonicalSymbol(String value) {
        if (value == null) {
            return "";
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        if (normalized.contains(":")) {
            normalized = normalized.substring(normalized.indexOf(':') + 1);
        }
        if (normalized.contains(".")) {
            normalized = normalized.substring(0, normalized.indexOf('.'));
        }
        return normalized;
    }
}
