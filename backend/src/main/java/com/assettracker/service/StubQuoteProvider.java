package com.assettracker.service;

import com.assettracker.model.QuoteResult;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
public class StubQuoteProvider {

    private final List<QuoteResult> seeds = Arrays.asList(
            new QuoteResult("AAPL", "Apple Inc.", "US", "Stock", "USD", 189.75, 0.9),
            new QuoteResult("MSFT", "Microsoft Corp.", "US", "Stock", "USD", 412.30, 0.81),
            new QuoteResult("VOO", "Vanguard S&P 500 ETF", "US", "ETF", "USD", 475.10, -0.09),
            new QuoteResult("NVDA", "NVIDIA Corp.", "US", "Stock", "USD", 918.25, 1.18),
            new QuoteResult("AMZN", "Amazon.com Inc.", "US", "Stock", "USD", 178.42, 0.52),
            new QuoteResult("SET:PTT", "PTT Oil and Retail Business PCL", "TH", "Stock", "THB", 13.20, -0.75),
            new QuoteResult("SET:DOD", "DOD Biotech PCL", "TH", "Stock", "THB", 1.65, -1.79)
    );

    public Optional<QuoteResult> lookup(String symbol, String market) {
        return seeds.stream()
                .filter(q -> q.symbol().equalsIgnoreCase(symbol)
                        && (market == null || q.market().equalsIgnoreCase(market) || matchesMarketAlias(q.market(), market)))
                .findFirst();
    }

    public List<QuoteResult> search(String query, String market, List<String> types) {
        return seeds.stream()
                .filter(q -> market == null || q.market().equalsIgnoreCase(market) || matchesMarketAlias(q.market(), market))
                .filter(q -> types == null || types.isEmpty() || types.contains(q.type()))
                .filter(q -> query == null || q.name().toLowerCase().contains(query.toLowerCase())
                        || q.symbol().toLowerCase().contains(query.toLowerCase()))
                .collect(Collectors.toList());
    }

    private boolean matchesMarketAlias(String quoteMarket, String requestedMarket) {
        return "US".equalsIgnoreCase(quoteMarket) && "us".equalsIgnoreCase(requestedMarket)
                || "TH".equalsIgnoreCase(quoteMarket) && "thai".equalsIgnoreCase(requestedMarket);
    }
}
