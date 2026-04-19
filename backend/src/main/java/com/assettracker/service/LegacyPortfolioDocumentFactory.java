package com.assettracker.service;

import com.assettracker.model.AssetDataset;
import com.assettracker.model.BondHolding;
import com.assettracker.model.FundHolding;
import com.assettracker.model.GoldPosition;
import com.assettracker.model.Holding;
import com.assettracker.model.LotteryEntry;
import com.assettracker.model.document.CanonicalPortfolioDocument;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class LegacyPortfolioDocumentFactory {

    public CanonicalPortfolioDocument create(PortfolioMetadataRepository.UserRecord user, AssetDataset dataset) {
        String today = LocalDate.now().toString();
        List<CanonicalPortfolioDocument.DocumentAccount> accounts = new ArrayList<>();
        List<CanonicalPortfolioDocument.DocumentInstrument> instruments = new ArrayList<>();
        List<CanonicalPortfolioDocument.DocumentTransaction> transactions = new ArrayList<>();
        List<CanonicalPortfolioDocument.DocumentBankBalanceSnapshot> bankSnapshots = new ArrayList<>();
        List<CanonicalPortfolioDocument.DocumentLotteryEntry> lotteryEntries = new ArrayList<>();
        List<CanonicalPortfolioDocument.DocumentMutualFundSnapshot> fundSnapshots = new ArrayList<>();
        List<CanonicalPortfolioDocument.DocumentBondCouponSchedule> bondCoupons = new ArrayList<>();
        List<CanonicalPortfolioDocument.DocumentOptionContractDetail> optionDetails = new ArrayList<>();
        List<CanonicalPortfolioDocument.DocumentExpenseItem> expenseItems = new ArrayList<>();

        String thaiStockAccountId = deterministicId(user.externalUserId(), "account", "thai-stocks");
        String usStockAccountId = deterministicId(user.externalUserId(), "account", "us-stocks");
        String bondAccountId = deterministicId(user.externalUserId(), "account", "bonds");
        String fundAccountId = deterministicId(user.externalUserId(), "account", "funds");
        String goldAccountId = deterministicId(user.externalUserId(), "account", "gold");
        String thaiBankAccountId = deterministicId(user.externalUserId(), "account", "thai-banks");
        String ukBankAccountId = deterministicId(user.externalUserId(), "account", "uk-banks");

        accounts.add(account(thaiStockAccountId, "Legacy Thai Stocks", "BROKER", "STOCK", "THB", "TH", "Legacy Thai Stocks"));
        accounts.add(account(usStockAccountId, "Legacy US Stocks", "BROKER", "STOCK", "USD", "US", "Legacy US Stocks"));
        accounts.add(account(bondAccountId, "Legacy Bonds", "CUSTODIAN", "BOND", "THB", "TH", "Legacy Bonds"));
        accounts.add(account(fundAccountId, "Legacy Mutual Funds", "FUND_HOUSE", "MUTUAL_FUND", "THB", "TH", "Legacy Mutual Funds"));
        accounts.add(account(goldAccountId, "Legacy Gold", "CUSTODIAN", "GOLD", "THB", "TH", "Legacy Gold"));
        accounts.add(account(thaiBankAccountId, "Legacy Thai Banks", "BANK", "BANK_ACCOUNT", "THB", "TH", "Legacy Thai Banks"));
        accounts.add(account(ukBankAccountId, "Legacy UK Banks", "BANK", "BANK_ACCOUNT", "GBP", "UK", "Legacy UK Banks"));

        if (dataset.stocks() != null && dataset.stocks().thai() != null) {
            for (Holding holding : dataset.stocks().thai().holdings()) {
                String instrumentId = deterministicId(user.externalUserId(), "instrument", holding.symbol());
                instruments.add(instrument(
                        instrumentId,
                        user.externalUserId(),
                        "STOCK",
                        "TH",
                        "SET",
                        holding.symbol(),
                        holding.name(),
                        holding.currency(),
                        Map.of("source", "legacy-thai-holding", "avgCost", holding.avgCost())
                ));
                transactions.add(transaction(
                        deterministicId(user.externalUserId(), "txn", holding.symbol()),
                        thaiStockAccountId,
                        instrumentId,
                        "BUY",
                        today,
                        holding.quantity(),
                        holding.avgCost(),
                        holding.avgCost() * holding.quantity(),
                        holding.currency(),
                        "LEGACY_IMPORT",
                        holding.symbol(),
                        List.of(),
                        null
                ));
            }
        }

        if (dataset.stocks() != null && dataset.stocks().us() != null && dataset.stocks().us().lots() != null) {
            dataset.stocks().us().lots().forEach(lot -> {
                String instrumentId = deterministicId(user.externalUserId(), "instrument", lot.symbol());
                if (instruments.stream().noneMatch(item -> item.id().equals(instrumentId))) {
                    instruments.add(instrument(
                            instrumentId,
                            user.externalUserId(),
                            "ETF".equalsIgnoreCase(lot.type()) ? "MUTUAL_FUND" : "STOCK",
                            "US",
                            "NASDAQ",
                            lot.symbol(),
                            lot.name(),
                            lot.currency(),
                            Map.of("source", "legacy-us-lot", "market", lot.market())
                    ));
                }
                transactions.add(transaction(
                        deterministicId(user.externalUserId(), "txn", lot.id()),
                        usStockAccountId,
                        instrumentId,
                        "BUY",
                        lot.purchaseDate(),
                        lot.quantity(),
                        lot.purchasePrice(),
                        lot.purchasePrice() * lot.quantity(),
                        lot.currency(),
                        "LEGACY_IMPORT",
                        lot.id(),
                        List.of(),
                        null
                ));
            });
        }

        for (BondHolding bond : dataset.bonds()) {
            String instrumentId = deterministicId(user.externalUserId(), "instrument", bond.name());
            double amount = parseMoneyValue(bond.amount());
            instruments.add(instrument(
                    instrumentId,
                    user.externalUserId(),
                    "BOND",
                    "TH",
                    null,
                    slug(bond.name()),
                    bond.name(),
                    "THB",
                    Map.of("yield", bond.yield(), "duration", bond.duration())
            ));
            transactions.add(transaction(
                    deterministicId(user.externalUserId(), "txn", bond.name()),
                    bondAccountId,
                    instrumentId,
                    "BUY",
                    today,
                    1,
                    amount,
                    amount,
                    "THB",
                    "LEGACY_IMPORT",
                    bond.name(),
                    List.of(),
                    null
            ));
        }

        for (FundHolding fund : dataset.funds()) {
            String instrumentId = deterministicId(user.externalUserId(), "instrument", fund.name());
            double nav = parseMoneyValue(fund.nav());
            instruments.add(instrument(
                    instrumentId,
                    user.externalUserId(),
                    "MUTUAL_FUND",
                    "TH",
                    null,
                    slug(fund.name()),
                    fund.name(),
                    "THB",
                    Map.of("change", fund.change())
            ));
            transactions.add(transaction(
                    deterministicId(user.externalUserId(), "txn", fund.name()),
                    fundAccountId,
                    instrumentId,
                    "BUY",
                    today,
                    1,
                    nav,
                    nav,
                    "THB",
                    "LEGACY_IMPORT",
                    fund.name(),
                    List.of(),
                    null
            ));
            fundSnapshots.add(new CanonicalPortfolioDocument.DocumentMutualFundSnapshot(
                    deterministicId(user.externalUserId(), "fund-snapshot", fund.name()),
                    fundAccountId,
                    instrumentId,
                    today,
                    nav,
                    "THB",
                    fund.exposure(),
                    fund.change(),
                    "Migrated from legacy mutual fund summary"
            ));
        }

        for (GoldPosition goldPosition : dataset.gold()) {
            String instrumentId = deterministicId(user.externalUserId(), "instrument", goldPosition.type());
            double value = parseMoneyValue(goldPosition.value());
            instruments.add(instrument(
                    instrumentId,
                    user.externalUserId(),
                    "GOLD",
                    "TH",
                    null,
                    slug(goldPosition.type()),
                    goldPosition.type(),
                    "THB",
                    Map.of("weight", goldPosition.weight(), "change", goldPosition.change())
            ));
            transactions.add(transaction(
                    deterministicId(user.externalUserId(), "txn", goldPosition.type()),
                    goldAccountId,
                    instrumentId,
                    "BUY",
                    today,
                    1,
                    value,
                    value,
                    "THB",
                    "LEGACY_IMPORT",
                    goldPosition.type(),
                    List.of(),
                    null
            ));
        }

        if (dataset.banks() != null) {
            if (dataset.banks().thai() != null) {
                dataset.banks().thai().accounts().forEach(account -> bankSnapshots.add(
                        new CanonicalPortfolioDocument.DocumentBankBalanceSnapshot(
                                deterministicId(user.externalUserId(), "bank", account.bank()),
                                thaiBankAccountId,
                                today,
                                account.bank(),
                                parseMoneyValue(account.balance()),
                                "THB",
                                account.change(),
                                "Migrated from legacy Thai bank balance"
                        )
                ));
            }
            if (dataset.banks().uk() != null) {
                dataset.banks().uk().accounts().forEach(account -> bankSnapshots.add(
                        new CanonicalPortfolioDocument.DocumentBankBalanceSnapshot(
                                deterministicId(user.externalUserId(), "bank", account.bank()),
                                ukBankAccountId,
                                today,
                                account.bank(),
                                parseMoneyValue(account.balance()),
                                "GBP",
                                account.change(),
                                "Migrated from legacy UK bank balance"
                        )
                ));
            }
        }

        for (LotteryEntry entry : dataset.lottery()) {
            lotteryEntries.add(new CanonicalPortfolioDocument.DocumentLotteryEntry(
                    deterministicId(user.externalUserId(), "lottery", entry.draw()),
                    entry.draw(),
                    entry.tickets(),
                    parseMoneyValue(entry.committed()),
                    "THB",
                    entry.estPayout(),
                    "Migrated from legacy lottery data"
            ));
        }

        if (dataset.expenses() != null) {
            dataset.expenses().monthly().forEach(item -> expenseItems.add(
                    new CanonicalPortfolioDocument.DocumentExpenseItem(
                            deterministicId(user.externalUserId(), "expense", item.name() + ":monthly"),
                            "MONTHLY",
                            item.name(),
                            parseMoneyValue(item.amount()),
                            currencyFromMoney(item.amount()),
                            item.renewal(),
                            dataset.expenses().runway()
                    )
            ));
            dataset.expenses().yearly().forEach(item -> expenseItems.add(
                    new CanonicalPortfolioDocument.DocumentExpenseItem(
                            deterministicId(user.externalUserId(), "expense", item.name() + ":yearly"),
                            "YEARLY",
                            item.name(),
                            parseMoneyValue(item.amount()),
                            currencyFromMoney(item.amount()),
                            item.renewal(),
                            dataset.expenses().runway()
                    )
            ));
        }

        return new CanonicalPortfolioDocument(
                1,
                UUID.randomUUID().toString(),
                new CanonicalPortfolioDocument.DocumentUser(
                        user.externalUserId(),
                        user.email(),
                        user.displayName(),
                        user.authProvider()
                ),
                accounts,
                instruments,
                transactions,
                bankSnapshots,
                lotteryEntries,
                fundSnapshots,
                bondCoupons,
                optionDetails,
                expenseItems,
                new CanonicalPortfolioDocument.DerivedSections(List.of(), List.of(), List.of(), List.of())
        );
    }

    private CanonicalPortfolioDocument.DocumentAccount account(String id,
                                                              String institutionName,
                                                              String institutionType,
                                                              String assetCategoryCode,
                                                              String baseCurrencyCode,
                                                              String marketCode,
                                                              String accountName) {
        return new CanonicalPortfolioDocument.DocumentAccount(
                id,
                institutionName,
                institutionType,
                assetCategoryCode,
                baseCurrencyCode,
                marketCode,
                accountName,
                null,
                "Migrated from legacy seed data",
                slug(accountName),
                true
        );
    }

    private CanonicalPortfolioDocument.DocumentInstrument instrument(String id,
                                                                     String ownerExternalUserId,
                                                                     String assetCategoryCode,
                                                                     String marketCode,
                                                                     String exchangeCode,
                                                                     String ticker,
                                                                     String name,
                                                                     String currencyCode,
                                                                     Map<String, Object> metadata) {
        return new CanonicalPortfolioDocument.DocumentInstrument(
                id,
                ownerExternalUserId,
                assetCategoryCode,
                marketCode,
                exchangeCode,
                ticker,
                name,
                null,
                currencyCode,
                true,
                slug(name),
                metadata == null ? Map.of() : metadata,
                List.of()
        );
    }

    private CanonicalPortfolioDocument.DocumentTransaction transaction(String id,
                                                                       String accountId,
                                                                       String instrumentId,
                                                                       String transactionTypeCode,
                                                                       String tradeDate,
                                                                       double units,
                                                                       double pricePerUnit,
                                                                       double grossAmount,
                                                                       String grossCurrencyCode,
                                                                       String sourceType,
                                                                       String sourceRef,
                                                                       List<CanonicalPortfolioDocument.DocumentTransactionCharge> charges,
                                                                       CanonicalPortfolioDocument.DocumentCashFlow cashFlow) {
        return new CanonicalPortfolioDocument.DocumentTransaction(
                id,
                accountId,
                instrumentId,
                transactionTypeCode,
                tradeDate,
                tradeDate,
                null,
                null,
                units,
                pricePerUnit,
                grossAmount,
                grossCurrencyCode,
                null,
                null,
                "Migrated from legacy dataset",
                sourceType,
                sourceRef,
                charges,
                cashFlow
        );
    }

    private String deterministicId(String externalUserId, String domain, String value) {
        return UUID.nameUUIDFromBytes((externalUserId + ":" + domain + ":" + value).getBytes(StandardCharsets.UTF_8))
                .toString();
    }

    private String slug(String raw) {
        return raw.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-");
    }

    private double parseMoneyValue(String rawValue) {
        if (rawValue == null || rawValue.isBlank()) {
            return 0;
        }
        String normalized = rawValue.replaceAll("[^0-9.]", "");
        return normalized.isBlank() ? 0 : Double.parseDouble(normalized);
    }

    private String currencyFromMoney(String rawValue) {
        if (rawValue != null && rawValue.contains("£")) {
            return "GBP";
        }
        return "THB";
    }
}
