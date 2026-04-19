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
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { AddStockDialog } from "../components/AddStockDialog";
import {
  DataCard,
  PageContainer,
  PageHeader,
  SummaryCard,
  SummaryGrid,
} from "../components/layout/index";
import {
  Candlestick,
  getStockHoldings,
  getStockSummary,
  getStockTransactions,
  StockLotView,
  StockPositionView,
  StockSummary,
  StockTransactionView,
} from "../api";

type MarketKey = "us" | "thai";
type TransactionFilter = "all" | "BUY" | "SELL" | "DIVIDEND";

interface MarketSnapshot {
  summary: StockSummary | null;
  holdings: StockPositionView[];
  transactions: StockTransactionView[];
}

const EMPTY_MARKET: MarketSnapshot = {
  summary: null,
  holdings: [],
  transactions: [],
};

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

function formatOptionalMoney(currency: string, amount: number | null, maximumFractionDigits = 2) {
  if (amount == null) {
    return "—";
  }
  return formatMoney(currency, amount, maximumFractionDigits);
}

function formatOptionalNumber(value: number | null, maximumFractionDigits = 4) {
  if (value == null) {
    return "—";
  }
  return value.toLocaleString("en-US", { maximumFractionDigits });
}

function emptySummary(market: MarketKey): StockSummary {
  return {
    market,
    title: market === "us" ? "US Stock" : "Thai Stock",
    currency: market === "us" ? "USD" : "THB",
    totalValue: 0,
    dayChange: 0,
    dayChangePct: 0,
    totalChange: 0,
    totalChangePct: 0,
    series: [0, 0, 0, 0, 0, 0],
    candlesticks: [],
  };
}

function buildChartData(series: number[], candlesticks: Candlestick[]) {
  return series.map((value, index) => ({
    date: candlesticks[index]?.time ?? `P${index + 1}`,
    value,
  }));
}

function averageCost(position: StockPositionView) {
  const totalCost = position.value - position.totalChange;
  return position.quantity > 0 ? totalCost / position.quantity : 0;
}

function transactionUnits(transaction: StockTransactionView) {
  return transaction.quantity ?? transaction.unitsEntitled ?? 0;
}

function transactionPrice(transaction: StockTransactionView) {
  return transaction.pricePerUnit ?? transaction.dividendPerShare;
}

function transactionNetAmount(transaction: StockTransactionView) {
  return transaction.transactionType === "DIVIDEND" ? transaction.netDividend : transaction.totalUsd;
}

function transactionTypeLabel(transactionType: string) {
  switch (transactionType) {
    case "BUY":
      return "Buy";
    case "SELL":
      return "Sell";
    case "DIVIDEND":
      return "Div";
    default:
      return transactionType;
  }
}

