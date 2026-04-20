import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  addPortfolioStockTransaction,
  CreateStockTransactionPayload,
  QuoteResult,
  searchStocks,
  StockTransactionView,
  StockPositionView,
} from "../api";
import { usePreferences } from "../preferences";

interface AddStockDialogProps {
  portfolioId: string | null;
  portfolioLabel: string;
  portfolioCurrency: string;
  holdings: StockPositionView[];
  transactions: StockTransactionView[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (symbol: string) => Promise<void> | void;
}

type TransactionMode = "BUY" | "SELL" | "DIVIDEND";
type MarketLedgerLayout = "US" | "TH";

function resetDateValue() {
  return new Date().toISOString().slice(0, 10);
}

function resetNumberValue() {
  return "";
}

function numberFromInput(value: string) {
  if (!value.trim()) {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundValue(value: number, decimals = 2) {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

function formatPreviewValue(value: number | null, decimals = 2) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

function submitLabel(mode: TransactionMode) {
  switch (mode) {
    case "BUY":
      return "Record Buy";
    case "SELL":
      return "Record Sell";
    default:
      return "Record Dividend";
  }
}

function detectLedgerLayout(market?: string | null): MarketLedgerLayout {
  return market?.trim().toLowerCase() === "us" ? "US" : "TH";
}

export function AddStockDialog({
  portfolioId,
  portfolioLabel,
  portfolioCurrency,
  holdings,
  transactions,
  open,
  onOpenChange,
  onCreated,
}: AddStockDialogProps) {
  const { preferredCurrency } = usePreferences();
  const [mode, setMode] = useState<TransactionMode>("BUY");
  const [ticker, setTicker] = useState("");
  const [results, setResults] = useState<QuoteResult[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<QuoteResult | null>(null);
  const [searchResultsExpanded, setSearchResultsExpanded] = useState(true);
  const [selectedHoldingSymbol, setSelectedHoldingSymbol] = useState("");
  const [quantity, setQuantity] = useState(resetNumberValue());
  const [exDate, setExDate] = useState(resetDateValue());
  const [transactionDate, setTransactionDate] = useState(resetDateValue());
  const [pricePerUnit, setPricePerUnit] = useState(resetNumberValue());
  const [feeNetUsd, setFeeNetUsd] = useState(resetNumberValue());
  const [feeNetThb, setFeeNetThb] = useState(resetNumberValue());
  const [feeNetLocal, setFeeNetLocal] = useState(resetNumberValue());
  const [feeVatLocal, setFeeVatLocal] = useState(resetNumberValue());
  const [atsFeeLocal, setAtsFeeLocal] = useState(resetNumberValue());
  const [fxActualRate, setFxActualRate] = useState(resetNumberValue());
  const [fxDimeRate, setFxDimeRate] = useState(resetNumberValue());
  const [dividendPerShare, setDividendPerShare] = useState(resetNumberValue());
  const [withholdingTaxRate, setWithholdingTaxRate] = useState("0.15");
  const [marketLayout, setMarketLayout] = useState<MarketLedgerLayout>("US");
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectedHolding = useMemo(
    () => holdings.find((holding) => holding.symbol === selectedHoldingSymbol) ?? null,
    [holdings, selectedHoldingSymbol],
  );

  const marketHoldings = useMemo(
    () => holdings.slice().sort((left, right) => left.symbol.localeCompare(right.symbol)),
    [holdings],
  );

  const quantityNumber = useMemo(() => numberFromInput(quantity), [quantity]);
  const pricePerUnitNumber = useMemo(() => numberFromInput(pricePerUnit), [pricePerUnit]);
  const feeNetUsdNumber = useMemo(() => numberFromInput(feeNetUsd), [feeNetUsd]);
  const feeNetThbNumber = useMemo(() => numberFromInput(feeNetThb), [feeNetThb]);
  const feeNetLocalNumber = useMemo(() => numberFromInput(feeNetLocal), [feeNetLocal]);
  const feeVatLocalNumber = useMemo(() => numberFromInput(feeVatLocal), [feeVatLocal]);
  const atsFeeLocalNumber = useMemo(() => numberFromInput(atsFeeLocal), [atsFeeLocal]);
  const fxActualRateNumber = useMemo(() => numberFromInput(fxActualRate), [fxActualRate]);
  const fxDimeRateNumber = useMemo(() => numberFromInput(fxDimeRate), [fxDimeRate]);
  const dividendPerShareNumber = useMemo(() => numberFromInput(dividendPerShare), [dividendPerShare]);
  const withholdingTaxRateNumber = useMemo(() => numberFromInput(withholdingTaxRate), [withholdingTaxRate]);
  const preferredCurrencyLabel = preferredCurrency;

  const usTradePreview = useMemo(() => {
    if (mode === "DIVIDEND") {
      return null;
    }
    const grossUsd = quantityNumber * pricePerUnitNumber;
    const usdActual = grossUsd + feeNetUsdNumber;
    return {
      grossUsd: roundValue(grossUsd),
      usdActual: roundValue(usdActual),
      bahtActual: fxActualRateNumber > 0 ? roundValue(usdActual * fxActualRateNumber) : null,
      feePct: grossUsd > 0 ? roundValue((feeNetUsdNumber / grossUsd) * 100, 2) : null,
      totalUsd: roundValue(usdActual),
      totalBahtDime: fxDimeRateNumber > 0 ? roundValue(usdActual * fxDimeRateNumber) : null,
      netPerShare: quantityNumber > 0 ? roundValue(usdActual / quantityNumber, 4) : null,
      feeNetThb: roundValue(feeNetThbNumber),
    };
  }, [
    feeNetThbNumber,
    feeNetUsdNumber,
    fxActualRateNumber,
    fxDimeRateNumber,
    mode,
    pricePerUnitNumber,
    quantityNumber,
  ]);

  const thaiTradePreview = useMemo(() => {
    if (mode === "DIVIDEND") {
      return null;
    }
    const grossLocal = quantityNumber * pricePerUnitNumber;
    const totalFeesLocal = feeNetLocalNumber + feeVatLocalNumber + atsFeeLocalNumber;
    const totalLocal = grossLocal + totalFeesLocal;
    return {
      grossLocal: roundValue(grossLocal),
      totalFeesLocal: roundValue(totalFeesLocal),
      feePct: grossLocal > 0 ? roundValue((totalFeesLocal / grossLocal) * 100, 3) : null,
      totalLocal: roundValue(totalLocal),
      netPerShare: quantityNumber > 0 ? roundValue(totalLocal / quantityNumber, 4) : null,
    };
  }, [
    atsFeeLocalNumber,
    feeNetLocalNumber,
    feeVatLocalNumber,
    mode,
    pricePerUnitNumber,
    quantityNumber,
  ]);

  const dividendPreview = useMemo(() => {
    if (mode !== "DIVIDEND" || !selectedHolding) {
      return null;
    }
    const unitsEntitled = transactions.reduce((sum, transaction) => {
      if (transaction.symbol !== selectedHolding.symbol || transaction.date > exDate) {
        return sum;
      }
      if (transaction.transactionType === "BUY") {
        return sum + (transaction.quantity ?? 0);
      }
      if (transaction.transactionType === "SELL") {
        return sum - (transaction.quantity ?? 0);
      }
      return sum;
    }, 0);
    const grossDividend = unitsEntitled * dividendPerShareNumber;
    const withholdingAmount = grossDividend * withholdingTaxRateNumber;
    return {
      unitsEntitled: roundValue(unitsEntitled, 6),
      grossDividend: roundValue(grossDividend),
      withholdingAmount: roundValue(withholdingAmount),
      netDividend: roundValue(grossDividend - withholdingAmount),
    };
  }, [dividendPerShareNumber, exDate, mode, selectedHolding, transactions, withholdingTaxRateNumber]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setMode("BUY");
    setTicker("");
    setResults([]);
    setSelectedQuote(null);
    setSearchResultsExpanded(true);
    setSelectedHoldingSymbol("");
    setQuantity(resetNumberValue());
    setExDate(resetDateValue());
    setTransactionDate(resetDateValue());
    setPricePerUnit(resetNumberValue());
    setFeeNetUsd(resetNumberValue());
    setFeeNetThb(resetNumberValue());
    setFeeNetLocal(resetNumberValue());
    setFeeVatLocal(resetNumberValue());
    setAtsFeeLocal(resetNumberValue());
    setFxActualRate(resetNumberValue());
    setFxDimeRate(resetNumberValue());
    setDividendPerShare(resetNumberValue());
    setWithholdingTaxRate("0.15");
    setMarketLayout("US");
    setSearching(false);
    setSubmitting(false);
    setError("");
  }, [open]);

  useEffect(() => {
    if (!open || mode !== "BUY") {
      return;
    }

    if (!ticker || ticker.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setSearching(true);
      setError("");
      try {
        const resolvedResults = await searchStocks(ticker.trim());
        if (!cancelled) {
          setResults(resolvedResults);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to search tickers right now.",
          );
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [mode, open, ticker]);

  useEffect(() => {
    setError("");
    setSubmitting(false);
    setTicker("");
    setResults([]);
    setSelectedQuote(null);
    setSearchResultsExpanded(true);
    setSelectedHoldingSymbol("");
    setQuantity(resetNumberValue());
    setExDate(resetDateValue());
    setPricePerUnit(resetNumberValue());
    setFeeNetUsd(resetNumberValue());
    setFeeNetThb(resetNumberValue());
    setFeeNetLocal(resetNumberValue());
    setFeeVatLocal(resetNumberValue());
    setAtsFeeLocal(resetNumberValue());
    setFxActualRate(resetNumberValue());
    setFxDimeRate(resetNumberValue());
    setDividendPerShare(resetNumberValue());
    setWithholdingTaxRate("0.15");
    setMarketLayout("US");
  }, [mode]);

  useEffect(() => {
    const instrument = mode === "BUY" ? selectedQuote : selectedHolding;
    if (!instrument) {
      return;
    }
    setMarketLayout(detectLedgerLayout(instrument.market));
  }, [mode, selectedHolding, selectedQuote]);

  const canSubmit = useMemo(() => {
    if (mode === "BUY") {
      return Boolean(selectedQuote && quantity && transactionDate && pricePerUnit);
    }
    if (mode === "SELL") {
      return Boolean(selectedHolding && quantity && transactionDate && pricePerUnit);
    }
    return Boolean(selectedHolding && exDate && transactionDate && dividendPerShare);
  }, [dividendPerShare, exDate, mode, pricePerUnit, quantity, selectedHolding, selectedQuote, transactionDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      return;
    }

    const instrument = mode === "BUY" ? selectedQuote : selectedHolding;
    if (!instrument) {
      return;
    }

    const payload: CreateStockTransactionPayload = {
      transactionType: mode,
      symbol: instrument.symbol,
      name: instrument.name,
      market: instrument.market,
      marketLayout,
      portfolioId,
      type: instrument.type,
      currency: instrument.currency,
      exDate: mode === "DIVIDEND" ? exDate : null,
      transactionDate,
      quantity: mode === "DIVIDEND" ? null : Number(quantity),
      pricePerUnit: mode === "DIVIDEND" ? null : Number(pricePerUnit),
      feeNetUsd: marketLayout === "US" && feeNetUsd ? Number(feeNetUsd) : null,
      feeNetThb:
        marketLayout === "US"
          ? feeNetThb
            ? Number(feeNetThb)
            : null
          : thaiTradePreview
            ? thaiTradePreview.totalFeesLocal
            : null,
      feeNetLocal: marketLayout === "TH" && feeNetLocal ? Number(feeNetLocal) : null,
      feeVatLocal: marketLayout === "TH" && feeVatLocal ? Number(feeVatLocal) : null,
      atsFeeLocal: marketLayout === "TH" && atsFeeLocal ? Number(atsFeeLocal) : null,
      fxActualRate: marketLayout === "US" && fxActualRate ? Number(fxActualRate) : null,
      fxDimeRate: marketLayout === "US" && fxDimeRate ? Number(fxDimeRate) : null,
      dividendPerShare: mode === "DIVIDEND" ? Number(dividendPerShare) : null,
      withholdingTaxRate: mode === "DIVIDEND" ? Number(withholdingTaxRate || "0") : null,
    };

    setSubmitting(true);
    setError("");
    try {
      if (!portfolioId) {
        throw new Error("Select a portfolio first.");
      }
      await addPortfolioStockTransaction(portfolioId, payload);
      await onCreated?.(instrument.symbol);
      onOpenChange(false);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Unable to record this transaction.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(1600px,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-hidden p-0 sm:max-w-[1600px]">
        <div className="max-h-[calc(100vh-2rem)] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle>Record Stock Transaction</DialogTitle>
          <DialogDescription>
            Record buys, sells, and dividends in {portfolioLabel}. The backend calculates FIFO lots,
            remaining cost basis, realized P/L, and dividend totals from the ledger.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <Tabs value={mode} onValueChange={(value) => setMode(value as TransactionMode)} className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="BUY">Buy</TabsTrigger>
              <TabsTrigger value="SELL">Sell</TabsTrigger>
              <TabsTrigger value="DIVIDEND">Dividend</TabsTrigger>
            </TabsList>

            <TabsContent value="BUY" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ticker">Ticker Symbol</Label>
                <Input
                  id="ticker"
                  placeholder="Search tickers"
                  value={ticker}
                  onChange={(e) => {
                    setTicker(e.target.value);
                    setSelectedQuote(null);
                    setSearchResultsExpanded(true);
                    setPricePerUnit("");
                  }}
                  required={mode === "BUY"}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label>Search Results</Label>
                  <div className="flex items-center gap-3">
                    {selectedQuote ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSearchResultsExpanded(true);
                          setSelectedQuote(null);
                          setPricePerUnit("");
                        }}
                      >
                        Change ticker
                      </Button>
                    ) : null}
                    {searching ? <span className="text-xs text-muted-foreground">Searching...</span> : null}
                  </div>
                </div>
                {searchResultsExpanded ? (
                  <div className="max-h-52 overflow-y-auto rounded-md border border-border bg-background">
                    {results.length ? (
                      <div className="divide-y divide-border">
                        {results.map((result) => {
                          const active =
                            selectedQuote?.symbol === result.symbol &&
                            selectedQuote?.market === result.market;
                          return (
                            <button
                              key={`${result.market}:${result.symbol}`}
                              type="button"
                              className={`flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors ${
                                active ? "bg-blue-50" : "hover:bg-accent"
                              }`}
                              onClick={() => {
                                setSelectedQuote(result);
                                setPricePerUnit(String(result.price));
                                setTicker(result.symbol);
                                setMarketLayout(detectLedgerLayout(result.market));
                                setSearchResultsExpanded(false);
                              }}
                            >
                              <div>
                                <p className="text-sm font-medium text-foreground">{result.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {result.symbol} · {result.type}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium text-foreground">
                                  {result.currency} {result.price.toFixed(2)}
                                </p>
                                <p
                                  className={`text-xs ${
                                    result.dayChangePct >= 0 ? "text-green-600" : "text-red-600"
                                  }`}
                                >
                                  {result.dayChangePct >= 0 ? "+" : ""}
                                  {result.dayChangePct.toFixed(2)}%
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="px-4 py-6 text-sm text-muted-foreground">
                        {ticker.trim().length < 2 ? "Start typing to search." : "No matches found."}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                    Search results collapsed after selection.
                  </div>
                )}
              </div>
              {selectedQuote ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{selectedQuote.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedQuote.symbol} · {selectedQuote.currency} {selectedQuote.price.toFixed(2)}
                      </p>
                    </div>
                    <Badge variant="outline">{selectedQuote.type}</Badge>
                  </div>
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="SELL" className="space-y-4">
              <div className="space-y-2">
                <Label>Open Position</Label>
                <Select value={selectedHoldingSymbol} onValueChange={setSelectedHoldingSymbol}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a holding to sell" />
                  </SelectTrigger>
                  <SelectContent>
                    {marketHoldings.map((holding) => (
                      <SelectItem key={holding.symbol} value={holding.symbol}>
                        {holding.symbol} · {holding.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!marketHoldings.length ? (
                  <p className="text-sm text-muted-foreground">
                    No open holdings are available yet for this portfolio.
                  </p>
                ) : null}
              </div>
            </TabsContent>

            <TabsContent value="DIVIDEND" className="space-y-4">
              <div className="space-y-2">
                <Label>Dividend Position</Label>
                <Select value={selectedHoldingSymbol} onValueChange={setSelectedHoldingSymbol}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a holding for the dividend" />
                  </SelectTrigger>
                  <SelectContent>
                    {marketHoldings.map((holding) => (
                      <SelectItem key={holding.symbol} value={holding.symbol}>
                        {holding.symbol} · {holding.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!marketHoldings.length ? (
                  <p className="text-sm text-muted-foreground">
                    Record a buy first so the backend can calculate dividend entitlement.
                  </p>
                ) : null}
              </div>
            </TabsContent>
          </Tabs>

          {(mode === "SELL" || mode === "DIVIDEND") && selectedHolding ? (
            <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{selectedHolding.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedHolding.symbol} · Open units {selectedHolding.quantity.toLocaleString("en-US", {
                      maximumFractionDigits: 4,
                    })}
                  </p>
                </div>
                <Badge variant="outline">{selectedHolding.type}</Badge>
              </div>
            </div>
          ) : null}

          {mode !== "DIVIDEND" ? (
            <div className="space-y-2">
              <Label>Ledger Layout</Label>
              <Tabs value={marketLayout} onValueChange={(value) => setMarketLayout(value as MarketLedgerLayout)}>
                <TabsList>
                  <TabsTrigger value="US">Foreign Market</TabsTrigger>
                  <TabsTrigger value="TH">Local Market</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          ) : null}

          {mode !== "DIVIDEND" && marketLayout === "US" ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-border">
                <Table className="min-w-[980px]">
                  <TableHeader>
                    <TableRow className="bg-sky-100 hover:bg-sky-100">
                      <TableHead rowSpan={2} className="h-auto border-r border-sky-200 px-3 py-2 align-bottom text-xs">
                        {mode === "BUY" ? "Buy Date" : "Sell Date"}
                      </TableHead>
                      <TableHead rowSpan={2} className="h-auto border-r border-sky-200 px-3 py-2 align-bottom text-xs">
                        Ticker
                      </TableHead>
                      <TableHead rowSpan={2} className="h-auto border-r border-sky-200 px-3 py-2 align-bottom text-xs text-right">
                        Amount
                      </TableHead>
                      <TableHead rowSpan={2} className="h-auto border-r border-sky-200 px-3 py-2 align-bottom text-xs text-right">
                        Price / Unit
                        <div className="text-[10px] font-normal text-muted-foreground">({portfolioCurrency})</div>
                      </TableHead>
                      <TableHead colSpan={4} className="h-auto border-r border-sky-200 px-3 py-2 text-center text-xs">
                        Fee
                      </TableHead>
                      <TableHead rowSpan={2} className="h-auto border-r border-sky-200 px-3 py-2 align-bottom text-xs text-right">
                        %Fee
                      </TableHead>
                      <TableHead colSpan={2} className="h-auto border-r border-sky-200 px-3 py-2 text-center text-xs">
                        Total
                      </TableHead>
                      <TableHead rowSpan={2} className="h-auto px-3 py-2 align-bottom text-xs text-right">
                        Net / Share
                      </TableHead>
                    </TableRow>
                    <TableRow className="bg-sky-100 hover:bg-sky-100">
                      <TableHead className="h-auto border-r border-sky-200 px-3 py-2 text-xs text-right">Net {portfolioCurrency}</TableHead>
                      <TableHead className="h-auto border-r border-sky-200 px-3 py-2 text-xs text-right">Net {preferredCurrencyLabel}</TableHead>
                      <TableHead className="h-auto border-r border-sky-200 px-3 py-2 text-xs text-right">{portfolioCurrency} Actual</TableHead>
                      <TableHead className="h-auto border-r border-sky-200 px-3 py-2 text-xs text-right">{preferredCurrencyLabel} Actual</TableHead>
                      <TableHead className="h-auto border-r border-sky-200 px-3 py-2 text-xs text-right">{portfolioCurrency}</TableHead>
                      <TableHead className="h-auto border-r border-sky-200 px-3 py-2 text-xs text-right">{preferredCurrencyLabel} Dime</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="align-top">
                      <TableCell className="border-r border-border">
                        <Input
                          id="transaction-date"
                          type="date"
                          value={transactionDate}
                          onChange={(e) => setTransactionDate(e.target.value)}
                          className="h-8 min-w-[118px] text-xs"
                          required
                        />
                      </TableCell>
                      <TableCell className="border-r border-border">
                        <div className="min-w-[120px]">
                          <div className="text-sm font-medium text-foreground">
                            {(selectedQuote ?? selectedHolding)?.symbol ?? "Select ticker"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {(selectedQuote ?? selectedHolding)?.name ?? "Search above"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="border-r border-border">
                        <Input
                          id="quantity"
                          type="number"
                          step="0.000001"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          placeholder="0"
                          className="h-8 min-w-[88px] text-right text-xs"
                          required
                        />
                      </TableCell>
                      <TableCell className="border-r border-border">
                        <Input
                          id="price-per-unit"
                          type="number"
                          step="0.0001"
                          value={pricePerUnit}
                          onChange={(e) => setPricePerUnit(e.target.value)}
                          placeholder="0.00"
                          className="h-8 min-w-[96px] text-right text-xs"
                          required
                        />
                      </TableCell>
                      <TableCell className="border-r border-border">
                        <Input
                          id="fee-net-usd"
                          type="number"
                          step="0.0001"
                          value={feeNetUsd}
                          onChange={(e) => setFeeNetUsd(e.target.value)}
                          placeholder="0.00"
                          className="h-8 min-w-[90px] text-right text-xs"
                        />
                      </TableCell>
                      <TableCell className="border-r border-border">
                        <Input
                          id="fee-net-thb"
                          type="number"
                          step="0.0001"
                          value={feeNetThb}
                          onChange={(e) => setFeeNetThb(e.target.value)}
                          placeholder="0.00"
                          className="h-8 min-w-[90px] text-right text-xs"
                          aria-label={`Net ${preferredCurrencyLabel}`}
                        />
                      </TableCell>
                      <TableCell className="border-r border-border bg-muted/30 text-right">
                        <div className="min-w-[90px] text-sm text-foreground">
                          {formatPreviewValue(usTradePreview?.usdActual ?? null)}
                        </div>
                        <div className="mt-2">
                          <Label htmlFor="fx-actual-rate" className="text-[10px] uppercase text-muted-foreground">
                            FX to {preferredCurrencyLabel} Actual
                          </Label>
                          <Input
                            id="fx-actual-rate"
                            type="number"
                            step="0.0001"
                            value={fxActualRate}
                            onChange={(e) => setFxActualRate(e.target.value)}
                            placeholder="Rate"
                            className="mt-1 h-8 min-w-[90px] text-right text-xs"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="border-r border-border bg-muted/30 text-right">
                        <div className="min-w-[95px] text-sm text-foreground">
                          {formatPreviewValue(usTradePreview?.bahtActual ?? null)}
                        </div>
                      </TableCell>
                      <TableCell className="border-r border-border bg-muted/30 text-right">
                        <div className="min-w-[68px] text-sm text-foreground">
                          {usTradePreview?.feePct == null ? "—" : `${formatPreviewValue(usTradePreview.feePct)}%`}
                        </div>
                      </TableCell>
                      <TableCell className="border-r border-border bg-muted/30 text-right">
                        <div className="min-w-[90px] text-sm text-foreground">
                          {formatPreviewValue(usTradePreview?.totalUsd ?? null)}
                        </div>
                        <div className="mt-2">
                          <Label htmlFor="fx-dime-rate" className="text-[10px] uppercase text-muted-foreground">
                            FX to {preferredCurrencyLabel} Dime
                          </Label>
                          <Input
                            id="fx-dime-rate"
                            type="number"
                            step="0.0001"
                            value={fxDimeRate}
                            onChange={(e) => setFxDimeRate(e.target.value)}
                            placeholder="Rate"
                            className="mt-1 h-8 min-w-[90px] text-right text-xs"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="border-r border-border bg-muted/30 text-right">
                        <div className="min-w-[98px] text-sm text-foreground">
                          {formatPreviewValue(usTradePreview?.totalBahtDime ?? null)}
                        </div>
                      </TableCell>
                      <TableCell className="bg-muted/30 text-right">
                        <div className="min-w-[90px] text-sm text-foreground">
                          {formatPreviewValue(usTradePreview?.netPerShare ?? null, 4)}
                        </div>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground">
                The highlighted cells are auto-calculated from the values you enter so you can check the ledger before saving.
              </p>
            </div>
          ) : mode !== "DIVIDEND" ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-border">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow className="bg-sky-100 hover:bg-sky-100">
                      <TableHead rowSpan={2} className="h-auto border-r border-sky-200 px-3 py-2 align-bottom text-xs">
                        {mode === "BUY" ? "Buy Date" : "Sell Date"}
                      </TableHead>
                      <TableHead rowSpan={2} className="h-auto border-r border-sky-200 px-3 py-2 align-bottom text-xs">
                        Ticker
                      </TableHead>
                      <TableHead rowSpan={2} className="h-auto border-r border-sky-200 px-3 py-2 align-bottom text-xs text-right">
                        Amount
                      </TableHead>
                      <TableHead rowSpan={2} className="h-auto border-r border-sky-200 px-3 py-2 align-bottom text-xs text-right">
                        Price / Unit
                      </TableHead>
                      <TableHead colSpan={2} className="h-auto border-r border-sky-200 px-3 py-2 text-center text-xs">
                        Fee
                      </TableHead>
                      <TableHead rowSpan={2} className="h-auto border-r border-sky-200 px-3 py-2 align-bottom text-xs text-right">
                        ATS Fee
                      </TableHead>
                      <TableHead rowSpan={2} className="h-auto border-r border-sky-200 px-3 py-2 align-bottom text-xs text-right">
                        %Fee
                      </TableHead>
                      <TableHead rowSpan={2} className="h-auto border-r border-sky-200 px-3 py-2 align-bottom text-xs text-right">
                        Total
                      </TableHead>
                      <TableHead rowSpan={2} className="h-auto px-3 py-2 align-bottom text-xs text-right">
                        Net-B / Share
                      </TableHead>
                    </TableRow>
                    <TableRow className="bg-sky-100 hover:bg-sky-100">
                      <TableHead className="h-auto border-r border-sky-200 px-3 py-2 text-xs text-right">Net</TableHead>
                      <TableHead className="h-auto border-r border-sky-200 px-3 py-2 text-xs text-right">VAT</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="align-top">
                      <TableCell className="border-r border-border">
                        <Input
                          type="date"
                          value={transactionDate}
                          onChange={(e) => setTransactionDate(e.target.value)}
                          className="h-8 min-w-[118px] text-xs"
                          required
                        />
                      </TableCell>
                      <TableCell className="border-r border-border">
                        <div className="min-w-[120px]">
                          <div className="text-sm font-medium text-foreground">
                            {(selectedQuote ?? selectedHolding)?.symbol ?? "Select ticker"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {(selectedQuote ?? selectedHolding)?.name ?? "Search above"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="border-r border-border">
                        <Input
                          type="number"
                          step="0.000001"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          placeholder="0"
                          className="h-8 min-w-[88px] text-right text-xs"
                          required
                        />
                      </TableCell>
                      <TableCell className="border-r border-border">
                        <Input
                          type="number"
                          step="0.0001"
                          value={pricePerUnit}
                          onChange={(e) => setPricePerUnit(e.target.value)}
                          placeholder="0.00"
                          className="h-8 min-w-[96px] text-right text-xs"
                          required
                        />
                      </TableCell>
                      <TableCell className="border-r border-border">
                        <Input
                          type="number"
                          step="0.0001"
                          value={feeNetLocal}
                          onChange={(e) => setFeeNetLocal(e.target.value)}
                          placeholder="0.00"
                          className="h-8 min-w-[88px] text-right text-xs"
                        />
                      </TableCell>
                      <TableCell className="border-r border-border">
                        <Input
                          type="number"
                          step="0.0001"
                          value={feeVatLocal}
                          onChange={(e) => setFeeVatLocal(e.target.value)}
                          placeholder="0.00"
                          className="h-8 min-w-[88px] text-right text-xs"
                        />
                      </TableCell>
                      <TableCell className="border-r border-border">
                        <Input
                          type="number"
                          step="0.0001"
                          value={atsFeeLocal}
                          onChange={(e) => setAtsFeeLocal(e.target.value)}
                          placeholder="0.00"
                          className="h-8 min-w-[88px] text-right text-xs"
                        />
                      </TableCell>
                      <TableCell className="border-r border-border bg-muted/30 text-right">
                        <div className="min-w-[72px] text-sm text-foreground">
                          {thaiTradePreview?.feePct == null ? "—" : `${formatPreviewValue(thaiTradePreview.feePct, 3)}%`}
                        </div>
                      </TableCell>
                      <TableCell className="border-r border-border bg-muted/30 text-right">
                        <div className="min-w-[98px] text-sm text-foreground">
                          {formatPreviewValue(thaiTradePreview?.totalLocal ?? null)}
                        </div>
                      </TableCell>
                      <TableCell className="bg-muted/30 text-right">
                        <div className="min-w-[98px] text-sm text-foreground">
                          {formatPreviewValue(thaiTradePreview?.netPerShare ?? null, 4)}
                        </div>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground">
                Total amount, fee percentage, and net per share are calculated live from the Thai ledger row so you can verify the numbers before saving.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-border">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow className="bg-sky-100 hover:bg-sky-100">
                      <TableHead className="border-r border-sky-200 px-3 py-2 text-xs">XD Date</TableHead>
                      <TableHead className="border-r border-sky-200 px-3 py-2 text-xs">Received Date</TableHead>
                      <TableHead className="border-r border-sky-200 px-3 py-2 text-xs">Ticker</TableHead>
                      <TableHead className="border-r border-sky-200 px-3 py-2 text-xs text-right">Units Entitled</TableHead>
                      <TableHead className="border-r border-sky-200 px-3 py-2 text-xs text-right">Dividend / Share</TableHead>
                      <TableHead className="border-r border-sky-200 px-3 py-2 text-xs text-right">Gross</TableHead>
                      <TableHead className="border-r border-sky-200 px-3 py-2 text-xs text-right">Withholding Rate</TableHead>
                      <TableHead className="border-r border-sky-200 px-3 py-2 text-xs text-right">Tax</TableHead>
                      <TableHead className="px-3 py-2 text-xs text-right">Net</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="align-top">
                      <TableCell className="border-r border-border">
                        <Input
                          id="ex-date"
                          type="date"
                          value={exDate}
                          onChange={(e) => setExDate(e.target.value)}
                          className="h-8 min-w-[118px] text-xs"
                          required
                        />
                      </TableCell>
                      <TableCell className="border-r border-border">
                        <Input
                          id="transaction-date"
                          type="date"
                          value={transactionDate}
                          onChange={(e) => setTransactionDate(e.target.value)}
                          className="h-8 min-w-[118px] text-xs"
                          required
                        />
                      </TableCell>
                      <TableCell className="border-r border-border">
                        <div className="min-w-[120px]">
                          <div className="text-sm font-medium text-foreground">
                            {selectedHolding?.symbol ?? "Select holding"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {selectedHolding?.name ?? "Choose above"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="border-r border-border bg-muted/30 text-right">
                        <div className="min-w-[92px] text-sm text-foreground">
                          {formatPreviewValue(dividendPreview?.unitsEntitled ?? null, 6)}
                        </div>
                      </TableCell>
                      <TableCell className="border-r border-border">
                        <Input
                          id="dividend-per-share"
                          type="number"
                          step="0.0001"
                          value={dividendPerShare}
                          onChange={(e) => setDividendPerShare(e.target.value)}
                          placeholder="0.00"
                          className="h-8 min-w-[98px] text-right text-xs"
                          required
                        />
                      </TableCell>
                      <TableCell className="border-r border-border bg-muted/30 text-right">
                        <div className="min-w-[88px] text-sm text-foreground">
                          {formatPreviewValue(dividendPreview?.grossDividend ?? null)}
                        </div>
                      </TableCell>
                      <TableCell className="border-r border-border">
                        <Input
                          id="withholding-tax-rate"
                          type="number"
                          step="0.0001"
                          value={withholdingTaxRate}
                          onChange={(e) => setWithholdingTaxRate(e.target.value)}
                          placeholder="0.15"
                          className="h-8 min-w-[88px] text-right text-xs"
                          required
                        />
                      </TableCell>
                      <TableCell className="border-r border-border bg-muted/30 text-right">
                        <div className="min-w-[88px] text-sm text-foreground">
                          {formatPreviewValue(dividendPreview?.withholdingAmount ?? null)}
                        </div>
                      </TableCell>
                      <TableCell className="bg-muted/30 text-right">
                        <div className="min-w-[88px] text-sm text-foreground">
                          {formatPreviewValue(dividendPreview?.netDividend ?? null)}
                        </div>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground">
                Units entitled are calculated from the holdings open on the XD date, while received date is only used to record when the cash was actually paid.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || submitting}>
              {submitting ? "Saving..." : submitLabel(mode)}
            </Button>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
