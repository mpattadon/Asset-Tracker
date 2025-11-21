package com.assettracker.service;

import com.assettracker.model.AddHoldingRequest;
import com.assettracker.model.Holding;
import com.assettracker.model.StockSummary;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class StockPortfolioService {

    private final QuoteProvider quoteProvider;
    private final Map<String, Map<String, List<Holding>>> holdingsStore = new HashMap<>();

    public StockPortfolioService(QuoteProvider quoteProvider) {
        this.quoteProvider = quoteProvider;
        seedDefaults();
    }

    public List<Holding> getHoldings(String userId, String market, boolean sortByDayChange) {
        List<Holding> list = new ArrayList<>(storeForUser(userId).getOrDefault(marketKey(market), List.of()));
        if (sortByDayChange) {
            list.sort(Comparator.comparingDouble(Holding::dayChangePct).reversed());
        }
        return list;
    }

    public Holding addHolding(String userId, AddHoldingRequest request) {
        Holding holding = createHoldingWithQuote(request);
        List<Holding> list = new ArrayList<>(storeForUser(userId).getOrDefault(marketKey(request.market()), List.of()));
        list.add(holding);
        storeForUser(userId).put(marketKey(request.market()), list);
        return holding;
    }

    public StockSummary summary(String userId, String market) {
        List<Holding> list = storeForUser(userId).getOrDefault(marketKey(market), List.of());
        double totalValue = list.stream().mapToDouble(Holding::marketValue).sum();
        double weightedDay = list.stream().mapToDouble(h -> h.marketValue() * h.dayChangePct()).sum() / (totalValue == 0 ? 1 : totalValue);
        double totalChange = list.stream().mapToDouble(h -> (h.price() - h.avgCost()) * h.quantity()).sum();
        List<Double> series = list.stream().map(Holding::marketValue).collect(Collectors.toList());
        return new StockSummary(marketKey(market), totalValue, totalValue * weightedDay / 100, weightedDay, totalChange, totalValue == 0 ? 0 : (totalChange / totalValue) * 100, series);
    }

    private Holding createHoldingWithQuote(AddHoldingRequest request) {
        return quoteProvider.lookup(request.symbol(), request.market())
                .map(q -> new Holding(
                        q.symbol(),
                        q.name(),
                        q.market(),
                        q.type(),
                        q.price(),
                        request.quantity(),
                        request.price(),
                        q.dayChangePct(),
                        q.currency()
                ))
                .orElseGet(() -> new Holding(
                        request.symbol(),
                        request.name(),
                        request.market(),
                        request.type(),
                        request.price(),
                        request.quantity(),
                        request.price(),
                        0,
                        request.currency()
                ));
    }

    private String userKey(String userId) {
        return (userId == null || userId.isBlank()) ? "user-123" : userId;
    }

    private String marketKey(String market) {
        return (market == null || market.isBlank()) ? "thai" : market.toLowerCase();
    }

    private Map<String, List<Holding>> storeForUser(String userId) {
        return holdingsStore.computeIfAbsent(userKey(userId), k -> new HashMap<>());
    }

    private void seedDefaults() {
        String user = userKey(null);
        List<Holding> thai = List.of(
                new Holding("SET:DOD", "DOD Biotech PCL", "thai", "Stock", 1.65, 26000, 1.65, -1.79, "THB"),
                new Holding("SET:PTT", "PTT Oil and Retail Business PCL", "thai", "Stock", 13.2, 24000, 13.2, -0.75, "THB")
        );
        List<Holding> us = List.of(
                new Holding("AAPL", "Apple Inc.", "us", "Stock", 189.75, 180, 170.00, 0.90, "USD"),
                new Holding("MSFT", "Microsoft Corp.", "us", "Stock", 412.30, 110, 320.00, 0.81, "USD"),
                new Holding("VOO", "Vanguard S&P 500 ETF", "us", "ETF", 475.10, 60, 400.00, -0.09, "USD")
        );
        holdingsStore.put(user, new HashMap<>());
        holdingsStore.get(user).put("thai", thai);
        holdingsStore.get(user).put("us", us);
    }
}