export function Stocks() {
  const [market, setMarket] = useState<MarketKey>("us");
  const [transactionFilter, setTransactionFilter] = useState<TransactionFilter>("all");
  const [sortByDay, setSortByDay] = useState(false);
  const [expandedStock, setExpandedStock] = useState<string | null>(null);
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [marketState, setMarketState] = useState<Record<MarketKey, MarketSnapshot>>({
    us: EMPTY_MARKET,
    thai: EMPTY_MARKET,
  });
  const [loadingState, setLoadingState] = useState<Record<MarketKey, boolean>>({
    us: false,
    thai: false,
  });
  const [marketError, setMarketError] = useState("");

  const loadMarket = useCallback(
    async (marketKey: MarketKey) => {
      setLoadingState((current) => ({ ...current, [marketKey]: true }));
      setMarketError("");
      try {
        const [summary, holdings, transactions] = await Promise.all([
          getStockSummary(marketKey),
          getStockHoldings(marketKey, sortByDay),
          getStockTransactions(marketKey),
        ]);
        setMarketState((current) => ({
          ...current,
          [marketKey]: {
            summary,
            holdings,
            transactions,
          },
        }));
      } catch (requestError) {
        setMarketError(
          requestError instanceof Error
            ? requestError.message
            : `Unable to load ${marketKey} stock data.`,
        );
      } finally {
        setLoadingState((current) => ({ ...current, [marketKey]: false }));
      }
    },
    [sortByDay],
  );

  useEffect(() => {
    loadMarket(market);
  }, [loadMarket, market]);

  useEffect(() => {
    setTransactionFilter("all");
    setExpandedStock(null);
  }, [market]);

  const currentSnapshot = marketState[market];
  const loading = loadingState[market];
  const currentSummary = currentSnapshot.summary ?? emptySummary(market);
  const currentHoldings = currentSnapshot.holdings;
  const currentTransactions = currentSnapshot.transactions;
  const currentCurrency = currentSummary.currency;
  const chartData = useMemo(
    () => buildChartData(currentSummary.series ?? [], currentSummary.candlesticks ?? []),
    [currentSummary],
  );

  const filteredTransactions = useMemo(() => {
    if (transactionFilter === "all") {
      return currentTransactions;
    }
    return currentTransactions.filter(
      (transaction) => transaction.transactionType === transactionFilter,
    );
  }, [currentTransactions, transactionFilter]);

  const transactionCounts = useMemo(
    () => ({
      all: currentTransactions.length,
      BUY: currentTransactions.filter((transaction) => transaction.transactionType === "BUY").length,
      SELL: currentTransactions.filter((transaction) => transaction.transactionType === "SELL").length,
      DIVIDEND: currentTransactions.filter((transaction) => transaction.transactionType === "DIVIDEND").length,
    }),
    [currentTransactions],
  );

  const portfolioValue = currentSummary.totalValue;
  const totalCost = currentHoldings.reduce(
    (sum, position) => sum + (position.value - position.totalChange),
    0,
  );
  const totalGainLoss = currentHoldings.reduce((sum, position) => sum + position.totalChange, 0);
  const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;
  const isPositive = totalGainLoss >= 0;

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
        <Button variant="outline" size="sm" onClick={() => setSortByDay((current) => !current)}>
          Sort by day % {sortByDay ? "on" : "off"}
        </Button>
        <Button size="sm" onClick={() => setAddStockOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Transaction
        </Button>
      </PageHeader>

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
              value={loading ? "Loading..." : formatMoney(currentCurrency, portfolioValue)}
            />
            <SummaryCard
              label="Total Cost"
              value={loading ? "Loading..." : formatMoney(currentCurrency, totalCost)}
            />
            <SummaryCard
              label="Total Gain/Loss"
              value={
                loading
                  ? "Loading..."
                  : `${isPositive ? "+" : "-"}${formatMoney(currentCurrency, Math.abs(totalGainLoss))}`
              }
              className={isPositive ? "text-green-600" : "text-red-600"}
            />
          </SummaryGrid>

          <DataCard className="border-gray-200 bg-white p-8 shadow-sm">
            <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-normal text-gray-900">{currentSummary.title}</h3>
                <p className="text-sm text-gray-500">
                  Portfolio performance is calculated from the saved buy, sell, and dividend ledger.
                </p>
              </div>
              {!loading ? (
                <p
                  className={
                    currentSummary.dayChange >= 0 ? "text-sm text-green-600" : "text-sm text-red-600"
                  }
                >
                  {currentSummary.dayChange >= 0 ? "+" : "-"}
                  {formatMoney(currentCurrency, Math.abs(currentSummary.dayChange))} (
                  {Math.abs(currentSummary.dayChangePct).toFixed(2)}%)
                </p>
              ) : null}
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
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

          <DataCard className="border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-200 p-6">
              <div>
                <h3 className="text-lg font-normal text-gray-900">Holdings</h3>
                <p className="text-sm text-gray-500">Open positions derived from FIFO lots.</p>
              </div>
              <Button size="sm" onClick={() => setAddStockOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Transaction
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-medium text-gray-600">Ticker</TableHead>
                    <TableHead className="font-medium text-gray-600">Company Name</TableHead>
                    <TableHead className="text-right font-medium text-gray-600">Quantity</TableHead>
                    <TableHead className="text-right font-medium text-gray-600">Avg Cost</TableHead>
                    <TableHead className="text-right font-medium text-gray-600">Current Price</TableHead>
                    <TableHead className="text-right font-medium text-gray-600">Total Value</TableHead>
                    <TableHead className="text-right font-medium text-gray-600">Gain/Loss</TableHead>
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
                              <span className={`font-medium ${stockPositive ? "text-green-600" : "text-red-600"}`}>
                                {stockPositive ? "+" : "-"}
                                {formatMoney(currentCurrency, Math.abs(stock.totalChange))}
                              </span>
                              <span className={`text-xs ${stockPositive ? "text-green-600" : "text-red-600"}`}>
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
                        {loading ? "Loading holdings..." : "No holdings recorded yet. Add your first transaction."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </DataCard>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-6">
          <div className="flex justify-end">
            <Button onClick={() => setAddStockOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Transaction
            </Button>
          </div>

          <DataCard className="border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 p-6">
              <h3 className="text-lg font-normal text-gray-900">Transaction Ledger</h3>
              <p className="mt-1 text-sm text-gray-500">
                Buys, sells, and dividends are stored as raw events. Everything else is derived by the backend.
              </p>
            </div>

            <Tabs
              value={transactionFilter}
              onValueChange={(value) => setTransactionFilter(value as TransactionFilter)}
              className="space-y-0"
            >
              <div className="border-b border-gray-200 px-6 py-4">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="all">All ({transactionCounts.all})</TabsTrigger>
                  <TabsTrigger value="BUY">Buy ({transactionCounts.BUY})</TabsTrigger>
                  <TabsTrigger value="SELL">Sell ({transactionCounts.SELL})</TabsTrigger>
                  <TabsTrigger value="DIVIDEND">Divs ({transactionCounts.DIVIDEND})</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value={transactionFilter} className="mt-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-medium text-gray-600">Date</TableHead>
                        <TableHead className="font-medium text-gray-600">Ticker</TableHead>
                        <TableHead className="font-medium text-gray-600">Type</TableHead>
                        <TableHead className="text-right font-medium text-gray-600">Units</TableHead>
                        <TableHead className="text-right font-medium text-gray-600">Price / Unit</TableHead>
                        <TableHead className="text-right font-medium text-gray-600">Fee USD</TableHead>
                        <TableHead className="text-right font-medium text-gray-600">Net Amount</TableHead>
                        <TableHead className="text-right font-medium text-gray-600">Realized P/L</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactions.length ? (
                        filteredTransactions.map((transaction) => (
                          <TableRow key={transaction.id} className="hover:bg-gray-50">
                            <TableCell className="text-gray-900">{transaction.date}</TableCell>
                            <TableCell className="font-medium text-gray-900">
                              <div className="flex flex-col">
                                <span>{transaction.symbol}</span>
                                <span className="text-xs text-gray-500">{transaction.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{transactionTypeLabel(transaction.transactionType)}</Badge>
                            </TableCell>
                            <TableCell className="text-right text-gray-900">
                              {formatOptionalNumber(transactionUnits(transaction))}
                            </TableCell>
                            <TableCell className="text-right text-gray-900">
                              {formatOptionalMoney(currentCurrency, transactionPrice(transaction))}
                            </TableCell>
                            <TableCell className="text-right text-gray-900">
                              {formatOptionalMoney("USD", transaction.feeNetUsd, 4)}
                            </TableCell>
                            <TableCell className="text-right text-gray-900">
                              <div className="flex flex-col items-end">
                                <span>{formatOptionalMoney(currentCurrency, transactionNetAmount(transaction))}</span>
                                {transaction.transactionType === "DIVIDEND" &&
                                transaction.withholdingTaxAmount != null ? (
                                  <span className="text-xs text-gray-500">
                                    WHT {formatOptionalMoney(currentCurrency, transaction.withholdingTaxAmount)}
                                  </span>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell
                              className={`text-right ${
                                (transaction.realizedPnl ?? 0) >= 0 ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              {transaction.realizedPnl == null
                                ? "—"
                                : `${transaction.realizedPnl >= 0 ? "+" : "-"}${formatMoney(
                                    currentCurrency,
                                    Math.abs(transaction.realizedPnl),
                                  )}`}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={8} className="py-10 text-center text-sm text-gray-500">
                            {loading
                              ? "Loading transactions..."
                              : "No transactions recorded for this section yet."}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </DataCard>
        </TabsContent>

        <TabsContent value="per-stock" className="space-y-6">
          <DataCard className="border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 p-6">
              <h3 className="text-lg font-normal text-gray-900">Grouped Positions</h3>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-12 font-medium text-gray-600"></TableHead>
                    <TableHead className="font-medium text-gray-600">Ticker</TableHead>
                    <TableHead className="text-right font-medium text-gray-600">Total Volume</TableHead>
                    <TableHead className="text-right font-medium text-gray-600">Avg Cost</TableHead>
                    <TableHead className="text-right font-medium text-gray-600">Current Price</TableHead>
                    <TableHead className="text-right font-medium text-gray-600">Total Value</TableHead>
                    <TableHead className="text-right font-medium text-gray-600">Gain/Loss</TableHead>
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
                            className="cursor-pointer hover:bg-gray-50"
                            onClick={() => setExpandedStock(expanded ? null : stock.symbol)}
                          >
                            <TableCell>
                              {expanded ? (
                                <ChevronUp className="h-4 w-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-gray-400" />
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
                                <h4 className="mb-4 text-sm font-medium text-gray-900">Open Lots</h4>
                                <div className="space-y-2">
                                  {stock.lots.map((lot: StockLotView) => (
                                    <div
                                      key={lot.id}
                                      className="grid gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-5"
                                    >
                                      <div>
                                        <p className="mb-1 text-xs text-gray-500">Purchase Date</p>
                                        <p className="text-sm text-gray-900">{lot.purchaseDate}</p>
                                      </div>
                                      <div>
                                        <p className="mb-1 text-xs text-gray-500">Quantity</p>
                                        <p className="text-sm text-gray-900">
                                          {lot.quantity.toLocaleString("en-US", {
                                            maximumFractionDigits: 4,
                                          })}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="mb-1 text-xs text-gray-500">Cost / Unit</p>
                                        <p className="text-sm text-gray-900">
                                          {formatMoney(currentCurrency, lot.purchasePrice)}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="mb-1 text-xs text-gray-500">Current Price</p>
                                        <p className="text-sm text-gray-900">
                                          {formatMoney(currentCurrency, lot.currentPrice)}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="mb-1 text-xs text-gray-500">Current Value</p>
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
        market={market}
        holdings={currentHoldings}
        open={addStockOpen}
        onOpenChange={setAddStockOpen}
        onCreated={async (symbol) => {
          setExpandedStock(symbol);
          await loadMarket(market);
        }}
      />
    </PageContainer>
  );
}
