package com.assettracker.service;

import com.assettracker.model.AddHoldingRequest;
import com.assettracker.model.AssetDataset;
import com.assettracker.model.Holding;
import com.assettracker.model.QuoteResult;
import com.assettracker.model.StockLot;
import com.assettracker.model.StockLotView;
import com.assettracker.model.StockPositionView;
import com.assettracker.model.StockSummary;
import com.assettracker.model.StocksData;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class StockPortfolioService {

    private final QuoteProvider quoteProvider;
    private final UserAssetStore userAssetStore;

    public StockPortfolioService(QuoteProvider quoteProvider, UserAssetStore userAssetStore) {
        this.quoteProvider = quoteProvider;
        this.userAssetStore = userAssetStore;
    }

    public List<StockPositionView> getHoldings(String userId, String market, boolean sortByDayChange) {
        List<StockPositionView> positions;
        if ("us".equalsIgnoreCase(market)) {
            positions = buildUsPositions(userAssetStore.load(userId));
        } else {
            StocksData.StockMarketData thai = userAssetStore.load(userId).stocks().thai();
            positions = thai.holdings().stream().map(this::toReadOnlyPosition).toList();
        }

        if (sortByDayChange) {
            return positions.stream()
                    .sorted(Comparator.comparingDouble(StockPositionView::dayChangePct).reversed())
                    .toList();
        }
        return positions;
    }

    public StockPositionView addHolding(String userId, String market, AddHoldingRequest request) {
        if (!"us".equalsIgnoreCase(market)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only US holdings are editable right now");
        }

        AssetDataset dataset = userAssetStore.load(userId);
        StocksData.StockMarketData usData = dataset.stocks().us();
        List<StockLot> lots = new ArrayList<>(usData.lots() == null ? List.of() : usData.lots());
        lots.add(new StockLot(
                UUID.randomUUID().toString(),
                request.symbol().toUpperCase(Locale.ROOT),
                request.name(),
                "us",
                request.type(),
                request.currency(),
                request.purchaseDate().toString(),
                request.purchasePrice(),
                request.quantity()
        ));

        StocksData.StockMarketData updatedUs = new StocksData.StockMarketData(
                usData.title(),
                usData.currency(),
                usData.value(),
                usData.dayChange(),
                usData.dayChangePct(),
                usData.totalChange(),
                usData.totalChangePct(),
                usData.breakdown(),
                usData.performance(),
                usData.series(),
                usData.candlesticks(),
                usData.holdings(),
                lots
        );

        AssetDataset updatedDataset = new AssetDataset(
                new StocksData(dataset.stocks().thai(), updatedUs),
                dataset.bonds(),
                dataset.gold(),
                dataset.funds(),
                dataset.banks(),
                dataset.lottery(),
                dataset.expenses()
        );
        userAssetStore.save(userId, updatedDataset);

        return buildUsPositions(updatedDataset).stream()
                .filter(position -> position.symbol().equalsIgnoreCase(request.symbol()))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "Holding was saved but could not be reloaded"));
    }

    public StockSummary summary(String userId, String market) {
        if ("us".equalsIgnoreCase(market)) {
            AssetDataset dataset = userAssetStore.load(userId);
            StocksData.StockMarketData usSeed = dataset.stocks().us();
            List<StockPositionView> positions = buildUsPositions(dataset);

            double totalValue = positions.stream().mapToDouble(StockPositionView::value).sum();
            double dayChange = positions.stream().mapToDouble(StockPositionView::dayGain).sum();
            double totalChange = positions.stream().mapToDouble(StockPositionView::totalChange).sum();
            double totalCost = positions.stream()
                    .mapToDouble(position -> position.value() - position.totalChange())
                    .sum();

            return new StockSummary(
                    "us",
                    usSeed.title(),
                    usSeed.currency(),
                    totalValue,
                    dayChange,
                    totalValue == 0 ? 0 : (dayChange / totalValue) * 100,
                    totalChange,
                    totalCost == 0 ? 0 : (totalChange / totalCost) * 100,
                    usSeed.series(),
                    usSeed.candlesticks()
            );
        }

        StocksData.StockMarketData thai = userAssetStore.load(userId).stocks().thai();
        return new StockSummary(
                "thai",
                thai.title(),
                thai.currency(),
                thai.value(),
                thai.dayChange(),
                thai.dayChangePct(),
                thai.totalChange(),
                thai.totalChangePct(),
                thai.series(),
                thai.candlesticks()
        );
    }

    private List<StockPositionView> buildUsPositions(AssetDataset dataset) {
        List<StockLot> lots = dataset.stocks().us().lots() == null ? List.of() : dataset.stocks().us().lots();
        Map<String, List<StockLot>> groupedLots = new LinkedHashMap<>();
        for (StockLot lot : lots) {
            groupedLots.computeIfAbsent(lot.symbol().toUpperCase(Locale.ROOT), ignored -> new ArrayList<>()).add(lot);
        }

        List<StockPositionView> positions = new ArrayList<>();
        for (Map.Entry<String, List<StockLot>> entry : groupedLots.entrySet()) {
            List<StockLot> tickerLots = entry.getValue();
            StockLot firstLot = tickerLots.get(0);
            QuoteResult quote = quoteProvider.lookup(firstLot.symbol(), "us")
                    .orElseGet(() -> new QuoteResult(firstLot.symbol(), firstLot.name(), "US",
                            firstLot.type(), firstLot.currency(), firstLot.purchasePrice(), 0));

            double quantity = tickerLots.stream().mapToDouble(StockLot::quantity).sum();
            double value = quote.price() * quantity;
            double dayGain = value * (quote.dayChangePct() / 100d);
            double totalChange = tickerLots.stream()
                    .mapToDouble(lot -> (quote.price() - lot.purchasePrice()) * lot.quantity())
                    .sum();
            double totalCost = tickerLots.stream()
                    .mapToDouble(lot -> lot.purchasePrice() * lot.quantity())
                    .sum();

            List<StockLotView> lotViews = tickerLots.stream()
                    .sorted(Comparator.comparing(StockLot::purchaseDate).reversed())
                    .map(lot -> {
                        double lotValue = quote.price() * lot.quantity();
                        double lotDayGain = lotValue * (quote.dayChangePct() / 100d);
                        return new StockLotView(
                                lot.id(),
                                lot.purchaseDate(),
                                lot.purchasePrice(),
                                lot.quantity(),
                                quote.price(),
                                lotDayGain,
                                quote.dayChangePct(),
                                lotValue
                        );
                    })
                    .toList();

            positions.add(new StockPositionView(
                    firstLot.symbol(),
                    firstLot.name(),
                    "us",
                    firstLot.type(),
                    firstLot.currency(),
                    quote.price(),
                    quantity,
                    dayGain,
                    quote.dayChangePct(),
                    value,
                    totalChange,
                    totalCost == 0 ? 0 : (totalChange / totalCost) * 100,
                    lotViews
            ));
        }

        return positions.stream()
                .sorted(Comparator.comparing(StockPositionView::symbol))
                .toList();
    }

    private StockPositionView toReadOnlyPosition(Holding holding) {
        double value = holding.marketValue();
        double dayGain = value * (holding.dayChangePct() / 100d);
        double totalChange = (holding.price() - holding.avgCost()) * holding.quantity();
        double totalCost = holding.avgCost() * holding.quantity();
        StockLotView lotView = new StockLotView(
                holding.symbol() + "-seed",
                LocalDate.now().toString(),
                holding.avgCost(),
                holding.quantity(),
                holding.price(),
                dayGain,
                holding.dayChangePct(),
                value
        );
        return new StockPositionView(
                holding.symbol(),
                holding.name(),
                holding.market(),
                holding.type(),
                holding.currency(),
                holding.price(),
                holding.quantity(),
                dayGain,
                holding.dayChangePct(),
                value,
                totalChange,
                totalCost == 0 ? 0 : (totalChange / totalCost) * 100,
                List.of(lotView)
        );
    }
}
