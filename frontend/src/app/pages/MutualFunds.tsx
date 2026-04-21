import { useEffect, useMemo, useState } from "react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { ChevronDown, ChevronUp, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { TradingViewChart } from "../components/charts/TradingViewChart";
import { AddBankAccountDialog } from "../components/AddBankAccountDialog";
import { AddPurchaseDialog } from "../components/AddPurchaseDialog";
import { LogMonthlyDataDialog } from "../components/LogMonthlyDataDialog";
import { PortfolioChartPanel } from "../components/stocks/PortfolioChartPanel";
import { Candlestick, StockSummary } from "../api";
import { PageContainer, PageHeader } from "../components/layout/index";
import { useAuth } from "../auth";
import { usePreferences } from "../preferences";

interface MonthlyEntry {
  month: string;
  invested: number;
  marketValue: number;
  dividends: number;
}

interface Fund {
  name: string;
  riskLevel: "Low" | "Medium" | "High";
  category: string;
  totalInvested: number;
  currentValue: number;
  dividends: number;
  monthlyData: MonthlyEntry[];
  chartData: { value: number }[];
}

interface FundAccount {
  accountNumber: string;
  notes: string;
  funds: Fund[];
}

interface FundBank {
  bank: string;
  accounts: FundAccount[];
}

const fundsData: FundBank[] = [
  {
    bank: "SCB",
    accounts: [
      {
        accountNumber: "XXX-X-XXXXX-X",
        notes: "SCBAM",
        funds: [
          {
            name: "SCB-GMCORE(A)",
            riskLevel: "Low",
            category: "Equity",
            totalInvested: 50000,
            currentValue: 54200,
            dividends: 1200,
            monthlyData: [
              { month: "Jan 2026", invested: 50000, marketValue: 51500, dividends: 200 },
              { month: "Feb 2026", invested: 50000, marketValue: 52800, dividends: 400 },
              { month: "Mar 2026", invested: 50000, marketValue: 54200, dividends: 600 },
            ],
            chartData: [{ value: 51500 }, { value: 52800 }, { value: 54200 }],
          },
          {
            name: "SCB-EQUITY",
            riskLevel: "High",
            category: "Equity",
            totalInvested: 30000,
            currentValue: 32400,
            dividends: 800,
            monthlyData: [
              { month: "Jan 2026", invested: 30000, marketValue: 30900, dividends: 200 },
              { month: "Feb 2026", invested: 30000, marketValue: 31800, dividends: 400 },
              { month: "Mar 2026", invested: 30000, marketValue: 32400, dividends: 200 },
            ],
            chartData: [{ value: 30900 }, { value: 31800 }, { value: 32400 }],
          },
        ],
      },
      {
        accountNumber: "XXX-X-XXXXX-Y",
        notes: "Link account",
        funds: [
          {
            name: "SCB-DIVIDEND",
            riskLevel: "Medium",
            category: "Mixed",
            totalInvested: 40000,
            currentValue: 41500,
            dividends: 2100,
            monthlyData: [
              { month: "Jan 2026", invested: 40000, marketValue: 40500, dividends: 700 },
              { month: "Feb 2026", invested: 40000, marketValue: 41000, dividends: 700 },
              { month: "Mar 2026", invested: 40000, marketValue: 41500, dividends: 700 },
            ],
            chartData: [{ value: 40500 }, { value: 41000 }, { value: 41500 }],
          },
        ],
      },
    ],
  },
  {
    bank: "BBL",
    accounts: [
      {
        accountNumber: "XXX-X-XXXXX-Z",
        notes: "BBLAM",
        funds: [
          {
            name: "BBL-GROWTH",
            riskLevel: "High",
            category: "Equity",
            totalInvested: 25000,
            currentValue: 26800,
            dividends: 400,
            monthlyData: [
              { month: "Jan 2026", invested: 25000, marketValue: 25600, dividends: 100 },
              { month: "Feb 2026", invested: 25000, marketValue: 26200, dividends: 150 },
              { month: "Mar 2026", invested: 25000, marketValue: 26800, dividends: 150 },
            ],
            chartData: [{ value: 25600 }, { value: 26200 }, { value: 26800 }],
          },
        ],
      },
    ],
  },
];

interface FundCardProps {
  fund: Fund;
  currency: string;
  canEdit: boolean;
}

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

function monthLabelToIso(label: string) {
  const parsed = Date.parse(`01 ${label}`);
  if (Number.isNaN(parsed)) {
    return "2026-01-01";
  }
  return new Date(parsed).toISOString().slice(0, 10);
}

