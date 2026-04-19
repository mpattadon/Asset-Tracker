package com.assettracker.model.document;

import java.util.List;
import java.util.Map;

public record CanonicalPortfolioDocument(
        int schemaVersion,
        String revisionId,
        DocumentUser user,
        List<DocumentAccount> accounts,
        List<DocumentInstrument> instruments,
        List<DocumentTransaction> transactions,
        List<DocumentBankBalanceSnapshot> bankBalanceSnapshots,
        List<DocumentLotteryEntry> lotteryEntries,
        List<DocumentMutualFundSnapshot> mutualFundSnapshots,
        List<DocumentBondCouponSchedule> bondCouponSchedules,
        List<DocumentOptionContractDetail> optionContractDetails,
        List<DocumentExpenseItem> expenseItems,
        DerivedSections derived
) {

    public record DocumentUser(
            String externalUserId,
            String email,
            String displayName,
            String authProvider
    ) {
    }

    public record DocumentAccount(
            String id,
            String institutionName,
            String institutionType,
            String assetCategoryCode,
            String baseCurrencyCode,
            String marketCode,
            String accountName,
            String accountNumber,
            String notes,
            String externalRef,
            boolean active
    ) {
    }

    public record DocumentInstrument(
            String id,
            String ownerExternalUserId,
            String assetCategoryCode,
            String marketCode,
            String exchangeCode,
            String ticker,
            String name,
            String isin,
            String currencyCode,
            boolean active,
            String externalRef,
            Map<String, Object> metadata,
            List<DocumentInstrumentAlias> aliases
    ) {
    }

    public record DocumentInstrumentAlias(
            String providerName,
            String symbol,
            boolean primary
    ) {
    }

    public record DocumentTransaction(
            String id,
            String accountId,
            String instrumentId,
            String transactionTypeCode,
            String tradeDate,
            String settlementDate,
            String paymentDate,
            String exDate,
            Double units,
            Double pricePerUnit,
            Double grossAmount,
            String grossCurrencyCode,
            Double exchangeRateToAccount,
            Double exchangeRateToBase,
            String notes,
            String sourceType,
            String sourceRef,
            List<DocumentTransactionCharge> charges,
            DocumentCashFlow cashFlow
    ) {
    }

    public record DocumentTransactionCharge(
            String id,
            String chargeType,
            Double amount,
            String currencyCode,
            boolean inclusive,
            String notes
    ) {
    }

    public record DocumentCashFlow(
            String id,
            String cashFlowType,
            Double grossAmount,
            String grossCurrencyCode,
            Double taxAmount,
            String taxCurrencyCode,
            Double netAmount,
            String netCurrencyCode,
            Double unitsEntitled,
            Double amountPerUnit,
            boolean taxAlreadyDeducted
    ) {
    }

    public record DocumentBankBalanceSnapshot(
            String id,
            String accountId,
            String snapshotDate,
            String bankName,
            Double balance,
            String currencyCode,
            String changeText,
            String notes
    ) {
    }

    public record DocumentLotteryEntry(
            String id,
            String drawName,
            int tickets,
            Double committedAmount,
            String committedCurrencyCode,
            String estimatedPayout,
            String notes
    ) {
    }

    public record DocumentMutualFundSnapshot(
            String id,
            String accountId,
            String instrumentId,
            String snapshotDate,
            Double nav,
            String currencyCode,
            String exposure,
            String changeText,
            String notes
    ) {
    }

    public record DocumentBondCouponSchedule(
            String id,
            String accountId,
            String instrumentId,
            String couponDate,
            Double amount,
            String currencyCode,
            String notes
    ) {
    }

    public record DocumentOptionContractDetail(
            String id,
            String accountId,
            String instrumentId,
            String contractType,
            Double strikePrice,
            String expiryDate,
            String underlyingSymbol,
            String notes
    ) {
    }

    public record DocumentExpenseItem(
            String id,
            String expenseFrequency,
            String name,
            Double amount,
            String currencyCode,
            String renewalText,
            String runwayText
    ) {
    }

    public record DerivedSections(
            List<DocumentMarketPrice> marketPrices,
            List<DocumentFxRate> fxRates,
            List<DocumentPortfolioSnapshot> portfolioSnapshots,
            List<DocumentInstrumentYearlySummary> instrumentYearlySummaries
    ) {
    }

    public record DocumentMarketPrice(
            String instrumentId,
            String priceDate,
            Double openPrice,
            Double highPrice,
            Double lowPrice,
            Double closePrice,
            Double adjustedClosePrice,
            String currencyCode,
            Double volume,
            String sourceName
    ) {
    }

    public record DocumentFxRate(
            String baseCurrencyCode,
            String quoteCurrencyCode,
            String rateDate,
            Double rate,
            String sourceName
    ) {
    }

    public record DocumentPortfolioSnapshot(
            String id,
            String accountId,
            String instrumentId,
            String snapshotDate,
            Double marketValue,
            String marketValueCurrencyCode,
            Double investedValue,
            Double dividendTotal,
            Double unrealizedGainLoss,
            String notes
    ) {
    }

    public record DocumentInstrumentYearlySummary(
            String id,
            String accountId,
            String instrumentId,
            int year,
            Double totalBuyAmount,
            Double totalSellAmount,
            Double totalDividendAmount,
            Double realizedGainLoss,
            String currencyCode
    ) {
    }
}
