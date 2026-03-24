import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { AddStockDialog } from "../components/AddStockDialog";
import { PageContainer, PageHeader, SummaryCard, SummaryGrid, DataCard } from "../components/layout/index";
import {
  Candlestick,
  getStockHoldings,
  getStockSeed,
  getStockSummary,
  StockLotView,
  StockMarketSeed,
  StockPositionView,
  StockSummary,
} from "../api";

type MarketKey = "us" | "thai";

interface DisplayMarket {
  title: string;
  currency: string;
  value: number;
  dayChange: number;
  dayChangePct: number;
  totalChange: number;
  totalChangePct: number;
  series: number[];
  candlesticks: Candlestick[];
  holdings: StockPositionView[];
}

function normalizeSeedHolding(holding: StockMarketSeed["holdings"][number]): StockPositionView {
  const value = holding.price * holding.quantity;
  const dayGain = value * ((holding.dayChangePct ?? 0) / 100);
  return {
    symbol: holding.symbol,
    name: holding.name,
    market: holding.market,
    type: holding.type,
    currency: holding.currency,
    price: holding.price,
    quantity: holding.quantity,
    dayGain,
    dayChangePct: holding.dayChangePct,
    value,
    totalChange: (holding.price - holding.avgCost) * holding.quantity,
    totalChangePct: holding.avgCost
      ? ((holding.price - holding.avgCost) / holding.avgCost) * 100
      : 0,
    lots: [
      {
        id: `${holding.symbol}-seed`,
        purchaseDate: "Read-only seed",
        purchasePrice: holding.avgCost,
        quantity: holding.quantity,
        currentPrice: holding.price,
        dayGain,
        dayChangePct: holding.dayChangePct,
        value,
      },
    ],
  };
}

function symbolForCurrency(currency: string) {
  return (
    {
      USD: "$",
      THB: "฿",
      EUR: "€",
      GBP: "£",
      JPY: "¥",
    }[currency] ?? currency
  );
}

function formatMoney(currency: string, amount: number, maximumFractionDigits = 2) {
  return `${symbolForCurrency(currency)}${amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  })}`;
}

function buildChartData(series: number[], candlesticks: Candlestick[]) {
  return series.map((value, index) => ({
    date: candlesticks[index]?.time ?? `P${index + 1}`,
    value,
  }));
}

function lotSortValue(date: string) {
  const timestamp = Date.parse(date);
  return Number.isNaN(timestamp) ? Number.MIN_SAFE_INTEGER : timestamp;
}

function buildTransactions(holdings: StockPositionView[]) {
  return holdings
    .flatMap((position) =>
      position.lots.map((lot) => ({
        id: lot.id,
        date: lot.purchaseDate,
        ticker: position.symbol,
        type: position.type,
        units: lot.quantity,
        purchasePrice: lot.purchasePrice,
        currentPrice: lot.currentPrice,
        dayGain: lot.dayGain,
        currentValue: lot.value,
      })),
    )
    .sort((left, right) => lotSortValue(right.date) - lotSortValue(left.date));
}

function averageCost(position: StockPositionView) {
  const totalCost = position.value - position.totalChange;
  return position.quantity > 0 ? totalCost / position.quantity : 0;
}