function monthlyEntriesToCandles(entries: MonthlyEntry[]): Candlestick[] {
  return entries.map((entry, index) => {
    const previousClose = index > 0 ? entries[index - 1].marketValue : entry.marketValue;
    const close = entry.marketValue;
    return {
      time: monthLabelToIso(entry.month),
      open: previousClose,
      high: Math.max(previousClose, close),
      low: Math.min(previousClose, close),
      close,
    };
  });
}

function performanceEntriesToCandles(entries: MonthlyEntry[]): Candlestick[] {
  return entries.map((entry, index) => {
    const previousEntry = index > 0 ? entries[index - 1] : entry;
    const currentPerformance =
      entry.invested === 0 ? 0 : ((entry.marketValue - entry.invested) / entry.invested) * 100;
    const previousPerformance =
      previousEntry.invested === 0
        ? currentPerformance
        : ((previousEntry.marketValue - previousEntry.invested) / previousEntry.invested) * 100;
    return {
      time: monthLabelToIso(entry.month),
      open: previousPerformance,
      high: Math.max(previousPerformance, currentPerformance),
      low: Math.min(previousPerformance, currentPerformance),
      close: currentPerformance,
    };
  });
}

function buildMutualFundSummary(
  banks: FundBank[],
  preferredCurrency: string,
  selectedBank: string,
  selectedAccount: string,
): StockSummary {
  const timeline = new Map<string, { invested: number; value: number }>();
  const allFunds = banks.flatMap((bank) => bank.accounts.flatMap((account) => account.funds));

  for (const fund of allFunds) {
    for (const entry of fund.monthlyData) {
      const key = monthLabelToIso(entry.month);
      const current = timeline.get(key) ?? { invested: 0, value: 0 };
      current.invested += entry.invested;
      current.value += entry.marketValue;
      timeline.set(key, current);
    }
  }

  const orderedTimeline = Array.from(timeline.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([time, entry]) => ({
      time,
      invested: entry.invested,
      marketValue: entry.value,
    }));

  const dailyHistory = monthlyEntriesToCandles(
    orderedTimeline.map((entry) => ({
      month: new Date(entry.time).toLocaleString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }),
      invested: entry.invested,
      marketValue: entry.marketValue,
      dividends: 0,
    })),
  );
  const performanceDailyHistory = performanceEntriesToCandles(
    orderedTimeline.map((entry) => ({
      month: new Date(entry.time).toLocaleString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }),
      invested: entry.invested,
      marketValue: entry.marketValue,
      dividends: 0,
    })),
  );

  const latest = orderedTimeline.at(-1) ?? { invested: 0, marketValue: 0 };
  const previous = orderedTimeline.length > 1 ? orderedTimeline[orderedTimeline.length - 2] : latest;
  const totalChange = latest.marketValue - latest.invested;
  const totalChangePct = latest.invested === 0 ? 0 : (totalChange / latest.invested) * 100;
  const dayChange = latest.marketValue - previous.marketValue;
  const dayChangePct = previous.marketValue === 0 ? 0 : (dayChange / previous.marketValue) * 100;

  const title =
    selectedAccount !== "all"
      ? selectedAccount
      : selectedBank !== "all"
      ? `${selectedBank} Mutual Funds`
      : "All Mutual Funds";

  return {
    market: "mutual-funds",
    title,
    currency: preferredCurrency,
    totalValue: latest.marketValue,
    dayChange,
    dayChangePct,
    totalChange,
    totalChangePct,
    series: orderedTimeline.map((entry) => entry.marketValue),
    candlesticks: dailyHistory,
    intradayHistory: [],
    dailyHistory,
    performanceIntradayHistory: [],
    performanceDailyHistory,
  };
}

