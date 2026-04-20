import { useEffect, useMemo, useState } from "react";
import { Card } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { PageContainer, DataCard } from "../components/layout/index";
import { AllocationItem, getAssetSummary, SummaryCard as SummaryCardType } from "../api";
import { useAuth } from "../auth";
import { usePreferences } from "../preferences";

function findCard(cards: SummaryCardType[], label: string) {
  return cards.find((card) => card.label === label) ?? null;
}

function formatCurrency(currency: string, amount: number | null, maximumFractionDigits = 2) {
  if (amount == null || Number.isNaN(amount)) {
    return "Loading...";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(amount);
}

export function TotalAssets() {
  const { authState } = useAuth();
  const { preferredCurrency, convertFromThb, loadingRate } = usePreferences();
  const [summary, setSummary] = useState<{ cards: SummaryCardType[]; allocation: AllocationItem[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      setLoading(true);
      setError("");
      try {
        const result = await getAssetSummary();
        if (!cancelled) {
          setSummary(result);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load summary data.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSummary();
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = useMemo(() => summary?.cards ?? [], [summary]);
  const allocationData = useMemo(
    () =>
      (summary?.allocation ?? []).map((item) => ({
        name: item.area,
        value: item.percent,
        color: item.color,
      })),
    [summary],
  );

  const investedPercent = useMemo(() => {
    const equities = summary?.allocation.find((item) => item.area === "Equities")?.percent ?? 0;
    const fixedIncome =
      summary?.allocation.find((item) => item.area === "Fixed Income")?.percent ?? 0;
    return Math.min(100, equities + fixedIncome);
  }, [summary]);

  const netWorthCard = findCard(cards, "Net Worth");
  const investedCard = findCard(cards, "Invested");
  const cashCard = findCard(cards, "Cash & Savings");
  const alternativesCard = findCard(cards, "Alternatives");
  const netWorth = formatCurrency(preferredCurrency, convertFromThb(netWorthCard?.amount ?? 0));
  const invested = formatCurrency(preferredCurrency, convertFromThb(investedCard?.amount ?? 0));
  const cash = formatCurrency(preferredCurrency, convertFromThb(cashCard?.amount ?? 0));
  const alternatives = formatCurrency(preferredCurrency, convertFromThb(alternativesCard?.amount ?? 0));
  const netWorthDelta = netWorthCard?.delta ?? "Live priced";
  const showCurrencyLoading = preferredCurrency !== "THB" && loadingRate;

  return (
    <PageContainer>
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm text-gray-500">Total Assets</p>
          <p className="text-xs text-gray-400">
            {authState?.authenticated
              ? `Total Assets are shown in ${preferredCurrency}. Stock portfolios still use each portfolio's own base currency.`
              : "Browsing as guest. Login to load your saved portfolio and record changes."}
          </p>
        </div>
        <div className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm">
          Preferred currency: {preferredCurrency}
        </div>
      </div>

      {error ? (
        <Card className="border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <Card className="p-6 sm:p-8 bg-white border-gray-200 shadow-sm">
          <h2 className="text-lg sm:text-xl font-normal text-gray-900 mb-2">
            Your cross-market dashboard
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mb-6">
            Track and analyze your investments across multiple asset classes. Total Assets converts
            backend THB totals into your preferred currency using the latest available FX rate from
            the market-data sidecar.
          </p>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
            {showCurrencyLoading
              ? "Refreshing preferred-currency conversion..."
              : `Showing totals in ${preferredCurrency}.`}
          </div>
        </Card>

        <Card className="p-6 sm:p-8 bg-white border-gray-200 shadow-sm">
          <div className="mb-6">
            <p className="text-sm text-gray-500 mb-1">Total Net Worth</p>
            <p className="text-3xl font-normal text-gray-900">
              {loading ? "Loading..." : netWorth}
            </p>
            <p className="text-sm text-green-600 mt-1">{netWorthDelta}</p>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Invested</span>
              <span className="text-gray-900">{loading ? "..." : invested}</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Cash</span>
              <span className="text-gray-900">{loading ? "..." : cash}</span>
            </div>
            <div className="flex justify-between text-sm mb-3">
              <span className="text-gray-600">Alternatives</span>
              <span className="text-gray-900">{loading ? "..." : alternatives}</span>
            </div>
            <Progress value={loading ? 0 : investedPercent} className="h-2" />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-8 bg-white border-gray-200 shadow-sm">
          <h3 className="text-lg font-normal text-gray-900 mb-6">Asset Allocation</h3>
          {loading ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-gray-500">
              Loading allocation...
            </div>
          ) : (
            <div className="space-y-4">
              {allocationData.map((asset) => (
                <div key={asset.name} className="space-y-2">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block size-2.5 rounded-full"
                        style={{ backgroundColor: asset.color }}
                      />
                      <span className="text-gray-700">{asset.name}</span>
                    </div>
                    <span className="text-gray-900">{asset.value}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${asset.value}%`, backgroundColor: asset.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <h3 className="text-lg font-normal text-gray-900">Categories</h3>
          <div className="grid grid-cols-1 gap-4">
            {(loading ? Array.from({ length: 4 }) : allocationData).map((asset, index) => (
              <Card
                key={loading ? index : asset.name}
                className="p-4 bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow"
              >
                {loading ? (
                  <div className="space-y-2">
                    <div className="h-4 w-32 rounded bg-gray-100" />
                    <div className="h-6 w-24 rounded bg-gray-100" />
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block size-2.5 rounded-full"
                          style={{ backgroundColor: asset.color }}
                        />
                        <p className="text-sm text-gray-600">{asset.name}</p>
                      </div>
                      <p className="text-lg font-normal text-gray-900 mt-1">
                        {asset.value}% of assets
                      </p>
                    </div>
                    <p className="text-sm font-medium text-gray-500">Allocation</p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </div>

      <DataCard className="p-0 bg-white border-gray-200 shadow-sm">
        <div className="p-8">
          <h3 className="text-lg font-normal text-gray-900 mb-6">Portfolio Summary</h3>
          <div className="space-y-3">
            {(loading ? Array.from({ length: 4 }) : cards).map((card, index) => (
              <div
                key={loading ? index : card.label}
                className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4"
              >
                {loading ? (
                  <div className="grid w-full gap-2">
                    <div className="h-4 w-24 rounded bg-gray-100" />
                    <div className="h-5 w-32 rounded bg-gray-100" />
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">{card.label}</p>
                      <p className="text-base font-medium text-gray-900">
                        {formatCurrency(preferredCurrency, convertFromThb(card.amount ?? 0))}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500 mb-1">Status</p>
                      <p className="text-sm text-gray-900">{card.delta}</p>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </DataCard>
    </PageContainer>
  );
}
