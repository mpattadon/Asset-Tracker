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
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { AddStockDialog } from "../components/AddStockDialog";
import { AddPortfolioDialog } from "../components/AddPortfolioDialog";
import { DeletePortfolioDialog } from "../components/DeletePortfolioDialog";
import { StockSearchPanel } from "../components/stocks/StockSearchPanel";
import { TradingViewChart } from "../components/charts/TradingViewChart";
import { useAuth } from "../auth";
import {
  DataCard,
  PageContainer,
  PageHeader,
  SummaryCard,
  SummaryGrid,
} from "../components/layout/index";
import {
  Candlestick,
  createStockPortfolio,
  deleteStockPortfolio,
  getPortfolioStockHoldings,
  getPortfolioStockSummary,
  getPortfolioStockTransactions,
  getStockPortfolios,
  StockLotView,
  StockPortfolio,
  StockPositionView,
  StockSummary,
  StockTransactionView,
} from "../api";

type TransactionFilter = "all" | "BUY" | "SELL" | "DIVIDEND";

function symbolForCurrency(currency: string) {
  if (currency === "MIXED") {
    return "";
  }
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
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
  const symbol = symbolForCurrency(currency);
  return symbol ? `${symbol}${formatted}` : formatted;
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

function buildChartData(series: number[], candlesticks: Candlestick[]) {
  return series.map((value, index) => ({
    time: candlesticks[index]?.time ?? `2026-01-${String(index + 1).padStart(2, "0")}`,
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

function portfolioDisplayName(_portfolio: StockPortfolio, index: number) {
  return _portfolio.name?.trim() || `Portfolio ${index + 1}`;
}

export function Stocks() {
  const { authState } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [transactionFilter, setTransactionFilter] = useState<TransactionFilter>("all");
  const [sortByDay, setSortByDay] = useState(false);
  const [expandedStock, setExpandedStock] = useState<string | null>(null);
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState("all");
  const [portfolios, setPortfolios] = useState<StockPortfolio[]>([]);
  const [summary, setSummary] = useState<StockSummary | null>(null);
  const [holdings, setHoldings] = useState<StockPositionView[]>([]);
  const [transactions, setTransactions] = useState<StockTransactionView[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatingPortfolio, setCreatingPortfolio] = useState(false);
  const [deletingPortfolio, setDeletingPortfolio] = useState(false);
  const [addPortfolioOpen, setAddPortfolioOpen] = useState(false);
  const [deletePortfolioOpen, setDeletePortfolioOpen] = useState(false);
  const [loadError, setLoadError] = useState("");

  const loadPortfolios = useCallback(async () => {
    const next = await getStockPortfolios();
    setPortfolios(next);
    return next;
  }, []);

  const loadCurrent = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [nextSummary, nextHoldings, nextTransactions] = await Promise.all([
        getPortfolioStockSummary(selectedPortfolioId),
        getPortfolioStockHoldings(selectedPortfolioId, sortByDay),
        getPortfolioStockTransactions(selectedPortfolioId),
      ]);
      setSummary(nextSummary);
      setHoldings(nextHoldings);
      setTransactions(nextTransactions);
    } catch (requestError) {
      setLoadError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load stock portfolio data.",
      );
    } finally {
      setLoading(false);
    }
  }, [selectedPortfolioId, sortByDay]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const nextPortfolios = await loadPortfolios();
        if (cancelled) {
          return;
        }
        if (
          selectedPortfolioId !== "all" &&
          !nextPortfolios.some((portfolio) => portfolio.id === selectedPortfolioId)
        ) {
          setSelectedPortfolioId("all");
        }
      } catch (requestError) {
        if (!cancelled) {
          setLoadError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load stock portfolios.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPortfolios, selectedPortfolioId]);

  useEffect(() => {
    loadCurrent();
  }, [loadCurrent]);

  useEffect(() => {
    setTransactionFilter("all");
    setExpandedStock(null);
  }, [selectedPortfolioId]);

  const selectedPortfolio = useMemo(
    () => portfolios.find((portfolio) => portfolio.id === selectedPortfolioId) ?? null,
    [portfolios, selectedPortfolioId],
  );

  const selectedPortfolioLabel = useMemo(() => {
    if (!selectedPortfolio) {
      return "All";
    }
    const index = portfolios.findIndex((portfolio) => portfolio.id === selectedPortfolio.id);
    return portfolioDisplayName(selectedPortfolio, index >= 0 ? index : 0);
  }, [portfolios, selectedPortfolio]);

  const currentSummary =
    summary ??
    ({
      market: selectedPortfolioId,
      title: selectedPortfolio ? selectedPortfolioLabel : "All Portfolios",
      currency: "USD",
      totalValue: 0,
      dayChange: 0,
      dayChangePct: 0,
      totalChange: 0,
      totalChangePct: 0,
      series: [0, 0, 0, 0, 0, 0],
      candlesticks: [],
    } satisfies StockSummary);
  const currentCurrency = currentSummary.currency || "USD";
  const chartData = useMemo(
    () => buildChartData(currentSummary.series ?? [], currentSummary.candlesticks ?? []),
    [currentSummary],
  );

  const filteredTransactions = useMemo(() => {
    if (transactionFilter === "all") {
      return transactions;
    }
    return transactions.filter((transaction) => transaction.transactionType === transactionFilter);
  }, [transactions, transactionFilter]);

  const transactionCounts = useMemo(
    () => ({
      all: transactions.length,
      BUY: transactions.filter((transaction) => transaction.transactionType === "BUY").length,
      SELL: transactions.filter((transaction) => transaction.transactionType === "SELL").length,
      DIVIDEND: transactions.filter((transaction) => transaction.transactionType === "DIVIDEND").length,
    }),
    [transactions],
  );

  const totalCost = holdings.reduce((sum, position) => sum + (position.value - position.totalChange), 0);
  const totalGainLoss = holdings.reduce((sum, position) => sum + position.totalChange, 0);
  const isPositive = totalGainLoss >= 0;
  const canRecordTransaction = Boolean(authState?.authenticated) && selectedPortfolioId !== "all";
  const canCreatePortfolio = Boolean(authState?.authenticated);
  const canDeletePortfolio = Boolean(authState?.authenticated) && selectedPortfolioId !== "all" && Boolean(selectedPortfolio);

  const handleCreatePortfolio = async (payload: { name: string; currency: string }) => {
    setCreatingPortfolio(true);
    setLoadError("");
    try {
      const created = await createStockPortfolio(payload);
      const next = await loadPortfolios();
      const resolved = next.find((portfolio) => portfolio.id === created.id);
      setSelectedPortfolioId(resolved?.id ?? created.id);
      setAddPortfolioOpen(false);
    } catch (requestError) {
      setLoadError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to create a new portfolio.",
      );
    } finally {
      setCreatingPortfolio(false);
    }
  };

  const handleDeletePortfolio = async () => {
    if (!selectedPortfolio || selectedPortfolioId === "all") {
      return;
    }
    setDeletingPortfolio(true);
    setLoadError("");
    try {
      await deleteStockPortfolio(selectedPortfolio.id);
      setDeletePortfolioOpen(false);
      setSelectedPortfolioId("all");
      await loadPortfolios();
    } catch (requestError) {
      setLoadError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to delete this portfolio.",
      );
    } finally {
      setDeletingPortfolio(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader title="Stocks" />

      {!authState?.authenticated ? (
        <Card className="border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Search charts and inspect market data while signed out. Login is required before creating portfolios or recording transactions.
        </Card>
      ) : null}

      {loadError ? (
        <Card className="border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </Card>
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="per-stock">Per Stock</TabsTrigger>
            <TabsTrigger value="search">Search A Stock</TabsTrigger>
          </TabsList>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeletePortfolioOpen(true)}
              disabled={!canDeletePortfolio || deletingPortfolio}
            >
              {deletingPortfolio ? "Deleting..." : "Delete Portfolio"}
            </Button>
            <Select value={selectedPortfolioId} onValueChange={setSelectedPortfolioId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {portfolios.map((portfolio, index) => (
                  <SelectItem key={portfolio.id} value={portfolio.id}>
                    {portfolioDisplayName(portfolio, index)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAddPortfolioOpen(true)}
              disabled={creatingPortfolio || !canCreatePortfolio}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              {creatingPortfolio ? "Adding..." : !canCreatePortfolio ? "Login to Add Portfolio" : "Add Portfolio"}
            </Button>
          </div>
        </div>

        <TabsContent value="overview" className="space-y-6">
          <SummaryGrid>
            <SummaryCard
              label="Portfolio Value"
              value={loading ? "Loading..." : formatMoney(currentCurrency, currentSummary.totalValue)}
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
            <TradingViewChart
              height={250}
              mode="line"
              currency={currentCurrency}
              lineData={chartData}
            />
          </DataCard>

          <DataCard className="border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-gray-200 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-normal text-gray-900">Holdings</h3>
                <p className="text-sm text-gray-500">Open positions derived from FIFO lots.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" size="sm" onClick={() => setSortByDay((current) => !current)}>
                  Sort by day % {sortByDay ? "on" : "off"}
                </Button>
                <Button
                  size="sm"
                  onClick={() => setAddStockOpen(true)}
                  className="gap-2"
                  disabled={!canRecordTransaction}
                >
                  <Plus className="h-4 w-4" />
                  {authState?.authenticated ? "Add Transaction" : "Login to Add Transaction"}
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-medium text-gray-600">Ticker</TableHead>
                    <TableHead className="font-medium text-gray-600">Company Name</TableHead>
                    <TableHead className="font-medium text-gray-600">Market</TableHead>
                    <TableHead className="text-right font-medium text-gray-600">Quantity</TableHead>
                    <TableHead className="text-right font-medium text-gray-600">Avg Cost</TableHead>
                    <TableHead className="text-right font-medium text-gray-600">Current Price</TableHead>
                    <TableHead className="text-right font-medium text-gray-600">Total Value</TableHead>
                    <TableHead className="text-right font-medium text-gray-600">Gain/Loss</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holdings.length ? (
                    holdings.map((stock) => {
                      const avgCost = averageCost(stock);
                      const stockPositive = stock.totalChange >= 0;
                      return (
                        <TableRow key={`${stock.market}:${stock.symbol}`} className="hover:bg-gray-50">
                          <TableCell className="font-medium text-gray-900">{stock.symbol}</TableCell>
                          <TableCell className="text-gray-600">{stock.name}</TableCell>
                          <TableCell className="text-gray-600">{stock.market}</TableCell>
                          <TableCell className="text-right text-gray-900">
                            {stock.quantity.toLocaleString("en-US", { maximumFractionDigits: 4 })}
                          </TableCell>
                          <TableCell className="text-right text-gray-900">
                            {formatMoney(stock.currency, avgCost)}
                          </TableCell>
                          <TableCell className="text-right text-gray-900">
                            {formatMoney(stock.currency, stock.price)}
                          </TableCell>
                          <TableCell className="text-right text-gray-900">
                            {formatMoney(stock.currency, stock.value)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end">
                              <span className={`font-medium ${stockPositive ? "text-green-600" : "text-red-600"}`}>
                                {stockPositive ? "+" : "-"}
                                {formatMoney(stock.currency, Math.abs(stock.totalChange))}
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
                      <TableCell colSpan={8} className="py-10 text-center text-sm text-gray-500">
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
            <Button onClick={() => setAddStockOpen(true)} className="gap-2" disabled={!canRecordTransaction}>
              <Plus className="h-4 w-4" />
              {authState?.authenticated ? "Add Transaction" : "Login to Add Transaction"}
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
                        <TableHead className="font-medium text-gray-600">Market</TableHead>
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
                            <TableCell className="text-gray-600">{transaction.market}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{transactionTypeLabel(transaction.transactionType)}</Badge>
                            </TableCell>
                            <TableCell className="text-right text-gray-900">
                              {formatOptionalNumber(transactionUnits(transaction))}
                            </TableCell>
                            <TableCell className="text-right text-gray-900">
                              {formatOptionalMoney(transaction.currency, transactionPrice(transaction))}
                            </TableCell>
                            <TableCell className="text-right text-gray-900">
                              {formatOptionalMoney("USD", transaction.feeNetUsd, 4)}
                            </TableCell>
                            <TableCell className="text-right text-gray-900">
                              <div className="flex flex-col items-end">
                                <span>{formatOptionalMoney(transaction.currency, transactionNetAmount(transaction))}</span>
                                {transaction.transactionType === "DIVIDEND" &&
                                transaction.withholdingTaxAmount != null ? (
                                  <span className="text-xs text-gray-500">
                                    WHT {formatOptionalMoney(transaction.currency, transaction.withholdingTaxAmount)}
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
                                    transaction.currency,
                                    Math.abs(transaction.realizedPnl),
                                  )}`}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={9} className="py-10 text-center text-sm text-gray-500">
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
                    <TableHead className="font-medium text-gray-600">Market</TableHead>
                    <TableHead className="text-right font-medium text-gray-600">Total Volume</TableHead>
                    <TableHead className="text-right font-medium text-gray-600">Avg Cost</TableHead>
                    <TableHead className="text-right font-medium text-gray-600">Current Price</TableHead>
                    <TableHead className="text-right font-medium text-gray-600">Total Value</TableHead>
                    <TableHead className="text-right font-medium text-gray-600">Gain/Loss</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holdings.length ? (
                    holdings.map((stock) => {
                      const expanded = expandedStock === `${stock.market}:${stock.symbol}`;
                      const avgCost = averageCost(stock);
                      return (
                        <Fragment key={`${stock.market}:${stock.symbol}`}>
                          <TableRow
                            className="cursor-pointer hover:bg-gray-50"
                            onClick={() =>
                              setExpandedStock(expanded ? null : `${stock.market}:${stock.symbol}`)
                            }
                          >
                            <TableCell>
                              {expanded ? (
                                <ChevronUp className="h-4 w-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-gray-400" />
                              )}
                            </TableCell>
                            <TableCell className="font-medium text-gray-900">{stock.symbol}</TableCell>
                            <TableCell className="text-gray-600">{stock.market}</TableCell>
                            <TableCell className="text-right text-gray-900">
                              {stock.quantity.toLocaleString("en-US", { maximumFractionDigits: 4 })}
                            </TableCell>
                            <TableCell className="text-right text-gray-900">
                              {formatMoney(stock.currency, avgCost)}
                            </TableCell>
                            <TableCell className="text-right text-gray-900">
                              {formatMoney(stock.currency, stock.price)}
                            </TableCell>
                            <TableCell className="text-right text-gray-900">
                              {formatMoney(stock.currency, stock.value)}
                            </TableCell>
                            <TableCell
                              className={`text-right ${
                                stock.totalChange >= 0 ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              {stock.totalChange >= 0 ? "+" : "-"}
                              {formatMoney(stock.currency, Math.abs(stock.totalChange))} (
                              {Math.abs(stock.totalChangePct).toFixed(2)}%)
                            </TableCell>
                          </TableRow>
                          {expanded ? (
                            <TableRow>
                              <TableCell colSpan={8} className="bg-gray-50 p-6">
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
                                          {formatMoney(stock.currency, lot.purchasePrice)}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="mb-1 text-xs text-gray-500">Current Price</p>
                                        <p className="text-sm text-gray-900">
                                          {formatMoney(stock.currency, lot.currentPrice)}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="mb-1 text-xs text-gray-500">Current Value</p>
                                        <p className="text-sm text-gray-900">
                                          {formatMoney(stock.currency, lot.value)}
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
                      <TableCell colSpan={8} className="py-10 text-center text-sm text-gray-500">
                        No grouped positions available.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </DataCard>
        </TabsContent>

        <TabsContent value="search" className="space-y-6">
          <StockSearchPanel />
        </TabsContent>
      </Tabs>

      <AddStockDialog
        portfolioId={canRecordTransaction ? selectedPortfolioId : null}
        portfolioLabel={selectedPortfolioLabel}
        portfolioCurrency={selectedPortfolio?.currency || currentCurrency || "USD"}
        holdings={holdings}
        transactions={transactions}
        open={addStockOpen}
        onOpenChange={setAddStockOpen}
        onCreated={async (symbol) => {
          setExpandedStock(symbol);
          await loadCurrent();
        }}
      />
      <AddPortfolioDialog
        open={addPortfolioOpen}
        onOpenChange={setAddPortfolioOpen}
        onSubmit={handleCreatePortfolio}
        submitting={creatingPortfolio}
        error={loadError}
      />
      <DeletePortfolioDialog
        open={deletePortfolioOpen}
        onOpenChange={setDeletePortfolioOpen}
        portfolioName={selectedPortfolioLabel}
        onConfirm={handleDeletePortfolio}
        deleting={deletingPortfolio}
      />
    </PageContainer>
  );
}
