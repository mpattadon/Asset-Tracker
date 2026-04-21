import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { ChevronDown, ChevronUp, Pencil, Plus } from "lucide-react";
import { TradingViewChart } from "../components/charts/TradingViewChart";
import { AddMutualFundAccountDialog } from "../components/AddMutualFundAccountDialog";
import { AddPurchaseDialog } from "../components/AddPurchaseDialog";
import { DataCard, PageContainer, PageHeader } from "../components/layout/index";
import { PortfolioChartPanel } from "../components/stocks/PortfolioChartPanel";
import { LogMonthlyDataDialog } from "../components/LogMonthlyDataDialog";
import { SellMutualFundDialog } from "../components/SellMutualFundDialog";
import { useAuth } from "../auth";
import {
  getMutualFundAccounts,
  getMutualFundDashboard,
  MutualFundAccount,
  MutualFundAccountDetailView,
  MutualFundAccountSummaryView,
  MutualFundDashboard,
  MutualFundHoldingView,
  MutualFundMonthlyLogView,
  MutualFundPurchaseView,
  MutualFundSaleAccountView,
  MutualFundSaleView,
  StockSummary,
} from "../api";
import { usePreferences } from "../preferences";

type MutualFundTab = "overview" | "accounts" | "sells";

function symbolForCurrency(currency: string) {
  return (
    {
      USD: "$",
      THB: "฿",
      EUR: "€",
      GBP: "£",
      JPY: "¥",
      TWD: "NT$",
      SGD: "S$",
    }[currency] ?? `${currency} `
  );
}

function formatMoney(currency: string, amount: number, digits = 2) {
  return `${symbolForCurrency(currency)}${amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })}`;
}

function formatDisplayDate(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const year = parsed.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

function emptySummary(currency: string): StockSummary {
  return {
    market: "mutual-funds",
    title: "All Mutual Funds",
    currency,
    totalValue: 0,
    dayChange: 0,
    dayChangePct: 0,
    totalChange: 0,
    totalChangePct: 0,
    series: [],
    candlesticks: [],
    intradayHistory: [],
    dailyHistory: [],
    performanceIntradayHistory: [],
    performanceDailyHistory: [],
  };
}

function logSeries(logs: MutualFundHoldingView["monthlyLogs"]) {
  return logs
    .slice()
    .sort((left, right) => left.logDate.localeCompare(right.logDate))
    .map((entry) => ({
      time: entry.logDate,
      value: entry.marketValue,
    }));
}

function formatUnits(value: number) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 4,
  });
}

