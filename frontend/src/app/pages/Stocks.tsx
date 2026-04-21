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
import { ChevronDown, ChevronUp, Pencil, Plus } from "lucide-react";
import { AddStockDialog } from "../components/AddStockDialog";
import { AddPortfolioDialog } from "../components/AddPortfolioDialog";
import { DeletePortfolioDialog } from "../components/DeletePortfolioDialog";
import { PortfolioChartPanel } from "../components/stocks/PortfolioChartPanel";
import { StockSearchPanel } from "../components/stocks/StockSearchPanel";
import { useAuth } from "../auth";
import { usePreferences } from "../preferences";
import {
  DataCard,
  PageContainer,
  PageHeader,
  SummaryCard,
  SummaryGrid,
} from "../components/layout/index";
import {
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
type GainLossMode = "total" | "day";
type HoldingsSortColumn =
  | "symbol"
  | "name"
  | "market"
  | "quantity"
  | "avgCost"
  | "price"
  | "value"
  | "gainLoss";
type SortDirection = "asc" | "desc";

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
  const { preferredCurrency } = usePreferences();
  const [activeTab, setActiveTab] = useState("overview");
  const [transactionFilter, setTransactionFilter] = useState<TransactionFilter>("all");
  const [gainLossMode, setGainLossMode] = useState<GainLossMode>("total");
  const [holdingsSort, setHoldingsSort] = useState<{
    column: HoldingsSortColumn;
    direction: SortDirection;
  }>({
    column: "value",
    direction: "desc",
  });
  const [expandedStock, setExpandedStock] = useState<string | null>(null);
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<StockTransactionView | null>(null);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState("all");
  const [portfolios, setPortfolios] = useState<StockPortfolio[]>([]);
  const [summary, setSummary] = useState<StockSummary | null>(null);
  const [holdings, setHoldings] = useState<StockPositionView[]>([]);
  const [transactions, setTransactions] = useState<StockTransactionView[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [holdingsLoading, setHoldingsLoading] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
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

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const nextSummary = await getPortfolioStockSummary(selectedPortfolioId);
      setSummary(nextSummary);
    } catch (requestError) {
      setLoadError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load stock summary.",
      );
    } finally {
      setSummaryLoading(false);
    }
  }, [selectedPortfolioId]);

  const loadHoldings = useCallback(async () => {
    setHoldingsLoading(true);
    try {
      const nextHoldings = await getPortfolioStockHoldings(selectedPortfolioId);
      setHoldings(nextHoldings);
    } catch (requestError) {
      setLoadError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load stock holdings.",
      );
    } finally {
      setHoldingsLoading(false);
    }
  }, [selectedPortfolioId]);

  const loadTransactions = useCallback(async () => {
    setTransactionsLoading(true);
    try {
      const nextTransactions = await getPortfolioStockTransactions(selectedPortfolioId);
      setTransactions(nextTransactions);
    } catch (requestError) {
      setLoadError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load stock transactions.",
      );
    } finally {
      setTransactionsLoading(false);
    }
  }, [selectedPortfolioId]);

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
    setLoadError("");
    if (activeTab === "overview") {
      void Promise.allSettled([loadSummary(), loadHoldings(), loadTransactions()]);
      return;
    }
    if (activeTab === "transactions") {
      void loadTransactions();
      return;
    }
    if (activeTab === "per-stock") {
      void loadHoldings();
    }
  }, [activeTab, loadHoldings, loadSummary, loadTransactions]);

  useEffect(() => {
    setTransactionFilter("all");
    setExpandedStock(null);
  }, [selectedPortfolioId]);

  useEffect(() => {
    if (!addStockOpen) {
      return;
    }
    void Promise.allSettled([loadHoldings(), loadTransactions()]);
  }, [addStockOpen, loadHoldings, loadTransactions]);

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
      currency: selectedPortfolio?.currency ?? preferredCurrency,
      totalValue: 0,
      dayChange: 0,
      dayChangePct: 0,
      totalChange: 0,
      totalChangePct: 0,
      series: [0, 0, 0, 0, 0, 0],
      candlesticks: [],
      intradayHistory: [],
      dailyHistory: [],
      performanceIntradayHistory: [],
      performanceDailyHistory: [],
    } satisfies StockSummary);
  const currentCurrency = currentSummary.currency || "USD";
  const overviewLoading = summaryLoading || holdingsLoading;

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

  const sortedHoldings = useMemo(() => {
    const next = holdings.slice();
    const compareStrings = (left: string, right: string) =>
      left.localeCompare(right, undefined, { sensitivity: "base" });
    const compareNumbers = (left: number, right: number) => left - right;
    const multiplier = holdingsSort.direction === "asc" ? 1 : -1;
    next.sort((left, right) => {
      let comparison = 0;
      switch (holdingsSort.column) {
        case "symbol":
          comparison = compareStrings(left.symbol, right.symbol);
          break;
        case "name":
          comparison =
            compareStrings(left.name, right.name) || compareStrings(left.symbol, right.symbol);
          break;
        case "market":
          comparison =
            compareStrings(left.market, right.market) || compareStrings(left.symbol, right.symbol);
          break;
        case "quantity":
          comparison = compareNumbers(left.quantity, right.quantity);
          break;
        case "avgCost":
          comparison = compareNumbers(averageCost(left), averageCost(right));
          break;
        case "price":
          comparison = compareNumbers(left.price, right.price);
          break;
        case "value":
          comparison = compareNumbers(left.value, right.value);
          break;
        case "gainLoss":
          comparison = compareNumbers(
            gainLossMode === "total" ? left.totalChange : left.dayGain,
            gainLossMode === "total" ? right.totalChange : right.dayGain,
          );
          break;
      }
      if (comparison === 0) {
        comparison = compareStrings(left.symbol, right.symbol);
      }
      return comparison * multiplier;
    });
    return next;
  }, [gainLossMode, holdings, holdingsSort]);

  const setHoldingsSortColumn = (column: HoldingsSortColumn) => {
    setHoldingsSort((current) =>
      current.column === column
        ? {
            column,
            direction: current.direction === "desc" ? "asc" : "desc",
          }
        : {
            column,
            direction: "desc",
          },
    );
  };

  const renderSortIndicator = (column: HoldingsSortColumn) => {
    if (holdingsSort.column !== column) {
      return null;
    }
    return holdingsSort.direction === "desc" ? (
      <ChevronDown className="h-4 w-4 text-gray-600" />
    ) : (
      <ChevronUp className="h-4 w-4 text-gray-600" />
    );
  };

  const totalCost = holdings.reduce((sum, position) => sum + (position.value - position.totalChange), 0);
  const totalGainLoss = holdings.reduce((sum, position) => sum + position.totalChange, 0);
  const isPositive = totalGainLoss >= 0;
  const canRecordTransaction = Boolean(authState?.authenticated) && selectedPortfolioId !== "all";
  const editingPortfolio = useMemo(() => {
    if (!editingTransaction) {
      return null;
    }
    return portfolios.find((portfolio) => portfolio.id === editingTransaction.portfolioId) ?? null;
  }, [editingTransaction, portfolios]);
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

          {activeTab !== "search" ? (
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
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setEditingTransaction(null);
                  setAddStockOpen(true);
                }}
                className="gap-2"
                disabled={!canRecordTransaction}
              >
                <Plus className="h-4 w-4" />
                {authState?.authenticated ? "Add Transaction" : "Login to Add Transaction"}
              </Button>
            </div>
          ) : null}
        </div>

        <TabsContent value="overview" className="space-y-6">
          <SummaryGrid>
            <SummaryCard
              label="Portfolio Value"
              value={overviewLoading ? "Loading..." : formatMoney(currentCurrency, currentSummary.totalValue)}
            />
            <SummaryCard
              label="Total Cost"
              value={overviewLoading ? "Loading..." : formatMoney(currentCurrency, totalCost)}
            />
            <SummaryCard
              label="Total Gain/Loss"
              value={
                overviewLoading
                  ? "Loading..."
                  : `${isPositive ? "+" : "-"}${formatMoney(currentCurrency, Math.abs(totalGainLoss))}`
              }
              className={isPositive ? "text-green-600" : "text-red-600"}
            />
          </SummaryGrid>

          <PortfolioChartPanel summary={currentSummary} loading={summaryLoading} />

          <DataCard className="border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 p-6">
              <div>
                <h3 className="text-lg font-normal text-gray-900">Holdings</h3>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-medium text-gray-600">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-left"
                        onClick={() => setHoldingsSortColumn("symbol")}
                      >
                        <span>Ticker</span>
                        {renderSortIndicator("symbol")}
                      </button>
                    </TableHead>
                    <TableHead className="font-medium text-gray-600">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-left"
                        onClick={() => setHoldingsSortColumn("name")}
                      >
                        <span>Company Name</span>
                        {renderSortIndicator("name")}
                      </button>
                    </TableHead>
                    <TableHead className="font-medium text-gray-600">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-left"
                        onClick={() => setHoldingsSortColumn("market")}
                      >
                        <span>Market</span>
                        {renderSortIndicator("market")}
                      </button>
                    </TableHead>
                    <TableHead className="text-right font-medium text-gray-600">
                      <button
                        type="button"
                        className="ml-auto inline-flex items-center gap-1 text-right"
                        onClick={() => setHoldingsSortColumn("quantity")}
                      >
                        <span>Quantity</span>
                        {renderSortIndicator("quantity")}
                      </button>
                    </TableHead>
                    <TableHead className="text-right font-medium text-gray-600">
                      <button
                        type="button"
                        className="ml-auto inline-flex items-center gap-1 text-right"
                        onClick={() => setHoldingsSortColumn("avgCost")}
                      >
                        <span>Avg Cost</span>
                        {renderSortIndicator("avgCost")}
                      </button>
                    </TableHead>
                    <TableHead className="text-right font-medium text-gray-600">
                      <button
                        type="button"
                        className="ml-auto inline-flex items-center gap-1 text-right"
                        onClick={() => setHoldingsSortColumn("price")}
                      >
                        <span>Current Price</span>
                        {renderSortIndicator("price")}
                      </button>
                    </TableHead>
                    <TableHead className="text-right font-medium text-gray-600">
                      <button
                        type="button"
                        className="ml-auto inline-flex items-center gap-1 text-right"
                        onClick={() => setHoldingsSortColumn("value")}
                      >
                        <span>Total Value</span>
                        {renderSortIndicator("value")}
                      </button>
                    </TableHead>
                    <TableHead className="text-right font-medium text-gray-600">
                      <div className="ml-auto flex items-center justify-end gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-right"
                          onClick={() => setHoldingsSortColumn("gainLoss")}
                        >
                          <span>Gain/Loss</span>
                          {renderSortIndicator("gainLoss")}
                        </button>
                        <Select
                          value={gainLossMode}
                          onValueChange={(value) => setGainLossMode(value as GainLossMode)}
                        >
                          <SelectTrigger className="h-8 w-[112px] border-gray-200 bg-white text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="total">Total</SelectItem>
                            <SelectItem value="day">Day</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedHoldings.length ? (
                    sortedHoldings.map((stock) => {
                      const avgCost = averageCost(stock);
                      const gainLossValue =
                        gainLossMode === "total" ? stock.totalChange : stock.dayGain;
                      const gainLossPct =
                        gainLossMode === "total" ? stock.totalChangePct : stock.dayChangePct;
                      const stockPositive = gainLossValue >= 0;
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
                                {formatMoney(stock.currency, Math.abs(gainLossValue))}
                              </span>
                              <span className={`text-xs ${stockPositive ? "text-green-600" : "text-red-600"}`}>
                                ({stockPositive ? "+" : "-"}
                                {Math.abs(gainLossPct).toFixed(2)}%)
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-sm text-gray-500">
                        {holdingsLoading ? "Loading holdings..." : "No holdings recorded yet. Add your first transaction."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </DataCard>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-6">
          <DataCard className="border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 p-6">
              <h3 className="text-lg font-normal text-gray-900">Transaction Ledger</h3>
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
                        <TableHead className="font-medium text-gray-600">Portfolio</TableHead>
                        <TableHead className="font-medium text-gray-600">Type</TableHead>
                        <TableHead className="text-right font-medium text-gray-600">Units</TableHead>
                        <TableHead className="text-right font-medium text-gray-600">Price / Unit</TableHead>
                        <TableHead className="text-right font-medium text-gray-600">Fee USD</TableHead>
                        <TableHead className="text-right font-medium text-gray-600">Net Amount</TableHead>
                        <TableHead className="w-14 text-right font-medium text-gray-600">Edit</TableHead>
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
                            <TableCell className="text-gray-600">
                              {transaction.portfolioName?.trim() || "—"}
                            </TableCell>
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
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={!authState?.authenticated}
                                onClick={() => {
                                  setEditingTransaction(transaction);
                                  setAddStockOpen(true);
                                }}
                                aria-label={`Edit ${transaction.symbol} transaction`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={10} className="py-10 text-center text-sm text-gray-500">
                            {transactionsLoading
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
        portfolioId={
          editingTransaction
            ? editingTransaction.portfolioId
            : canRecordTransaction
              ? selectedPortfolioId
              : null
        }
        portfolioLabel={editingTransaction?.portfolioName || selectedPortfolioLabel}
        portfolioCurrency={
          editingPortfolio?.currency || selectedPortfolio?.currency || editingTransaction?.currency || currentCurrency || "USD"
        }
        holdings={holdings}
        transactions={transactions}
        editingTransaction={editingTransaction}
        open={addStockOpen}
        onOpenChange={(open) => {
          setAddStockOpen(open);
          if (!open) {
            setEditingTransaction(null);
          }
        }}
        onCreated={async (symbol) => {
          setExpandedStock(symbol);
          setEditingTransaction(null);
          await Promise.allSettled([
            loadSummary(),
            loadHoldings(),
            loadTransactions(),
          ]);
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
