package com.assettracker.model;

import java.util.List;

public record MutualFundDashboardResponse(
        StockSummary summary,
        List<MutualFundAccountView> accounts,
        List<MutualFundAccountSummaryView> accountSummaries,
        List<MutualFundAccountDetailView> accountDetails,
        List<MutualFundSaleAccountView> saleAccounts
) {
}