function MutualFundHoldingCard({
  holding,
  accountCurrency,
  accountId,
  bankName,
  accountNumber,
  collapsed,
  onToggleCollapse,
  onEditPurchase,
  onEditLog,
  onSell,
}: {
  holding: MutualFundHoldingView;
  accountCurrency: string;
  accountId: string;
  bankName: string;
  accountNumber: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onEditPurchase: (
    purchase: MutualFundPurchaseView & { fundName: string; accountId: string; bankName: string },
  ) => void;
  onEditLog: (
    log: MutualFundMonthlyLogView & { fundName: string; accountId: string; bankName: string },
  ) => void;
  onSell?: (context: {
    accountId: string;
    bankName: string;
    accountNumber: string;
    currency: string;
    fundName: string;
  }) => void;
}) {
  const latestLog = holding.monthlyLogs.at(0) ?? null;
  const positive = holding.gainLoss >= 0;
  const ledgerEntries = useMemo(
    () =>
      [
        ...holding.purchases.map((purchase) => ({
          kind: "purchase" as const,
          sortDate: purchase.purchaseDate,
          purchase,
        })),
        ...holding.monthlyLogs.map((log) => ({
          kind: "log" as const,
          sortDate: log.logDate,
          log,
        })),
      ].sort((left, right) => right.sortDate.localeCompare(left.sortDate)),
    [holding.monthlyLogs, holding.purchases],
  );

  return (
    <Card className="border-gray-200 bg-white p-4 shadow-sm">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-medium text-gray-950">{holding.fundName}</h4>
            <p className="mt-1 text-xs text-gray-500">
              {latestLog ? `Latest log ${formatDisplayDate(latestLog.logDate)}` : "No monthly logs yet"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs text-gray-600">
              Risk {holding.riskLevel}
            </Badge>
            <Badge variant="outline" className="text-xs text-gray-600">
              {accountCurrency}
            </Badge>
            {onSell ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() =>
                  onSell({
                    accountId,
                    bankName,
                    accountNumber,
                    currency: accountCurrency,
                    fundName: holding.fundName,
                  })
                }
              >
                Sell
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onToggleCollapse}
            >
              {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div>
            <p className="mb-1 text-xs uppercase tracking-[0.14em] text-gray-500">Invested</p>
            <p className="text-sm font-medium text-gray-900">
              {formatMoney(accountCurrency, holding.totalInvested)}
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs uppercase tracking-[0.14em] text-gray-500">Current Value</p>
            <p className="text-sm font-medium text-gray-900">
              {formatMoney(accountCurrency, holding.currentValue)}
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs uppercase tracking-[0.14em] text-gray-500">Dividends</p>
            <p className="text-sm font-medium text-gray-900">
              {formatMoney(accountCurrency, holding.dividends)}
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs uppercase tracking-[0.14em] text-gray-500">Gain/Loss</p>
            <p className={`text-sm font-medium ${positive ? "text-green-600" : "text-red-600"}`}>
              {positive ? "+" : "-"}
              {formatMoney(accountCurrency, Math.abs(holding.gainLoss))} (
              {Math.abs(holding.gainLossPct).toFixed(2)}%)
            </p>
          </div>
        </div>

        {!collapsed && holding.monthlyLogs.length ? (
          <div className="space-y-3">
            <div className="h-24">
              <TradingViewChart
                height={96}
                mode="line"
                lineData={logSeries(holding.monthlyLogs)}
                currency={accountCurrency}
                accentColor={positive ? "#16a34a" : "#dc2626"}
              />
            </div>

          <div className="space-y-2">
            {ledgerEntries.map((entry) =>
                entry.kind === "purchase" ? (
                  <div
                    key={`purchase-${entry.purchase.id}`}
                    className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 sm:grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_1fr_auto]"
                  >
                    <div>
                      <p className="uppercase tracking-[0.12em] text-gray-500">Type</p>
                      <p className="mt-1 font-medium text-gray-900">Purchase</p>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.12em] text-gray-500">Date</p>
                      <p className="mt-1 font-medium text-gray-900">
                        {formatDisplayDate(entry.purchase.purchaseDate)}
                      </p>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.12em] text-gray-500">Price / Unit</p>
                      <p className="mt-1 font-medium text-gray-900">
                        {formatMoney(accountCurrency, entry.purchase.averageCostPerUnit, 4)}
                      </p>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.12em] text-gray-500">Units</p>
                      <p className="mt-1 font-medium text-gray-900">
                        {formatUnits(entry.purchase.unitsPurchased)}
                      </p>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.12em] text-gray-500">Dividend</p>
                      <p className="mt-1 font-medium text-gray-900">—</p>
                    </div>
                    <div>
                      <div>
                        <p className="uppercase tracking-[0.12em] text-gray-500">Total</p>
                        <p className="mt-1 font-medium text-gray-900">
                          {formatMoney(accountCurrency, entry.purchase.totalCost)}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.12em] text-gray-500">Market Value</p>
                      <p className="mt-1 font-medium text-gray-900">—</p>
                    </div>
                    <div className="flex items-end justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          onEditPurchase({
                            ...entry.purchase,
                            fundName: holding.fundName,
                            accountId,
                            bankName,
                          })
                        }
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    key={`log-${entry.log.id}`}
                    className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 sm:grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_1fr_auto]"
                  >
                    <div>
                      <p className="uppercase tracking-[0.12em] text-gray-500">Type</p>
                      <p className="mt-1 font-medium text-gray-900">Monthly Log</p>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.12em] text-gray-500">Date</p>
                      <p className="mt-1 font-medium text-gray-900">
                        {formatDisplayDate(entry.log.logDate)}
                      </p>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.12em] text-gray-500">Price / Unit</p>
                      <p className="mt-1 font-medium text-gray-900">
                        {formatMoney(accountCurrency, entry.log.pricePerUnit, 4)}
                      </p>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.12em] text-gray-500">Units</p>
                      <p className="mt-1 font-medium text-gray-900">
                        {entry.log.pricePerUnit > 0
                          ? formatUnits(entry.log.marketValue / entry.log.pricePerUnit)
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.12em] text-gray-500">Dividend</p>
                      <p className="mt-1 font-medium text-gray-900">
                        {formatMoney(accountCurrency, entry.log.dividendReceived)}
                      </p>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.12em] text-gray-500">Total</p>
                      <p className="mt-1 font-medium text-gray-900">—</p>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.12em] text-gray-500">Market Value</p>
                      <p className="mt-1 font-medium text-gray-900">
                        {formatMoney(accountCurrency, entry.log.marketValue)}
                      </p>
                    </div>
                    <div className="flex items-end justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          onEditLog({
                            ...entry.log,
                            fundName: holding.fundName,
                            accountId,
                            bankName,
                          })
                        }
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        ) : !collapsed ? (
          <div className="space-y-2">
            {holding.purchases.map((purchase) => (
              <div
                key={`purchase-${purchase.id}`}
                className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 sm:grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_1fr_auto]"
              >
                <div>
                  <p className="uppercase tracking-[0.12em] text-gray-500">Type</p>
                  <p className="mt-1 font-medium text-gray-900">Purchase</p>
                </div>
                <div>
                  <p className="uppercase tracking-[0.12em] text-gray-500">Date</p>
                  <p className="mt-1 font-medium text-gray-900">
                    {formatDisplayDate(purchase.purchaseDate)}
                  </p>
                </div>
                <div>
                  <p className="uppercase tracking-[0.12em] text-gray-500">Price / Unit</p>
                  <p className="mt-1 font-medium text-gray-900">
                    {formatMoney(accountCurrency, purchase.averageCostPerUnit, 4)}
                  </p>
                </div>
                <div>
                  <p className="uppercase tracking-[0.12em] text-gray-500">Units</p>
                  <p className="mt-1 font-medium text-gray-900">{formatUnits(purchase.unitsPurchased)}</p>
                </div>
                <div>
                  <p className="uppercase tracking-[0.12em] text-gray-500">Dividend</p>
                  <p className="mt-1 font-medium text-gray-900">—</p>
                </div>
                <div>
                  <div>
                    <p className="uppercase tracking-[0.12em] text-gray-500">Total</p>
                    <p className="mt-1 font-medium text-gray-900">
                      {formatMoney(accountCurrency, purchase.totalCost)}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="uppercase tracking-[0.12em] text-gray-500">Market Value</p>
                  <p className="mt-1 font-medium text-gray-900">—</p>
                </div>
                <div className="flex items-end justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      onEditPurchase({
                        ...purchase,
                        fundName: holding.fundName,
                        accountId,
                        bankName,
                      })
                    }
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {!holding.purchases.length ? (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                No purchase or monthly log entries recorded for this fund yet.
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function SaleAccountCard({
  saleAccount,
  onEditSale,
}: {
  saleAccount: MutualFundSaleAccountView;
  onEditSale: (
    sale: MutualFundSaleView & {
      accountId: string;
      bankName: string;
      accountNumber: string;
      currency: string;
    },
  ) => void;
}) {
  const positive = saleAccount.totalGainLoss >= 0;

  return (
    <DataCard
      className="border-gray-200"
      title={`${saleAccount.bankName} · ${saleAccount.accountNumber}`}
      action={
        <div className="text-right text-xs text-gray-500">
          <div>{saleAccount.currency}</div>
          {saleAccount.notes ? <div>{saleAccount.notes}</div> : null}
        </div>
      }
    >
      <div className="space-y-4 p-4 md:p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div>
            <p className="mb-1 text-xs uppercase tracking-[0.14em] text-gray-500">Realized Gain/Loss</p>
            <p className={`text-sm font-medium ${saleAccount.realizedGainLoss >= 0 ? "text-green-600" : "text-red-600"}`}>
              {saleAccount.realizedGainLoss >= 0 ? "+" : "-"}
              {formatMoney(saleAccount.currency, Math.abs(saleAccount.realizedGainLoss))}
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs uppercase tracking-[0.14em] text-gray-500">Dividends</p>
            <p className="text-sm font-medium text-gray-900">
              {formatMoney(saleAccount.currency, saleAccount.dividends)}
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs uppercase tracking-[0.14em] text-gray-500">Total Gain/Loss</p>
            <p className={`text-sm font-medium ${positive ? "text-green-600" : "text-red-600"}`}>
              {positive ? "+" : "-"}
              {formatMoney(saleAccount.currency, Math.abs(saleAccount.totalGainLoss))}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {saleAccount.sales.map((sale) => (
            <div
              key={sale.id}
              className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 sm:grid-cols-7"
            >
              <div>
                <p className="uppercase tracking-[0.12em] text-gray-500">Fund</p>
                <p className="mt-1 font-medium text-gray-900">{sale.fundName}</p>
              </div>
              <div>
                <p className="uppercase tracking-[0.12em] text-gray-500">Date</p>
                <p className="mt-1 font-medium text-gray-900">{formatDisplayDate(sale.saleDate)}</p>
              </div>
              <div>
                <p className="uppercase tracking-[0.12em] text-gray-500">Units Sold</p>
                <p className="mt-1 font-medium text-gray-900">
                  {sale.unitsSold.toLocaleString("en-US", { maximumFractionDigits: 4 })}
                </p>
              </div>
              <div>
                <p className="uppercase tracking-[0.12em] text-gray-500">Price / Unit</p>
                <p className="mt-1 font-medium text-gray-900">
                  {formatMoney(saleAccount.currency, sale.salePricePerUnit, 4)}
                </p>
              </div>
              <div>
                <p className="uppercase tracking-[0.12em] text-gray-500">Proceeds</p>
                <p className="mt-1 font-medium text-gray-900">
                  {formatMoney(saleAccount.currency, sale.proceeds)}
                </p>
              </div>
              <div>
                <p className="uppercase tracking-[0.12em] text-gray-500">Fund Dividends</p>
                <p className="mt-1 font-medium text-gray-900">
                  {formatMoney(saleAccount.currency, sale.fundDividends)}
                </p>
              </div>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="uppercase tracking-[0.12em] text-gray-500">Realized Gain/Loss</p>
                  <p className={`mt-1 font-medium ${sale.realizedGainLoss >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {sale.realizedGainLoss >= 0 ? "+" : "-"}
                    {formatMoney(saleAccount.currency, Math.abs(sale.realizedGainLoss))}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() =>
                    onEditSale({
                      ...sale,
                      accountId: saleAccount.id,
                      bankName: saleAccount.bankName,
                      accountNumber: saleAccount.accountNumber,
                      currency: saleAccount.currency,
                    })
                  }
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DataCard>
  );
}

function AccountOverviewCard({
  summary,
}: {
  summary: MutualFundAccountSummaryView;
}) {
  const positive = summary.gainLoss >= 0;

  return (
    <Card className="border-gray-200 bg-white p-5 shadow-sm">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-950">{summary.accountNumber}</p>
            <p className="mt-1 text-xs text-gray-500">
              {summary.bankName}
              {summary.notes ? ` · ${summary.notes}` : ""}
            </p>
          </div>
          <Badge variant="outline" className="text-xs text-gray-600">
            Account
          </Badge>
        </div>

        <div>
          <p className="mb-1 text-xs uppercase tracking-[0.14em] text-gray-500">Current Value</p>
          <p className="text-2xl font-semibold text-gray-950">
            {formatMoney(summary.currency, summary.currentValue)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="mb-1 text-xs uppercase tracking-[0.14em] text-gray-500">Invested</p>
            <p className="font-medium text-gray-900">
              {formatMoney(summary.currency, summary.totalInvested)}
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs uppercase tracking-[0.14em] text-gray-500">Dividends</p>
            <p className="font-medium text-gray-900">
              {formatMoney(summary.currency, summary.dividends)}
            </p>
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs uppercase tracking-[0.14em] text-gray-500">Gain/Loss</p>
          <p className={`text-base font-medium ${positive ? "text-green-600" : "text-red-600"}`}>
            {positive ? "+" : "-"}
            {formatMoney(summary.currency, Math.abs(summary.gainLoss))} (
            {Math.abs(summary.gainLossPct).toFixed(2)}%)
          </p>
        </div>
      </div>
    </Card>
  );
}

export function MutualFunds() {
  const { authState } = useAuth();
  const { preferredCurrency } = usePreferences();
  const [activeTab, setActiveTab] = useState<MutualFundTab>("overview");
  const [selectedBank, setSelectedBank] = useState("all");
  const [selectedAccount, setSelectedAccount] = useState("all");
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [addPurchaseOpen, setAddPurchaseOpen] = useState(false);
  const [logMonthlyOpen, setLogMonthlyOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<MutualFundAccount | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<
    (MutualFundPurchaseView & { fundName: string; accountId: string; bankName: string }) | null
  >(null);
  const [editingLog, setEditingLog] = useState<
    (MutualFundMonthlyLogView & { fundName: string; accountId: string; bankName: string }) | null
  >(null);
  const [sellContext, setSellContext] = useState<{
    accountId: string;
    bankName: string;
    accountNumber: string;
    currency: string;
    fundName: string;
  } | null>(null);
  const [editingSale, setEditingSale] = useState<
    (MutualFundSaleView & {
      accountId: string;
      bankName: string;
      accountNumber: string;
      currency: string;
    }) | null
  >(null);
  const [collapsedAccountIds, setCollapsedAccountIds] = useState<string[]>([]);
  const [collapsedFundKeys, setCollapsedFundKeys] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<MutualFundAccount[]>([]);
  const [overviewDashboard, setOverviewDashboard] = useState<MutualFundDashboard | null>(null);
  const [accountsDashboard, setAccountsDashboard] = useState<MutualFundDashboard | null>(null);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const bankOptions = useMemo(
    () => Array.from(new Set(accounts.map((account) => account.bankName))).sort(),
    [accounts],
  );

  const accountOptions = useMemo(
    () =>
      accounts.filter(
        (account) => selectedBank === "all" || account.bankName === selectedBank,
      ),
    [accounts, selectedBank],
  );

  useEffect(() => {
    if (
      selectedAccount !== "all" &&
      !accountOptions.some((account) => account.id === selectedAccount)
    ) {
      setSelectedAccount("all");
    }
  }, [accountOptions, selectedAccount]);

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      setAccounts(await getMutualFundAccounts());
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      setOverviewDashboard(await getMutualFundDashboard());
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  const loadAccountsView = useCallback(async () => {
    setDetailLoading(true);
    try {
      if (selectedBank === "all" && selectedAccount === "all") {
        setAccountsDashboard(await getMutualFundDashboard());
      } else {
        setAccountsDashboard(await getMutualFundDashboard(selectedBank, selectedAccount));
      }
    } finally {
      setDetailLoading(false);
    }
  }, [selectedAccount, selectedBank]);

  const refreshMutualFunds = useCallback(async () => {
    setLoadError("");
    try {
      await Promise.all([loadAccounts(), loadOverview(), loadAccountsView()]);
    } catch (requestError) {
      setLoadError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load mutual fund data.",
      );
    }
  }, [loadAccounts, loadAccountsView, loadOverview]);

  useEffect(() => {
    void refreshMutualFunds();
  }, [preferredCurrency, refreshMutualFunds]);

  useEffect(() => {
    if (activeTab === "accounts" || activeTab === "sells") {
      void loadAccountsView().catch((requestError) => {
        setLoadError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load mutual fund accounts.",
        );
      });
    }
  }, [activeTab, loadAccountsView]);

  const activeDashboard = activeTab === "overview" ? overviewDashboard : accountsDashboard;
  const displaySummary = activeDashboard?.summary ?? emptySummary(preferredCurrency);
  const displayAccountSummaries = overviewDashboard?.accountSummaries ?? [];
  const displayAccountDetails =
    activeTab === "accounts"
      ? accountsDashboard?.accountDetails ?? []
      : overviewDashboard?.accountDetails ?? [];
  const displaySaleAccounts =
    activeTab === "sells"
      ? accountsDashboard?.saleAccounts ?? []
      : overviewDashboard?.saleAccounts ?? [];

  const toggleAccountCollapse = useCallback((accountId: string) => {
    setCollapsedAccountIds((current) =>
      current.includes(accountId)
        ? current.filter((value) => value !== accountId)
        : [...current, accountId],
    );
  }, []);

  const toggleFundCollapse = useCallback((accountId: string, fundName: string) => {
    const key = `${accountId}:${fundName}`;
    setCollapsedFundKeys((current) =>
      current.includes(key)
        ? current.filter((value) => value !== key)
        : [...current, key],
    );
  }, []);

  return (
    <PageContainer>
      <PageHeader title="Mutual Funds" />

      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      ) : null}

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as MutualFundTab)}
        className="space-y-6"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            <TabsTrigger value="sells">Sells</TabsTrigger>
          </TabsList>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {activeTab !== "overview" ? (
              <>
                <Select value={selectedBank} onValueChange={setSelectedBank}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="All Banks" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Banks</SelectItem>
                    {bankOptions.map((bank) => (
                      <SelectItem key={bank} value={bank}>
                        {bank}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Accounts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accounts</SelectItem>
                    {accountOptions.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.accountNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            ) : null}

            <Button
              type="button"
              variant="default"
              onClick={() => {
                setEditingAccount(null);
                setAddAccountOpen(true);
              }}
              className="gap-2"
              disabled={!authState?.authenticated}
            >
              <Plus className="h-4 w-4" />
              {authState?.authenticated ? "Add Account" : "Login to Add"}
            </Button>

            <Button
              type="button"
              onClick={() => {
                setEditingPurchase(null);
                setAddPurchaseOpen(true);
              }}
              className="gap-2"
              disabled={!authState?.authenticated || accountsLoading}
            >
              <Plus className="h-4 w-4" />
              {authState?.authenticated ? "Add Purchase" : "Login to Add"}
            </Button>

            <Button
              type="button"
              variant="default"
              onClick={() => {
                setEditingLog(null);
                setLogMonthlyOpen(true);
              }}
              className="gap-2"
              disabled={!authState?.authenticated || accountsLoading}
            >
              <Plus className="h-4 w-4" />
              {authState?.authenticated ? "Log Monthly Data" : "Login to Add"}
            </Button>
          </div>
        </div>

        <TabsContent value="overview" className="space-y-6">
          <PortfolioChartPanel
            summary={displaySummary}
            loading={overviewLoading}
            badgeLabel="Mutual Fund"
            changeLabel="Latest"
            availableRanges={["1M", "3M", "6M", "YTD", "1Y", "5Y", "All"]}
            defaultRange="YTD"
            defaultChartMode="line"
            resolutionOptionsOverride={{
              "1M": ["1d", "1w", "1mo"],
              "3M": ["1d", "1w", "1mo"],
              "6M": ["1d", "1w", "1mo"],
              YTD: ["1d", "1w", "1mo"],
              "1Y": ["1d", "1w", "1mo"],
              "5Y": ["1w", "1mo"],
              All: ["1w", "1mo"],
            }}
          />

          {displayAccountSummaries.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {displayAccountSummaries.map((summary) => (
                <AccountOverviewCard key={summary.id} summary={summary} />
              ))}
            </div>
          ) : (
            <DataCard className="border-gray-200 bg-white px-6 py-10 text-center text-sm text-gray-500 shadow-sm">
              No mutual fund accounts recorded yet.
            </DataCard>
          )}
        </TabsContent>

        <TabsContent value="accounts" className="space-y-6">
          {displayAccountDetails.length ? (
            displayAccountDetails.map((account) => (
              (() => {
                const accountCollapsed = collapsedAccountIds.includes(account.id);
                const totalInvested = account.funds.reduce((sum, fund) => sum + fund.totalInvested, 0);
                const totalValue = account.funds.reduce((sum, fund) => sum + fund.currentValue, 0);
                const totalDividends = account.funds.reduce((sum, fund) => sum + fund.dividends, 0);
                const totalGainLoss = account.funds.reduce((sum, fund) => sum + fund.gainLoss, 0);
                const totalGainLossPct =
                  totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0;
                const positive = totalGainLoss >= 0;

                return (
                  <DataCard
                    key={account.id}
                    className="border-gray-200"
                    title={`${account.bankName} · ${account.accountNumber}`}
                    action={
                      <div className="flex items-center gap-3">
                        <div className="text-right text-xs text-gray-500">
                          <div>{account.currency}</div>
                          {account.notes ? <div>{account.notes}</div> : null}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleAccountCollapse(account.id)}
                        >
                          {accountCollapsed ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronUp className="h-4 w-4" />
                          )}
                        </Button>
                        {authState?.authenticated ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              const editableAccount =
                                accounts.find((candidate) => candidate.id === account.id) ?? null;
                              setEditingAccount(editableAccount);
                              setAddAccountOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    }
                  >
                    <div className="space-y-4 p-4 md:p-6">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="uppercase tracking-[0.14em]">Funds</span>
                        <span className="font-medium text-gray-900">{account.funds.length}</span>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <div>
                          <p className="mb-1 text-xs uppercase tracking-[0.14em] text-gray-500">Invested</p>
                          <p className="text-sm font-medium text-gray-900">
                            {formatMoney(account.currency, totalInvested)}
                          </p>
                        </div>
                        <div>
                          <p className="mb-1 text-xs uppercase tracking-[0.14em] text-gray-500">Current Value</p>
                          <p className="text-sm font-medium text-gray-900">
                            {formatMoney(account.currency, totalValue)}
                          </p>
                        </div>
                        <div>
                          <p className="mb-1 text-xs uppercase tracking-[0.14em] text-gray-500">Dividends</p>
                          <p className="text-sm font-medium text-gray-900">
                            {formatMoney(account.currency, totalDividends)}
                          </p>
                        </div>
                        <div>
                          <p className="mb-1 text-xs uppercase tracking-[0.14em] text-gray-500">Gain/Loss</p>
                          <p className={`text-sm font-medium ${positive ? "text-green-600" : "text-red-600"}`}>
                            {positive ? "+" : "-"}
                            {formatMoney(account.currency, Math.abs(totalGainLoss))} (
                            {Math.abs(totalGainLossPct).toFixed(2)}%)
                          </p>
                        </div>
                      </div>

                      {!accountCollapsed ? (
                        account.funds.length ? (
                          account.funds.map((holding) => (
                            <MutualFundHoldingCard
                              key={`${account.id}-${holding.fundName}`}
                              holding={holding}
                              accountCurrency={account.currency}
                              accountId={account.id}
                              bankName={account.bankName}
                              accountNumber={account.accountNumber}
                              collapsed={collapsedFundKeys.includes(`${account.id}:${holding.fundName}`)}
                              onToggleCollapse={() => toggleFundCollapse(account.id, holding.fundName)}
                              onEditPurchase={(purchase) => {
                                setEditingPurchase(purchase);
                                setAddPurchaseOpen(true);
                              }}
                              onEditLog={(log) => {
                                setEditingLog(log);
                                setLogMonthlyOpen(true);
                              }}
                              onSell={
                                authState?.authenticated
                                  ? (context) => {
                                      setSellContext(context);
                                      setEditingSale(null);
                                      setSellOpen(true);
                                    }
                                  : undefined
                              }
                            />
                          ))
                        ) : (
                          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                            No funds recorded in this account yet.
                          </div>
                        )
                      ) : null}
                    </div>
                  </DataCard>
                );
              })()
            ))
          ) : (
            <DataCard className="border-gray-200 bg-white px-6 py-10 text-center text-sm text-gray-500 shadow-sm">
              {detailLoading ? "Loading mutual fund accounts..." : "No mutual fund accounts match the current filters."}
            </DataCard>
          )}
        </TabsContent>

        <TabsContent value="sells" className="space-y-6">
          {displaySaleAccounts.length ? (
            displaySaleAccounts.map((saleAccount) => (
              <SaleAccountCard
                key={saleAccount.id}
                saleAccount={saleAccount}
                onEditSale={(sale) => {
                  setEditingSale(sale);
                  setSellContext(null);
                  setSellOpen(true);
                }}
              />
            ))
          ) : (
            <DataCard className="border-gray-200 bg-white px-6 py-10 text-center text-sm text-gray-500 shadow-sm">
              {detailLoading ? "Loading sell history..." : "No mutual fund sales match the current filters."}
            </DataCard>
          )}
        </TabsContent>
      </Tabs>

      <AddMutualFundAccountDialog
        open={addAccountOpen}
        onOpenChange={(open) => {
          setAddAccountOpen(open);
          if (!open) {
            setEditingAccount(null);
          }
        }}
        onCreated={refreshMutualFunds}
        initialAccount={editingAccount}
      />
      <AddPurchaseDialog
        open={addPurchaseOpen}
        onOpenChange={(open) => {
          setAddPurchaseOpen(open);
          if (!open) {
            setEditingPurchase(null);
          }
        }}
        accounts={accounts}
        onCreated={refreshMutualFunds}
        initialPurchase={editingPurchase}
      />
      <LogMonthlyDataDialog
        open={logMonthlyOpen}
        onOpenChange={(open) => {
          setLogMonthlyOpen(open);
          if (!open) {
            setEditingLog(null);
          }
        }}
        accounts={accounts}
        accountDetails={overviewDashboard?.accountDetails ?? []}
        onCreated={refreshMutualFunds}
        initialLog={editingLog}
      />
      <SellMutualFundDialog
        open={sellOpen}
        onOpenChange={(open) => {
          setSellOpen(open);
          if (!open) {
            setSellContext(null);
            setEditingSale(null);
          }
        }}
        onCreated={refreshMutualFunds}
        initialContext={sellContext}
        initialSale={editingSale}
      />
    </PageContainer>
  );
}