function FundCard({ fund, currency, canEdit }: FundCardProps) {
  const [expanded, setExpanded] = useState(false);
  const gainLoss = fund.currentValue - fund.totalInvested;
  const gainLossPercent = fund.totalInvested === 0 ? 0 : (gainLoss / fund.totalInvested) * 100;
  const isPositive = gainLoss >= 0;
  const chartSeries = fund.chartData.map((entry, index) => ({
    time: monthLabelToIso(fund.monthlyData[index]?.month ?? `Jan ${2026 + index}`),
    value: entry.value,
  }));

  return (
    <Card className="border-gray-200 bg-white shadow-sm">
      <div className="p-5">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <h4 className="text-base font-medium text-gray-900">{fund.name}</h4>
            <Badge
              variant="outline"
              className={
                fund.riskLevel === "Low"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : fund.riskLevel === "Medium"
                  ? "border-yellow-200 bg-yellow-50 text-yellow-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }
            >
              {fund.riskLevel}
            </Badge>
            <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-500">{fund.category}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="gap-1"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Hide
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Details
              </>
            )}
          </Button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div>
            <p className="mb-1 text-xs text-gray-500">Total Invested</p>
            <p className="text-base font-medium text-gray-900">{formatMoney(currency, fund.totalInvested)}</p>
          </div>
          <div>
            <p className="mb-1 text-xs text-gray-500">Current Value</p>
            <p className="text-base font-medium text-gray-900">{formatMoney(currency, fund.currentValue)}</p>
          </div>
          <div>
            <p className="mb-1 text-xs text-gray-500">Gain/Loss</p>
            <div className="flex items-center gap-1">
              <p className={`text-base font-medium ${isPositive ? "text-green-600" : "text-red-600"}`}>
                {isPositive ? "+" : ""}
                {formatMoney(currency, gainLoss)}
              </p>
              {isPositive ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
            </div>
            <p className={`text-xs ${isPositive ? "text-green-600" : "text-red-600"}`}>
              {isPositive ? "+" : ""}
              {gainLossPercent.toFixed(2)}%
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs text-gray-500">Total Dividends</p>
            <p className="text-base font-medium text-gray-900">{formatMoney(currency, fund.dividends)}</p>
          </div>
        </div>

        <div className="h-16 w-full">
          <TradingViewChart
            height={64}
            mode="line"
            lineData={chartSeries}
            currency={currency}
            accentColor={isPositive ? "#10b981" : "#ef4444"}
          />
        </div>
      </div>

      {expanded ? (
        <div className="border-t border-gray-200 bg-gray-50 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h5 className="text-sm font-medium text-gray-900">Monthly Data</h5>
            <Button variant="outline" size="sm" className="gap-2" disabled={!canEdit}>
              <Plus className="h-4 w-4" />
              {canEdit ? "Add Monthly Entry" : "Login to Add"}
            </Button>
          </div>
          <div className="space-y-2">
            {fund.monthlyData.map((entry, index) => {
              const monthGainLoss = entry.marketValue - entry.invested;
              const monthIsPositive = monthGainLoss >= 0;
              return (
                <div key={index} className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                    <div>
                      <p className="mb-1 text-xs text-gray-500">Month</p>
                      <p className="text-sm font-medium text-gray-900">{entry.month}</p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-gray-500">Invested</p>
                      <p className="text-sm text-gray-900">{formatMoney(currency, entry.invested)}</p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-gray-500">Market Value</p>
                      <p className="text-sm text-gray-900">{formatMoney(currency, entry.marketValue)}</p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-gray-500">Gain/Loss</p>
                      <p className={`text-sm font-medium ${monthIsPositive ? "text-green-600" : "text-red-600"}`}>
                        {monthIsPositive ? "+" : ""}
                        {formatMoney(currency, monthGainLoss)}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-gray-500">Dividends</p>
                      <p className="text-sm text-gray-900">{formatMoney(currency, entry.dividends)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

export function MutualFunds() {
  const { authState } = useAuth();
  const { preferredCurrency } = usePreferences();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedBank, setSelectedBank] = useState<string>("all");
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [addPurchaseOpen, setAddPurchaseOpen] = useState(false);
  const [logMonthlyOpen, setLogMonthlyOpen] = useState(false);

  const bankOptions = useMemo(() => fundsData.map((bank) => bank.bank), []);
  const accountOptions = useMemo(() => {
    const banks =
      selectedBank === "all" ? fundsData : fundsData.filter((bank) => bank.bank === selectedBank);
    return banks.flatMap((bank) => bank.accounts.map((account) => account.accountNumber));
  }, [selectedBank]);

  useEffect(() => {
    if (selectedAccount !== "all" && !accountOptions.includes(selectedAccount)) {
      setSelectedAccount("all");
    }
  }, [accountOptions, selectedAccount]);

  const filteredBanks = useMemo(() => {
    return fundsData
      .filter((bank) => selectedBank === "all" || bank.bank === selectedBank)
      .map((bank) => ({
        ...bank,
        accounts: bank.accounts.filter(
          (account) => selectedAccount === "all" || account.accountNumber === selectedAccount,
        ),
      }))
      .filter((bank) => bank.accounts.length > 0);
  }, [selectedAccount, selectedBank]);

  const aggregateSummary = useMemo(
    () => buildMutualFundSummary(filteredBanks, preferredCurrency, selectedBank, selectedAccount),
    [filteredBanks, preferredCurrency, selectedAccount, selectedBank],
  );

  const accountSummaries = useMemo(() => {
    return filteredBanks.flatMap((bank) =>
      bank.accounts.map((account) => {
        const invested = account.funds.reduce((sum, fund) => sum + fund.totalInvested, 0);
        const currentValue = account.funds.reduce((sum, fund) => sum + fund.currentValue, 0);
        const dividends = account.funds.reduce((sum, fund) => sum + fund.dividends, 0);
        const gainLoss = currentValue - invested;
        const gainLossPct = invested === 0 ? 0 : (gainLoss / invested) * 100;
        return {
          bank: bank.bank,
          accountNumber: account.accountNumber,
          notes: account.notes,
          invested,
          currentValue,
          dividends,
          gainLoss,
          gainLossPct,
        };
      }),
    );
  }, [filteredBanks]);

  return (
    <PageContainer>
      <PageHeader title="Mutual Funds" />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
          </TabsList>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {activeTab === "accounts" ? (
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
                  <SelectTrigger className="w-[170px]">
                    <SelectValue placeholder="All Accounts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accounts</SelectItem>
                    {accountOptions.map((account) => (
                      <SelectItem key={account} value={account}>
                        {account}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            ) : null}

            <Button
              variant="outline"
              onClick={() => setAddAccountOpen(true)}
              className="gap-2"
              disabled={!authState?.authenticated}
            >
              <Plus className="h-4 w-4" />
              {authState?.authenticated ? "Add Account" : "Login to Add"}
            </Button>

            <Button
              onClick={() => setAddPurchaseOpen(true)}
              className="gap-2"
              disabled={!authState?.authenticated}
            >
              <Plus className="h-4 w-4" />
              {authState?.authenticated ? "Add Purchase" : "Login to Add"}
            </Button>

            <Button
              variant="outline"
              onClick={() => setLogMonthlyOpen(true)}
              className="gap-2"
              disabled={!authState?.authenticated}
            >
              <Plus className="h-4 w-4" />
              {authState?.authenticated ? "Log Monthly Data" : "Login to Add"}
            </Button>
          </div>
        </div>

        <TabsContent value="overview" className="space-y-6">
          <PortfolioChartPanel
            summary={aggregateSummary}
            badgeLabel="Mutual Fund"
            changeLabel="Latest"
          />

          {accountSummaries.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {accountSummaries.map((account) => {
                const positive = account.gainLoss >= 0;
                return (
                  <Card
                    key={`${account.bank}-${account.accountNumber}`}
                    className="border-gray-200 bg-white p-5 shadow-sm"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{account.accountNumber}</p>
                          <p className="mt-1 text-xs text-gray-500">
                            {account.bank} · {account.notes}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs text-gray-600">
                          Account
                        </Badge>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-[0.16em] text-gray-500">
                          Current Value
                        </p>
                        <p className="text-2xl font-semibold text-gray-950">
                          {formatMoney(preferredCurrency, account.currentValue)}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="mb-1 text-xs text-gray-500">Total Invested</p>
                          <p className="font-medium text-gray-900">
                            {formatMoney(preferredCurrency, account.invested)}
                          </p>
                        </div>
                        <div>
                          <p className="mb-1 text-xs text-gray-500">Dividends</p>
                          <p className="font-medium text-gray-900">
                            {formatMoney(preferredCurrency, account.dividends)}
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="mb-1 text-xs text-gray-500">Gain/Loss</p>
                        <p className={`text-base font-medium ${positive ? "text-green-600" : "text-red-600"}`}>
                          {positive ? "+" : "-"}
                          {formatMoney(preferredCurrency, Math.abs(account.gainLoss))} (
                          {Math.abs(account.gainLossPct).toFixed(2)}%)
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <DataCard className="border-gray-200 bg-white px-6 py-10 text-center text-sm text-gray-500 shadow-sm">
              No mutual fund accounts match the current bank/account filters.
            </DataCard>
          )}
        </TabsContent>

        <TabsContent value="accounts" className="space-y-6">
          {filteredBanks.length ? (
            filteredBanks.map((bankData) => (
              <div key={bankData.bank} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-gray-200" />
                  <h3 className="text-lg font-medium text-gray-900">{bankData.bank}</h3>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>

                {bankData.accounts.map((account) => (
                  <div key={account.accountNumber} className="space-y-3">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            Account: {account.accountNumber}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">{account.notes}</p>
                        </div>
                      </div>
                    </div>

                    <div className="ml-4 space-y-3">
                      {account.funds.map((fund) => (
                        <FundCard
                          key={`${account.accountNumber}-${fund.name}`}
                          fund={fund}
                          currency={preferredCurrency}
                          canEdit={Boolean(authState?.authenticated)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))
          ) : (
            <DataCard className="border-gray-200 bg-white px-6 py-10 text-center text-sm text-gray-500 shadow-sm">
              No mutual fund accounts match the current bank/account filters.
            </DataCard>
          )}
        </TabsContent>
      </Tabs>

      <AddBankAccountDialog open={addAccountOpen} onOpenChange={setAddAccountOpen} />
      <AddPurchaseDialog open={addPurchaseOpen} onOpenChange={setAddPurchaseOpen} />
      <LogMonthlyDataDialog open={logMonthlyOpen} onOpenChange={setLogMonthlyOpen} />
    </PageContainer>
  );
}
