package com.assettracker.controller;

import com.assettracker.model.ExchangeRateResponse;
import com.assettracker.service.MarketDataProvider;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;

@RestController
@RequestMapping("/api/market")
public class MarketController {

    private final MarketDataProvider marketDataProvider;

    public MarketController(MarketDataProvider marketDataProvider) {
        this.marketDataProvider = marketDataProvider;
    }

    @GetMapping("/fx")
    public ExchangeRateResponse exchangeRate(@RequestParam String base,
                                             @RequestParam String quote) {
        String normalizedBase = base.trim().toUpperCase(Locale.ROOT);
        String normalizedQuote = quote.trim().toUpperCase(Locale.ROOT);
        double rate = marketDataProvider.fxRate(normalizedBase, normalizedQuote)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "FX rate not found"));
        double inverseRate = rate == 0 ? 0 : 1 / rate;
        return new ExchangeRateResponse(normalizedBase, normalizedQuote, rate, inverseRate);
    }
}
