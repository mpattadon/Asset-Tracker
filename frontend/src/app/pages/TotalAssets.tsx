import { useEffect, useMemo, useState } from "react";
import { Card } from "../components/ui/card";
import { PageContainer } from "../components/layout/index";
import { TradingViewChart, TradingViewLinePoint } from "../components/charts/TradingViewChart";
import {
  Candlestick,
  getMutualFundDashboard,
  getPortfolioStockHoldings,
  getPortfolioStockSummary,
  MutualFundDashboard,
  StockPositionView,
  StockSummary,
} from "../api";
import { useAuth } from "../auth";
import { usePreferences } from "../preferences";

type CategoryKey =
  | "stocks"
  | "mutualFunds"
  | "bonds"
  | "gold"
  | "banks"
  | "lottery"
  | "options";

interface AssetCategory {
  key: CategoryKey;
  label: string;
  value: number;
  color: string;
  status: string;
  source: string;
}

interface PeriodPoint {
  key: string;
  label: string;
  value: number;
  date: string;
}

interface ContributorItem {
  key: string;
  label: string;
  sublabel: string;
  value: number;
  color: string;
}

const CATEGORY_META: Record<CategoryKey, { label: string; color: string; source: string }> = {
  stocks: {
    label: "Stocks",
    color: "#1d4ed8",
    source: "Live from stock portfolios",
  },
  mutualFunds: {
    label: "Mutual Funds",
    color: "#15803d",
    source: "Live from mutual fund ledgers",
  },
  bonds: {
    label: "Bonds & Debentures",
    color: "#0f766e",
    source: "Placeholder until page is finished",
  },
  gold: {
    label: "Gold",
    color: "#d97706",
    source: "Placeholder until page is finished",
  },
  banks: {
    label: "Banks",
    color: "#7c3aed",
    source: "Placeholder until page is finished",
  },
  lottery: {
    label: "Government Lottery",
    color: "#dc2626",
    source: "Placeholder until page is finished",
  },
  options: {
    label: "Options",
    color: "#475569",
    source: "Placeholder until page is finished",
  },
};

function symbolForCurrency(currency: string) {
  return (
    {
      USD: "$",
      THB: "฿",
      EUR: "€",
      GBP: "£",
      JPY: "¥",
    }[currency] ?? `${currency} `
  );
}

function formatMoney(currency: string, amount: number, maximumFractionDigits = 2) {
  return `${symbolForCurrency(currency)}${amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  })}`;
}

function formatCompactMoney(currency: string, amount: number, maximumFractionDigits = 1) {
  return `${symbolForCurrency(currency)}${new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits,
  }).format(amount)}`;
}

function formatSignedMoney(currency: string, amount: number, maximumFractionDigits = 2) {
  const sign = amount >= 0 ? "+" : "-";
  return `${sign}${formatMoney(currency, Math.abs(amount), maximumFractionDigits)}`;
}

function formatPercent(value: number) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function normalizeDateKey(rawTime: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawTime)) {
    return rawTime;
  }
  const parsed = Date.parse(rawTime);
  if (Number.isNaN(parsed)) {
    return rawTime.slice(0, 10);
  }
  return new Date(parsed).toISOString().slice(0, 10);
}

