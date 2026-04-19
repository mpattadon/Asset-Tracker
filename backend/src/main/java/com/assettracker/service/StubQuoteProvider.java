package com.assettracker.service;

import com.assettracker.model.QuoteResult;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
public class StubQuoteProvider implements QuoteProvider, MarketDataProvider {

    private final List<QuoteResult> seeds = Arrays.asList(
            new QuoteResult("AAPL", "Apple Inc.", "US", "Stock", "USD", 189.75, 0.9),
            new QuoteResult("MSFT", "Microsoft Corp.", "US", "Stock", "USD", 412.30, 0.81),
            new QuoteResult("VOO", "Vanguard S&P 500 ETF", "US", "ETF", "USD", 475.10, -0.09),
            new QuoteResult("NVDA", "NVIDIA Corp.", "US", "Stock", "USD", 918.25, 1.18),
            new QuoteResult("AMZN", "Amazon.com Inc.", "US", "Stock", "USD", 178.42, 0.52),
            new QuoteResult("SET:PTT", "PTT Oil and Retail Business PCL", "TH", "Stock", "THB", 13.20, -0.75),
            new QuoteResult("SET:DOD", "DOD Biotech PCL", "TH", "Stock", "THB", 1.65, -1.79)
    );

    @Override
    public Optional<QuoteResult> lookup(PortfolioMetadataRepository.UserRecord user, String symbol, String market) {
        return seeds.stream()
                .filter(q -> q.symbol().equalsIgnoreCase(symbol)
                        && (market == null || q.market().equalsIgnoreCase(market) || matchesMarketAlias(q.market(), market)))
                .findFirst();
    }

    @Override
    public List<QuoteResult> search(PortfolioMetadataRepository.UserRecord user, String query, String market, List<String> types) {
        return seeds.stream()
                .filter(q -> market == null || q.market().equalsIgnoreCase(market) || matchesMarketAlias(q.market(), market))
                .filter(q -> types == null || types.isEmpty() || types.contains(q.type()))
                .filter(q -> query == null || q.name().toLowerCase().contains(query.toLowerCase())
                        || q.symbol().toLowerCase().contains(query.toLowerCase()))
                .collect(Collectors.toList());
    }

    @Override
    public Optional<InspectionResult> inspect(PortfolioMetadataRepository.UserRecord user,
                                              String symbol,
                                              String market,
                                              String period,
                                              String interval) {
        Optional<QuoteResult> quote = lookup(user, symbol, market);
        if (quote.isEmpty()) {
            return Optional.empty();
        }
        QuoteResult result = quote.get();
        return Optional.of(new InspectionResult(
                symbol,
                normalizeSymbol(result.symbol(), market),
                result.market(),
                result.name(),
                result.type(),
                result.currency(),
                result.price(),
                result.dayChangePct(),
                "Stub Exchange",
                "America/New_York",
                result.price() * 0.99,
                result.price() * 0.995,
                result.price() * 1.01,
                result.price() * 0.98,
                result.price() * 1.12,
                result.price() * 0.81,
                1_250_000d,
                1_900_000d,
                125_000_000_000d,
                "Technology",
                "Diagnostics",
                "https://example.test",
                history(user, symbol, market, period, interval)
        ));
    }

    @Override
    public List<HistoricalBar> history(PortfolioMetadataRepository.UserRecord user,
                                       String symbol,
                                       String market,
                                       String period,
                                       String interval) {
        double base = lookup(user, symbol, market).map(QuoteResult::price).orElse(100d);
        return List.of(
                new HistoricalBar("P1", base * 0.95, base * 0.97, base * 0.94, base * 0.96),
                new HistoricalBar("P2", base * 0.96, base * 0.98, base * 0.95, base * 0.97),
                new HistoricalBar("P3", base * 0.97, base * 0.99, base * 0.96, base * 0.98),
                new HistoricalBar("P4", base * 0.98, base, base * 0.97, base * 0.99),
                new HistoricalBar("P5", base * 0.99, base * 1.01, base * 0.98, base)
        );
    }

    private boolean matchesMarketAlias(String quoteMarket, String requestedMarket) {
        return "US".equalsIgnoreCase(quoteMarket) && "us".equalsIgnoreCase(requestedMarket)
                || "TH".equalsIgnoreCase(quoteMarket) && "thai".equalsIgnoreCase(requestedMarket);
    }

    private String normalizeSymbol(String symbol, String market) {
        if (market == null) {
            return symbol;
        }
        if ("TH".equalsIgnoreCase(market) || "thai".equalsIgnoreCase(market)) {
            return symbol.endsWith(".BK") ? symbol : symbol + ".BK";
        }
        return symbol;
    }
}
