import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";
import { PageContainer, DataCard } from "../components/layout/index";
import { AllocationItem, getAssetSummary, SummaryCard as SummaryCardType } from "../api";

function findCard(cards: SummaryCardType[], label: string, fallback = "THB 0") {
  return cards.find((card) => card.label === label)?.value ?? fallback;
}

export function TotalAssets() {
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

  const netWorth = findCard(cards, "Net Worth");
  const invested = findCard(cards, "Invested");
  const cash = findCard(cards, "Cash & Savings");
  const alternatives = findCard(cards, "Alternatives");
  const netWorthDelta = cards.find((card) => card.label === "Net Worth")?.delta ?? "Live priced";

  return (
    <PageContainer>
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm text-gray-500">Total Assets</p>
          <p className="text-xs text-gray-400">
            Backend totals are currently reported in THB.
          </p>
        </div>
        <Select value="THB" disabled>
          <SelectTrigger className="w-[140px] sm:w-[150px]">
            <SelectValue placeholder="Currency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="THB">THB (฿)</SelectItem>
          </SelectContent>
        </Select>
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
            Track and analyze your investments across multiple asset classes. The homepage
            summary is now loaded from the backend and reflects live-priced US equities plus
            stored balances for the other categories.
          </p>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <Button variant="default" size="sm">
              Overview
            </Button>
            <Button variant="outline" size="sm">
              Allocation
            </Button>
            <Button variant="outline" size="sm">
              Live Pricing
            </Button>
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
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={allocationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {allocationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value, entry: { payload?: { value?: number } }) => (
                    <span className="text-sm text-gray-600">
                      {value} ({entry.payload?.value ?? 0}%)
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
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
                      <p className="text-base font-medium text-gray-900">{card.value}</p>
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