function dateKeyLabel(dateKey: string, mode: "month" | "year") {
  if (mode === "year") {
    return dateKey;
  }
  const [year, month] = dateKey.split("-");
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function sortDateKeys(left: string, right: string) {
  return left.localeCompare(right);
}

function latestCloseByDate(history: Candlestick[]) {
  const sorted = history
    .slice()
    .sort((left, right) => Date.parse(left.time) - Date.parse(right.time));
  const mapped = new Map<string, number>();
  for (const point of sorted) {
    mapped.set(normalizeDateKey(point.time), point.close);
  }
  return mapped;
}

function aggregateAumHistory(histories: Candlestick[][]): TradingViewLinePoint[] {
  const maps = histories.map((history) => latestCloseByDate(history));
  const allDates = Array.from(
    new Set(maps.flatMap((entry) => Array.from(entry.keys()))),
  ).sort(sortDateKeys);
  if (!allDates.length) {
    return [];
  }

  const lastKnownValues = new Array<number>(maps.length).fill(0);
  return allDates.map((dateKey) => {
    maps.forEach((entry, index) => {
      const nextValue = entry.get(dateKey);
      if (nextValue != null) {
        lastKnownValues[index] = nextValue;
      }
    });
    return {
      time: dateKey,
      value: lastKnownValues.reduce((sum, value) => sum + value, 0),
    };
  });
}

function collapsePeriod(points: TradingViewLinePoint[], mode: "month" | "year"): PeriodPoint[] {
  const grouped = new Map<string, TradingViewLinePoint>();
  for (const point of points) {
    const dateKey = normalizeDateKey(point.time);
    const key = mode === "month" ? dateKey.slice(0, 7) : dateKey.slice(0, 4);
    grouped.set(key, { time: dateKey, value: point.value });
  }

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, point]) => ({
      key,
      label: dateKeyLabel(key, mode),
      value: point.value,
      date: point.time,
    }));
}

function buildPieBackground(items: AssetCategory[], total: number) {
  if (total <= 0) {
    return "conic-gradient(#e5e7eb 0deg 360deg)";
  }

  let cursor = 0;
  const segments = items
    .filter((item) => item.value > 0)
    .map((item) => {
      const degrees = (item.value / total) * 360;
      const start = cursor;
      const end = cursor + degrees;
      cursor = end;
      return `${item.color} ${start}deg ${end}deg`;
    });

  return `conic-gradient(${segments.join(", ")})`;
}

function buildContributorPieBackground(items: ContributorItem[], total: number) {
  if (total <= 0 || !items.length) {
    return "conic-gradient(#e5e7eb 0deg 360deg)";
  }

  let cursor = 0;
  const segments = items.map((item) => {
    const degrees = (item.value / total) * 360;
    const start = cursor;
    const end = cursor + degrees;
    cursor = end;
    return `${item.color} ${start}deg ${end}deg`;
  });
  return `conic-gradient(${segments.join(", ")})`;
}

function changePercent(base: number, current: number) {
  if (base === 0) {
    return current === 0 ? 0 : 100;
  }
  return ((current - base) / base) * 100;
}