export function Stocks() {
  const [market, setMarket] = useState<MarketKey>("us");
  const [seedData, setSeedData] = useState<{ thai: StockMarketSeed; us: StockMarketSeed } | null>(
    null,
  );
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState("");
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState("");
  const [sortByDay, setSortByDay] = useState(false);
  const [usSummary, setUsSummary] = useState<StockSummary | null>(null);
  const [usHoldings, setUsHoldings] = useState<StockPositionView[]>([]);
  const [expandedStock, setExpandedStock] = useState<string | null>(null);
  const [addStockOpen, setAddStockOpen] = useState(false);

  const loadSeeds = useCallback(async () => {
    setMetaLoading(true);
    setMetaError("");
    try {
      const [thai, us] = await Promise.all([getStockSeed("thai"), getStockSeed("us")]);
      setSeedData({ thai, us });
    } catch (requestError) {
      setMetaError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load stock market data.",
      );
    } finally {
      setMetaLoading(false);
    }
  }, []);

  const loadUsMarket = useCallback(async () => {
    setMarketLoading(true);
    setMarketError("");
    try {
      const [summary, holdings] = await Promise.all([
        getStockSummary("us"),
        getStockHoldings("us", sortByDay),
      ]);
      setUsSummary(summary);
      setUsHoldings(holdings);
    } catch (requestError) {
      setMarketError(
        requestError instanceof Error ? requestError.message : "Unable to load US market data.",
      );
    } finally {
      setMarketLoading(false);
    }
  }, [sortByDay]);

  useEffect(() => {
    loadSeeds();
  }, [loadSeeds]);

  useEffect(() => {
    if (market === "us") {
      loadUsMarket();
    }
  }, [market, loadUsMarket]);

  const thaiMarket = useMemo<DisplayMarket | null>(() => {
    if (!seedData?.thai) {
      return null;
    }
    return {
      title: seedData.thai.title,
      currency: seedData.thai.currency,
      value: seedData.thai.value,
      dayChange: seedData.thai.dayChange,
      dayChangePct: seedData.thai.dayChangePct,
      totalChange: seedData.thai.totalChange,
      totalChangePct: seedData.thai.totalChangePct,
      series: seedData.thai.series,
      candlesticks: seedData.thai.candlesticks,
      holdings: (seedData.thai.holdings ?? []).map(normalizeSeedHolding),
    };
  }, [seedData]);

  const usMarket = useMemo<DisplayMarket | null>(() => {
    if (!seedData?.us) {
      return null;
    }
    return {
      title: usSummary?.title ?? seedData.us.title,
      currency: usSummary?.currency ?? seedData.us.currency,
      value: usSummary?.totalValue ?? seedData.us.value,
      dayChange: usSummary?.dayChange ?? seedData.us.dayChange,
      dayChangePct: usSummary?.dayChangePct ?? seedData.us.dayChangePct,
      totalChange: usSummary?.totalChange ?? seedData.us.totalChange,
      totalChangePct: usSummary?.totalChangePct ?? seedData.us.totalChangePct,
      series: usSummary?.series?.length ? usSummary.series : seedData.us.series,
      candlesticks: usSummary?.candlesticks?.length ? usSummary.candlesticks : seedData.us.candlesticks,
      holdings: usHoldings,
    };
  }, [seedData, usSummary, usHoldings]);

  const currentMarket = market === "us" ? usMarket : thaiMarket;
  const currentHoldings = currentMarket?.holdings ?? [];
  const currentCurrency = currentMarket?.currency ?? (market === "us" ? "USD" : "THB");
  const chartData = useMemo(
    () => buildChartData(currentMarket?.series ?? [], currentMarket?.candlesticks ?? []),
    [currentMarket],
  );
  const transactions = useMemo(() => buildTransactions(currentHoldings), [currentHoldings]);

  const portfolioValue = currentMarket?.value ?? 0;
  const totalCost = currentHoldings.reduce((sum, position) => sum + (position.value - position.totalChange), 0);
  const totalGainLoss = currentHoldings.reduce((sum, position) => sum + position.totalChange, 0);
  const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;
  const isPositive = totalGainLoss >= 0;
  const readOnly = market === "thai";

  return (
    <PageContainer>
      <PageHeader title="Stocks">
        <Select value={market} onValueChange={(value) => setMarket(value as MarketKey)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="us">US Market</SelectItem>
            <SelectItem value="thai">Thai Market</SelectItem>
          </SelectContent>
        </Select>
        {market === "us" ? (
          <>
            <Button variant="outline" size="sm" onClick={() => setSortByDay((current) => !current)}>
              Sort by day % {sortByDay ? "on" : "off"}
            </Button>
            <Button size="sm" onClick={() => setAddStockOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Investment
            </Button>
          </>
        ) : (
          <Badge variant="outline">Thai market is read-only for now</Badge>
        )}
      </PageHeader>

      {metaError ? (
        <Card className="border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {metaError}
        </Card>
      ) : null}
      {marketError ? (
        <Card className="border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {marketError}
        </Card>
      ) : null}

      <Tabs defaultValue="overview" className="space-y-4 sm:space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="per-stock">Per Stock</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <SummaryGrid>
            <SummaryCard
              label="Portfolio Value"
              value={metaLoading || marketLoading ? "Loading..." : formatMoney(currentCurrency, portfolioValue)}
            />
            <SummaryCard
              label="Total Cost"
              value={metaLoading || marketLoading ? "Loading..." : formatMoney(currentCurrency, totalCost)}
            />
            <SummaryCard
              label="Total Gain/Loss"
              value={
                metaLoading || marketLoading
                  ? "Loading..."
                  : `${isPositive ? "+" : "-"}${formatMoney(currentCurrency, Math.abs(totalGainLoss))}`
              }
              className={isPositive ? "text-green-600" : "text-red-600"}
            />
          </SummaryGrid>

          <DataCard className="p-8 bg-white border-gray-200 shadow-sm">
            <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-normal text-gray-900">
                  {currentMarket?.title ?? "Portfolio Performance"}
                </h3>
                <p className="text-sm text-gray-500">
                  {readOnly
                    ? "Thai market seed data is visible in read-only mode."
                    : "US holdings are aggregated from saved lots and live pricing."}
                </p>
              </div>
              {!metaLoading && !marketLoading && currentMarket ? (
                <p className={currentMarket.dayChange >= 0 ? "text-sm text-green-600" : "text-sm text-red-600"}>
                  {currentMarket.dayChange >= 0 ? "+" : "-"}
                  {formatMoney(currentCurrency, Math.abs(currentMarket.dayChange))} (
                  {Math.abs(currentMarket.dayChangePct).toFixed(2)}%)
                </p>
              ) : null}
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <XAxis
                  dataKey="date"
                  stroke="#9ca3af"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#9ca3af"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => formatMoney(currentCurrency, value, 0)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [formatMoney(currentCurrency, value), "Value"]}
                />
                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </DataCard>

          <DataCard className="bg-white border-gray-200 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-200 p-6">
              <h3 className="text-lg font-normal text-gray-900">Holdings</h3>
              {!readOnly ? (
                <Button size="sm" onClick={() => setAddStockOpen(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add Investment
                </Button>
              ) : null}
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-medium text-gray-600">Ticker</TableHead>
                    <TableHead className="font-medium text-gray-600">Company Name</TableHead>
                    <TableHead className="font-medium text-gray-600 text-right">Quantity</TableHead>
                    <TableHead className="font-medium text-gray-600 text-right">Avg Cost</TableHead>
                    <TableHead className="font-medium text-gray-600 text-right">Current Price</TableHead>
                    <TableHead className="font-medium text-gray-600 text-right">Total Value</TableHead>
                    <TableHead className="font-medium text-gray-600 text-right">Gain/Loss</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentHoldings.length ? (
                    currentHoldings.map((stock) => {
                      const avgCost = averageCost(stock);
                      const stockPositive = stock.totalChange >= 0;
                      return (
                        <TableRow key={stock.symbol} className="hover:bg-gray-50">
                          <TableCell className="font-medium text-gray-900">{stock.symbol}</TableCell>
                          <TableCell className="text-gray-600">{stock.name}</TableCell>
                          <TableCell className="text-right text-gray-900">
                            {stock.quantity.toLocaleString("en-US", { maximumFractionDigits: 4 })}
                          </TableCell>
                          <TableCell className="text-right text-gray-900">
                            {formatMoney(currentCurrency, avgCost)}
                          </TableCell>
                          <TableCell className="text-right text-gray-900">
                            {formatMoney(currentCurrency, stock.price)}
                          </TableCell>
                          <TableCell className="text-right text-gray-900">
                            {formatMoney(currentCurrency, stock.value)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end">
                              <span
                                className={`font-medium ${
                                  stockPositive ? "text-green-600" : "text-red-600"
                                }`}
                              >
                                {stockPositive ? "+" : "-"}
                                {formatMoney(currentCurrency, Math.abs(stock.totalChange))}
                              </span>
                              <span
                                className={`text-xs ${
                                  stockPositive ? "text-green-600" : "text-red-600"
                                }`}
                              >
                                ({stockPositive ? "+" : "-"}
                                {Math.abs(stock.totalChangePct).toFixed(2)}%)
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-gray-500">
                        {metaLoading || marketLoading
                          ? "Loading holdings..."
                          : readOnly
                            ? "No Thai holdings available."
                            : "No US holdings yet. Add your first investment."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </DataCard>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-6">
          {!readOnly ? (
            <div className="flex justify-end">
              <Button onClick={() => setAddStockOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Add Investment
              </Button>
            </div>
          ) : null}

          <DataCard className="bg-white border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-normal text-gray-900">Purchase History</h3>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-medium text-gray-600">Date</TableHead>
                    <TableHead className="font-medium text-gray-600">Ticker</TableHead>
                    <TableHead className="font-medium text-gray-600">Type</TableHead>
                    <TableHead className="font-medium text-gray-600 text-right">Units</TableHead>
                    <TableHead className="font-medium text-gray-600 text-right">Purchase Price</TableHead>
                    <TableHead className="font-medium text-gray-600 text-right">Current Price</TableHead>
                    <TableHead className="font-medium text-gray-600 text-right">Day Gain</TableHead>
                    <TableHead className="font-medium text-gray-600 text-right">Current Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length ? (
                    transactions.map((transaction) => (
                      <TableRow key={transaction.id} className="hover:bg-gray-50">
                        <TableCell className="text-gray-900">{transaction.date}</TableCell>
                        <TableCell className="font-medium text-gray-900">{transaction.ticker}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{transaction.type}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-gray-900">
                          {transaction.units.toLocaleString("en-US", { maximumFractionDigits: 4 })}
                        </TableCell>
                        <TableCell className="text-right text-gray-900">
                          {formatMoney(currentCurrency, transaction.purchasePrice)}
                        </TableCell>
                        <TableCell className="text-right text-gray-900">
                          {formatMoney(currentCurrency, transaction.currentPrice)}
                        </TableCell>
                        <TableCell
                          className={`text-right ${
                            transaction.dayGain >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {transaction.dayGain >= 0 ? "+" : "-"}
                          {formatMoney(currentCurrency, Math.abs(transaction.dayGain))}
                        </TableCell>
                        <TableCell className="text-right text-gray-900">
                          {formatMoney(currentCurrency, transaction.currentValue)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-sm text-gray-500">
                        No purchase history available.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </DataCard>
        </TabsContent>

        <TabsContent value="per-stock" className="space-y-6">
          <DataCard className="bg-white border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-normal text-gray-900">Grouped Positions</h3>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-medium text-gray-600 w-12"></TableHead>
                    <TableHead className="font-medium text-gray-600">Ticker</TableHead>
                    <TableHead className="font-medium text-gray-600 text-right">Total Volume</TableHead>
                    <TableHead className="font-medium text-gray-600 text-right">Avg Cost</TableHead>
                    <TableHead className="font-medium text-gray-600 text-right">Current Price</TableHead>
                    <TableHead className="font-medium text-gray-600 text-right">Total Value</TableHead>
                    <TableHead className="font-medium text-gray-600 text-right">Gain/Loss</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentHoldings.length ? (
                    currentHoldings.map((stock) => {
                      const expanded = expandedStock === stock.symbol;
                      const avgCost = averageCost(stock);
                      return (
                        <Fragment key={stock.symbol}>
                          <TableRow
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() =>
                              setExpandedStock(expanded ? null : stock.symbol)
                            }
                          >
                            <TableCell>
                              {expanded ? (
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              )}
                            </TableCell>
                            <TableCell className="font-medium text-gray-900">{stock.symbol}</TableCell>
                            <TableCell className="text-right text-gray-900">
                              {stock.quantity.toLocaleString("en-US", { maximumFractionDigits: 4 })}
                            </TableCell>
                            <TableCell className="text-right text-gray-900">
                              {formatMoney(currentCurrency, avgCost)}
                            </TableCell>
                            <TableCell className="text-right text-gray-900">
                              {formatMoney(currentCurrency, stock.price)}
                            </TableCell>
                            <TableCell className="text-right text-gray-900">
                              {formatMoney(currentCurrency, stock.value)}
                            </TableCell>
                            <TableCell
                              className={`text-right ${
                                stock.totalChange >= 0 ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              {stock.totalChange >= 0 ? "+" : "-"}
                              {formatMoney(currentCurrency, Math.abs(stock.totalChange))} (
                              {Math.abs(stock.totalChangePct).toFixed(2)}%)
                            </TableCell>
                          </TableRow>
                          {expanded ? (
                            <TableRow>
                              <TableCell colSpan={7} className="bg-gray-50 p-6">
                                <h4 className="mb-4 text-sm font-medium text-gray-900">Lots</h4>
                                <div className="space-y-2">
                                  {stock.lots.map((lot: StockLotView) => (
                                    <div
                                      key={lot.id}
                                      className="grid gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-5"
                                    >
                                      <div>
                                        <p className="text-xs text-gray-500 mb-1">Purchase Date</p>
                                        <p className="text-sm text-gray-900">{lot.purchaseDate}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-500 mb-1">Quantity</p>
                                        <p className="text-sm text-gray-900">
                                          {lot.quantity.toLocaleString("en-US", {
                                            maximumFractionDigits: 4,
                                          })}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-500 mb-1">Purchase Price</p>
                                        <p className="text-sm text-gray-900">
                                          {formatMoney(currentCurrency, lot.purchasePrice)}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-500 mb-1">Current Price</p>
                                        <p className="text-sm text-gray-900">
                                          {formatMoney(currentCurrency, lot.currentPrice)}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-500 mb-1">Current Value</p>
                                        <p className="text-sm text-gray-900">
                                          {formatMoney(currentCurrency, lot.value)}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </Fragment>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-gray-500">
                        No grouped positions available.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </DataCard>
        </TabsContent>
      </Tabs>

      <AddStockDialog
        open={addStockOpen}
        onOpenChange={setAddStockOpen}
        onCreated={async (symbol) => {
          setExpandedStock(symbol);
          await loadUsMarket();
        }}
      />
    </PageContainer>
  );
}
