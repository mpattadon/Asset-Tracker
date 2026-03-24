import { useEffect, useState } from "react";
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
import { addHolding, QuoteResult, searchStocks } from "../api";

interface AddStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (symbol: string) => Promise<void> | void;
}

function resetDateValue() {
  return new Date().toISOString().slice(0, 10);
}

export function AddStockDialog({ open, onOpenChange, onCreated }: AddStockDialogProps) {
  const [ticker, setTicker] = useState("");
  const [results, setResults] = useState<QuoteResult[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<QuoteResult | null>(null);
  const [quantity, setQuantity] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(resetDateValue());
  const [purchasePrice, setPurchasePrice] = useState("");
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setTicker("");
    setResults([]);
    setSelectedQuote(null);
    setQuantity("");
    setPurchaseDate(resetDateValue());
    setPurchasePrice("");
    setSearching(false);
    setSubmitting(false);
    setError("");
  }, [open]);

  useEffect(() => {
    if (!open) {
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
        const resolvedResults = await searchStocks(ticker.trim(), "us");
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
  }, [open, ticker]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuote || !quantity || !purchaseDate || !purchasePrice) {
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await addHolding("us", {
        symbol: selectedQuote.symbol,
        name: selectedQuote.name,
        market: "us",
        type: selectedQuote.type,
        currency: selectedQuote.currency,
        purchaseDate,
        quantity: Number(quantity),
        purchasePrice: Number(purchasePrice),
      });
      await onCreated?.(selectedQuote.symbol);
      onOpenChange(false);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Unable to add this investment.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Add US Stock</DialogTitle>
          <DialogDescription>
            Search for a ticker, choose the result, then enter purchase date, quantity, and cost.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="ticker">Ticker Symbol</Label>
            <Input
              id="ticker"
              placeholder="Type a ticker or company name"
              value={ticker}
              onChange={(e) => {
                setTicker(e.target.value);
                setSelectedQuote(null);
                setPurchasePrice("");
              }}
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Search Results</Label>
              {searching ? <span className="text-xs text-muted-foreground">Searching...</span> : null}
            </div>
            <div className="max-h-52 overflow-y-auto rounded-md border border-border bg-background">
              {results.length ? (
                <div className="divide-y divide-border">
                  {results.map((result) => {
                    const active = selectedQuote?.symbol === result.symbol;
                    return (
                      <button
                        key={result.symbol}
                        type="button"
                        className={`flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors ${
                          active ? "bg-blue-50" : "hover:bg-accent"
                        }`}
                        onClick={() => {
                          setSelectedQuote(result);
                          setPurchasePrice(String(result.price));
                          setTicker(result.symbol);
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
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              placeholder="e.g. 100"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="purchase-date">Purchase Date</Label>
            <Input
              id="purchase-date"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="purchase-price">Purchase Price</Label>
            <Input
              id="purchase-price"
              type="number"
              step="0.01"
              placeholder="e.g. 150.50"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!selectedQuote || !quantity || !purchaseDate || !purchasePrice || submitting}
            >
              {submitting ? "Adding..." : "Add Stock"}
            </Button>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </form>
      </DialogContent>
    </Dialog>
  );
}