function TopContributorsPanel({
  items,
  total,
  currency,
}: {
  items: ContributorItem[];
  total: number;
  currency: string;
}) {
  return (
    <Card className="border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Holdings</p>
          <h2 className="mt-2 text-xl font-medium text-gray-950">Top Contributors</h2>
          <p className="mt-1 text-sm text-gray-500">
            Largest live holdings across stocks and mutual funds, capped at the top five.
          </p>
        </div>
        <div className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600">
          {items.length} slices
        </div>
      </div>

      <div className="mt-6 grid gap-8 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="flex items-center justify-center">
          <div
            className="relative h-64 w-64 rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
            style={{ background: buildContributorPieBackground(items, total) }}
          >
            <div className="absolute inset-[22%] flex flex-col items-center justify-center rounded-full border border-white/80 bg-white shadow-sm">
              <span className="text-xs uppercase tracking-[0.18em] text-gray-500">Top 5</span>
              <span className="mt-2 text-center text-2xl font-semibold tracking-tight text-gray-950">
                {formatCompactMoney(currency, total)}
              </span>
              <span className="mt-1 px-4 text-center text-[11px] text-gray-500">
                {formatMoney(currency, total)}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const share = total > 0 ? (item.value / total) * 100 : 0;
            return (
              <div
                key={item.key}
                className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <p className="text-sm font-medium text-gray-900">{item.label}</p>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{item.sublabel}</p>
                  </div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-gray-500">Live</p>
                </div>
                <div className="mt-3 flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold text-gray-950">
                      {formatCompactMoney(currency, item.value)}
                    </p>
                    <p className="mt-1 truncate text-xs text-gray-500">
                      {formatMoney(currency, item.value)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm text-gray-600">{share.toFixed(1)}%</p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(share, item.value > 0 ? 2 : 0)}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function PeriodSummaryCard({
  title,
  subtitle,
  lineData,
  values,
  currency,
}: {
  title: string;
  subtitle: string;
  lineData: TradingViewLinePoint[];
  values: PeriodPoint[];
  currency: string;
}) {
  const latest = values.at(-1)?.value ?? 0;
  const base = values.at(0)?.value ?? latest;
  const delta = latest - base;
  const deltaPct = changePercent(base, latest);

  return (
    <Card className="border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{title}</p>
          <h3 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">
            {formatCompactMoney(currency, latest)}
          </h3>
          <p className="mt-1 text-xs text-gray-500">{formatMoney(currency, latest)}</p>
          <p className={`mt-2 text-sm font-medium ${delta >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatSignedMoney(currency, delta)} ({formatPercent(deltaPct)})
          </p>
        </div>
        <p className="max-w-[18rem] text-sm text-gray-500 lg:text-right">{subtitle}</p>
      </div>

      <div className="mt-5 h-64 rounded-2xl border border-gray-200 bg-gray-50 p-3">
        {lineData.length ? (
          <TradingViewChart
            height={228}
            mode="line"
            lineData={lineData}
            currency={currency}
            accentColor={delta >= 0 ? "#2563eb" : "#dc2626"}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            No history yet
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {values.slice(-4).map((entry) => (
          <div key={entry.key} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.14em] text-gray-500">{entry.label}</p>
            <p className="mt-2 text-base font-semibold text-gray-950">
              {formatCompactMoney(currency, entry.value)}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function TotalAssets() {
  const { authState } = useAuth();
  const { preferredCurrency } = usePreferences();
  const [stockSummary, setStockSummary] = useState<StockSummary | null>(null);
  const [stockHoldings, setStockHoldings] = useState<StockPositionView[]>([]);
  const [mutualFundDashboard, setMutualFundDashboard] = useState<MutualFundDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [stocks, stockPositions, funds] = await Promise.all([
          getPortfolioStockSummary("all"),
          getPortfolioStockHoldings("all"),
          getMutualFundDashboard(),
        ]);
        if (!cancelled) {
          setStockSummary(stocks);
          setStockHoldings(stockPositions);
          setMutualFundDashboard(funds);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load total asset dashboard.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [preferredCurrency]);

  const topContributors = useMemo<ContributorItem[]>(() => {
    const stockItems = stockHoldings.map((holding, index) => ({
      key: `stock-${holding.symbol}-${index}`,
      label: holding.symbol,
      sublabel: `Stock · ${holding.name}`,
      value: holding.value,
      color: ["#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd"][index % 5],
    }));

    const fundItems =
      mutualFundDashboard?.accountDetails.flatMap((account, accountIndex) =>
        account.funds.map((fund, fundIndex) => ({
          key: `fund-${account.id}-${fund.fundName}`,
          label: fund.fundName,
          sublabel: `Fund · ${account.bankName} ${account.accountNumber}`,
          value: fund.currentValue,
          color: ["#15803d", "#16a34a", "#22c55e", "#4ade80", "#86efac"][(accountIndex + fundIndex) % 5],
        })),
      ) ?? [];

    const ranked = [...stockItems, ...fundItems]
      .filter((item) => item.value > 0)
      .sort((left, right) => right.value - left.value);

    const topFive = ranked.slice(0, 5);
    const otherValue = ranked.slice(5).reduce((sum, item) => sum + item.value, 0);
    if (otherValue > 0) {
      topFive.push({
        key: "other",
        label: "Other",
        sublabel: "All remaining live holdings",
        value: otherValue,
        color: "#94a3b8",
      });
    }
    return topFive;
  }, [mutualFundDashboard?.accountDetails, stockHoldings]);
  const topContributorTotal = useMemo(
    () => topContributors.reduce((sum, item) => sum + item.value, 0),
    [topContributors],
  );

  const categories = useMemo<AssetCategory[]>(() => {
    const stocksValue = stockSummary?.totalValue ?? 0;
    const fundsValue = mutualFundDashboard?.summary.totalValue ?? 0;

    return [
      {
        key: "stocks",
        label: CATEGORY_META.stocks.label,
        color: CATEGORY_META.stocks.color,
        value: stocksValue,
        status: "Live",
        source: CATEGORY_META.stocks.source,
      },
      {
        key: "mutualFunds",
        label: CATEGORY_META.mutualFunds.label,
        color: CATEGORY_META.mutualFunds.color,
        value: fundsValue,
        status: "Live",
        source: CATEGORY_META.mutualFunds.source,
      },
      {
        key: "bonds",
        label: CATEGORY_META.bonds.label,
        color: CATEGORY_META.bonds.color,
        value: 0,
        status: "Stub",
        source: CATEGORY_META.bonds.source,
      },
      {
        key: "gold",
        label: CATEGORY_META.gold.label,
        color: CATEGORY_META.gold.color,
        value: 0,
        status: "Stub",
        source: CATEGORY_META.gold.source,
      },
      {
        key: "banks",
        label: CATEGORY_META.banks.label,
        color: CATEGORY_META.banks.color,
        value: 0,
        status: "Stub",
        source: CATEGORY_META.banks.source,
      },
      {
        key: "lottery",
        label: CATEGORY_META.lottery.label,
        color: CATEGORY_META.lottery.color,
        value: 0,
        status: "Stub",
        source: CATEGORY_META.lottery.source,
      },
      {
        key: "options",
        label: CATEGORY_META.options.label,
        color: CATEGORY_META.options.color,
        value: 0,
        status: "Stub",
        source: CATEGORY_META.options.source,
      },
    ];
  }, [mutualFundDashboard?.summary.totalValue, stockSummary?.totalValue]);

  const totalAum = useMemo(
    () => categories.reduce((sum, category) => sum + category.value, 0),
    [categories],
  );
  const liveCategories = useMemo(
    () => categories.filter((category) => category.status === "Live" && category.value > 0).length,
    [categories],
  );
  const totalTrackedGainLoss = (stockSummary?.totalChange ?? 0) + (mutualFundDashboard?.summary.totalChange ?? 0);
  const totalTrackedGainLossPct = changePercent(totalAum - totalTrackedGainLoss, totalAum);

  const aumHistory = useMemo(
    () =>
      aggregateAumHistory([
        stockSummary?.dailyHistory ?? [],
        mutualFundDashboard?.summary.dailyHistory ?? [],
      ]),
    [mutualFundDashboard?.summary.dailyHistory, stockSummary?.dailyHistory],
  );
  const monthlyPoints = useMemo(() => collapsePeriod(aumHistory, "month"), [aumHistory]);
  const yearlyPoints = useMemo(() => collapsePeriod(aumHistory, "year"), [aumHistory]);
  const monthlyLineData = useMemo(
    () => monthlyPoints.map((point) => ({ time: point.date, value: point.value })),
    [monthlyPoints],
  );
  const yearlyLineData = useMemo(
    () => yearlyPoints.map((point) => ({ time: point.date, value: point.value })),
    [yearlyPoints],
  );

  return (
    <PageContainer>
      <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Total Assets</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">
            Multi-asset overview
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-500">
            A quick summary of your total holdings, live AUM, and portfolio size. Stocks and mutual funds are live,
            while the remaining asset classes stay visible as placeholders until their pages are finished.
          </p>
        </div>
        <div className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm">
          Base currency: {preferredCurrency}
        </div>
      </div>

      {error ? (
        <Card className="border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </Card>
      ) : null}

      <Card className="overflow-hidden border-gray-200 bg-white shadow-sm">
        <div className="bg-[radial-gradient(circle_at_top_left,_rgba(29,78,216,0.12),_transparent_38%),linear-gradient(180deg,_#ffffff,_#f8fafc)] p-6 sm:p-8">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-gray-500">Total AUM</p>
              <h2 className="mt-3 break-words text-4xl font-semibold tracking-tight text-gray-950 sm:text-5xl">
                {loading ? "Loading..." : formatCompactMoney(preferredCurrency, totalAum, 2)}
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                {loading ? "Loading full amount..." : formatMoney(preferredCurrency, totalAum)}
              </p>
              <p
                className={`mt-4 text-sm font-medium ${
                  totalTrackedGainLoss >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {loading
                  ? "Loading live totals..."
                  : `${formatSignedMoney(preferredCurrency, totalTrackedGainLoss)} (${formatPercent(
                      totalTrackedGainLossPct,
                    )}) tracked performance`}
              </p>

              <div className="mt-6 flex flex-wrap gap-3 text-xs text-gray-500">
                <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5">
                  {authState?.authenticated ? "Signed in" : "Browsing as guest"}
                </span>
                <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5">
                  Stocks and mutual funds are live on this page
                </span>
                <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5">
                  Remaining modules stay visible as release placeholders
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-2xl border border-white/70 bg-white/90 px-4 py-4 shadow-sm backdrop-blur">
                <p className="text-xs uppercase tracking-[0.14em] text-gray-500">Stocks</p>
                <p className="mt-2 break-words text-xl font-semibold text-gray-950">
                  {loading ? "..." : formatCompactMoney(preferredCurrency, stockSummary?.totalValue ?? 0)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {loading ? "" : formatMoney(preferredCurrency, stockSummary?.totalValue ?? 0)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/90 px-4 py-4 shadow-sm backdrop-blur">
                <p className="text-xs uppercase tracking-[0.14em] text-gray-500">Mutual Funds</p>
                <p className="mt-2 break-words text-xl font-semibold text-gray-950">
                  {loading
                    ? "..."
                    : formatCompactMoney(preferredCurrency, mutualFundDashboard?.summary.totalValue ?? 0)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {loading ? "" : formatMoney(preferredCurrency, mutualFundDashboard?.summary.totalValue ?? 0)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/90 px-4 py-4 shadow-sm backdrop-blur">
                <p className="text-xs uppercase tracking-[0.14em] text-gray-500">Coverage</p>
                <p className="mt-2 text-xl font-semibold text-gray-950">
                  {liveCategories} / {categories.length}
                </p>
                <p className="mt-1 text-xs text-gray-500">Live categories wired into this page</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <TopContributorsPanel
        items={topContributors}
        total={topContributorTotal}
        currency={preferredCurrency}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <PeriodSummaryCard
          title="Monthly AUM"
          subtitle="Month-end total AUM in your preferred currency across the live modules."
          lineData={monthlyLineData}
          values={monthlyPoints}
          currency={preferredCurrency}
        />
        <PeriodSummaryCard
          title="Yearly AUM"
          subtitle="Year-end total AUM snapshot, useful for checking account size growth over time."
          lineData={yearlyLineData}
          values={yearlyPoints}
          currency={preferredCurrency}
        />
      </div>

      <Card className="border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-5">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Category Summary</p>
          <h3 className="mt-2 text-xl font-semibold text-gray-950">Tracked asset classes</h3>
        </div>
        <div className="grid gap-4 p-6 lg:grid-cols-2">
          {categories.map((category) => {
            const share = totalAum > 0 ? (category.value / totalAum) * 100 : 0;
            return (
              <div
                key={category.key}
                className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <p className="text-sm font-semibold text-gray-950">{category.label}</p>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{category.source}</p>
                  </div>
                  <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600">
                    {category.status}
                  </span>
                </div>
                <div className="mt-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-gray-500">Value</p>
                    <p className="mt-1 break-words text-lg font-semibold text-gray-950">
                      {formatCompactMoney(preferredCurrency, category.value)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {formatMoney(preferredCurrency, category.value)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-[0.14em] text-gray-500">Share</p>
                    <p className="mt-1 text-sm font-medium text-gray-700">{share.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </PageContainer>
  );
}
