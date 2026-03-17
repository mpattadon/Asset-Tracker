package com.assettracker.service;

import com.assettracker.model.QuoteResult;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Primary
@Component
public class CompositeQuoteProvider implements QuoteProvider {

    private final AlpacaQuoteProvider alpacaQuoteProvider;
    private final StubQuoteProvider stubQuoteProvider;

    public CompositeQuoteProvider(AlpacaQuoteProvider alpacaQuoteProvider, StubQuoteProvider stubQuoteProvider) {
        this.alpacaQuoteProvider = alpacaQuoteProvider;
        this.stubQuoteProvider = stubQuoteProvider;
    }

    @Override
    public Optional<QuoteResult> lookup(String symbol, String market) {
        if ("us".equalsIgnoreCase(market) || "US".equalsIgnoreCase(market)) {
            Optional<QuoteResult> alpacaQuote = alpacaQuoteProvider.lookup(symbol);
            if (alpacaQuote.isPresent()) {
                return alpacaQuote;
            }
        }
        return stubQuoteProvider.lookup(symbol, market);
    }

    @Override
    public List<QuoteResult> search(String query, String market, List<String> types) {
        if ("us".equalsIgnoreCase(market) || "US".equalsIgnoreCase(market)) {
            List<QuoteResult> alpacaResults = alpacaQuoteProvider.search(query, types);
            if (!alpacaResults.isEmpty()) {
                return alpacaResults;
            }
        }
        return stubQuoteProvider.search(query, market, types);
    }
}
