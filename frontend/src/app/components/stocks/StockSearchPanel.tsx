import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Candlestick, getStockChartData, QuoteResult, searchStocks, StockChartData } from "../../api";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { DataCard } from "../layout/index";
import { HoverState as TradingViewHoverState, TradingViewChart } from "../charts/TradingViewChart";

type StockChartMode = "line" | "candlestick";
type RangeKey = "1D" | "5D" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "5Y" | "All";
type FinancialTab = "income" | "balance" | "cashflow";

interface StockSearchPanelProps {
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
    }[currency] ?? `${currency} `
  );
}

function formatMoney(currency: string, amount: number | null, digits = 2) {
  if (amount == null || Number.isNaN(amount)) {
    return "N/A";
  }
  return `${symbolForCurrency(currency)}${amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })}`;
}

function formatCompactNumber(value: number | null) {
  if (value == null || Number.isNaN(value)) {
    return "N/A";
  }
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatSignedMoney(currency: string, amount: number | null, digits = 2) {
  if (amount == null || Number.isNaN(amount)) {
    return "N/A";
  }
  const sign = amount >= 0 ? "+" : "-";
  return `${sign}${formatMoney(currency, Math.abs(amount), digits)}`;
}

function formatSignedNumber(amount: number | null, digits = 2) {
  if (amount == null || Number.isNaN(amount)) {
    return "N/A";
  }
  const sign = amount >= 0 ? "+" : "-";
  return `${sign}${Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })}`;
}

function formatBarTime(rawTime: string) {
  const date = new Date(rawTime);
  if (Number.isNaN(date.getTime())) {
    return rawTime;
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatNewsTime(rawTime: string | null) {
  if (!rawTime) {
    return "";
  }
  const date = new Date(rawTime);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatRatio(value: number | null, digits = 2) {
  if (value == null || Number.isNaN(value)) {
    return "";
  }
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function formatYield(value: number | null) {
  if (value == null || Number.isNaN(value)) {
    return "";
  }
  return `${(value * 100).toFixed(2)}%`;
}

function canonicalSymbol(value: string | null | undefined) {
  if (!value) {
    return "";
  }
  let normalized = value.trim().toUpperCase();
  if (normalized.includes(":")) {
    normalized = normalized.slice(normalized.indexOf(":") + 1);
  }
  if (normalized.includes(".")) {
    normalized = normalized.slice(0, normalized.indexOf("."));
  }
  return normalized;
}

function toLineData(history: Candlestick[]) {
  return history.map((bar) => ({
    time: bar.time,
    value: bar.close,
  }));
}

function defaultQuote(): QuoteResult {
  return {
    symbol: "AAPL",
    name: "Apple Inc.",
    market: "US",
    type: "EQUITY",
    currency: "USD",
    price: 0,
    dayChangePct: 0,
  };
}

function epochMillis(rawTime: string) {
  const parsed = Date.parse(rawTime);
  if (!Number.isNaN(parsed)) {
    return parsed;
  }
  const fallback = Date.parse(`${rawTime}T00:00:00Z`);
  return Number.isNaN(fallback) ? 0 : fallback;
}

function subtractMonths(anchor: Date, months: number) {
  const next = new Date(anchor);
  next.setUTCMonth(next.getUTCMonth() - months);
  return next.getTime();
}

function subtractYears(anchor: Date, years: number) {
  const next = new Date(anchor);
  next.setUTCFullYear(next.getUTCFullYear() - years);
  return next.getTime();
}

function historyForRange(chartData: StockChartData | null, range: RangeKey) {
  if (!chartData) {
    return [];
  }

  const useIntraday = range === "1D" || range === "5D" || range === "1M";
  const source = useIntraday && chartData.intradayHistory.length
    ? chartData.intradayHistory
    : chartData.dailyHistory;

  if (!source.length || range === "All") {
    return source;
  }

  const latestEpoch = epochMillis(source[source.length - 1].time);
  const latestDate = new Date(latestEpoch);
  const cutoff = (() => {
    switch (range) {
      case "1D":
        return latestEpoch - 24 * 60 * 60 * 1000;
      case "5D":
        return latestEpoch - 5 * 24 * 60 * 60 * 1000;
      case "1M":
        return subtractMonths(latestDate, 1);
      case "3M":
        return subtractMonths(latestDate, 3);
      case "6M":
        return subtractMonths(latestDate, 6);
      case "YTD":
        return Date.UTC(latestDate.getUTCFullYear(), 0, 1);
      case "1Y":
        return subtractYears(latestDate, 1);
      case "5Y":
        return subtractYears(latestDate, 5);
      case "All":
      default:
        return Number.NEGATIVE_INFINITY;
    }
  })();

  return source.filter((bar) => epochMillis(bar.time) >= cutoff);
}

function formatSessionLabel(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function marketSessionInfo(chartData: StockChartData | null) {
  if (!chartData) {
    return "Waiting for market data...";
  }

  const timezone = chartData.timezone || (chartData.market === "TH" ? "Asia/Bangkok" : "America/New_York");
  const schedule =
    chartData.market === "TH"
      ? {
          regularStart: 10 * 60,
          regularEnd: 16 * 60 + 30,
          label: "Regular",
          timezone,
        }
      : {
          preStart: 4 * 60,
          regularStart: 9 * 60 + 30,
          regularEnd: 16 * 60,
          afterEnd: 20 * 60,
          timezone,
        };

  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short",
  }).formatToParts(now);

  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const zoneLabel = parts.find((part) => part.type === "timeZoneName")?.value ?? timezone;
  const minuteOfDay = hour * 60 + minute;
  const weekend = weekday === "Sat" || weekday === "Sun";

  if (weekend) {
    if ("preStart" in schedule) {
      return `Closed • Regular ${formatSessionLabel(schedule.regularStart)}-${formatSessionLabel(schedule.regularEnd)} ${zoneLabel}`;
    }
    return `Closed • ${schedule.label} ${formatSessionLabel(schedule.regularStart)}-${formatSessionLabel(schedule.regularEnd)} ${zoneLabel}`;
  }

  if ("preStart" in schedule) {
    if (minuteOfDay >= schedule.preStart && minuteOfDay < schedule.regularStart) {
      return `Pre-market • ${formatSessionLabel(schedule.preStart)}-${formatSessionLabel(schedule.regularStart)} ${zoneLabel}`;
    }
    if (minuteOfDay >= schedule.regularStart && minuteOfDay < schedule.regularEnd) {
      return `Open • ${formatSessionLabel(schedule.regularStart)}-${formatSessionLabel(schedule.regularEnd)} ${zoneLabel}`;
    }
    if (minuteOfDay >= schedule.regularEnd && minuteOfDay < schedule.afterEnd) {
      return `After hours • ${formatSessionLabel(schedule.regularEnd)}-${formatSessionLabel(schedule.afterEnd)} ${zoneLabel}`;
    }
    return `Closed • Regular ${formatSessionLabel(schedule.regularStart)}-${formatSessionLabel(schedule.regularEnd)} ${zoneLabel}`;
  }

  if (minuteOfDay >= schedule.regularStart && minuteOfDay < schedule.regularEnd) {
    return `Open • ${schedule.label} ${formatSessionLabel(schedule.regularStart)}-${formatSessionLabel(schedule.regularEnd)} ${zoneLabel}`;
  }
  return `Closed • ${schedule.label} ${formatSessionLabel(schedule.regularStart)}-${formatSessionLabel(schedule.regularEnd)} ${zoneLabel}`;
}

function rangeLabel(range: RangeKey) {
  return range === "1D" ? "Today" : range;
}

function statusTimestamp(chartData: StockChartData | null) {
  if (!chartData) {
    return "Waiting for session data...";
  }
  const timezone = chartData.timezone || (chartData.market === "TH" ? "Asia/Bangkok" : "America/New_York");
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).formatToParts(new Date());
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const hour = parts.find((part) => part.type === "hour")?.value ?? "";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "";
  const second = parts.find((part) => part.type === "second")?.value ?? "";
  const dayPeriod = parts.find((part) => part.type === "dayPeriod")?.value?.toUpperCase() ?? "";
  const zone = parts.find((part) => part.type === "timeZoneName")?.value ?? timezone;
  return `${month} ${day}, ${hour}:${minute}:${second} ${dayPeriod} ${zone}`;
}

export function StockSearchPanel({}: StockSearchPanelProps) {
  const [query, setQuery] = useState(defaultQuote().symbol);
  const [results, setResults] = useState<QuoteResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchResultsExpanded, setSearchResultsExpanded] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<QuoteResult | null>(defaultQuote());
  const [selectedRange, setSelectedRange] = useState<RangeKey>("1D");
  const [chartMode, setChartMode] = useState<StockChartMode>("candlestick");
  const [financialTab, setFinancialTab] = useState<FinancialTab>("income");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [chartData, setChartData] = useState<StockChartData | null>(null);
  const chartRequestId = useRef(0);
  const searchRequestId = useRef(0);
  const hoverLabelRef = useRef<HTMLSpanElement | null>(null);
  const hoverValuesRef = useRef<HTMLSpanElement | null>(null);
  const hoverRendererRef = useRef<(hoverState: TradingViewHoverState | null) => void>(() => {});

  async function loadChartData(nextQuote: QuoteResult) {
    const requestId = ++chartRequestId.current;
    setLoading(true);
    setError("");
    try {
      const result = await getStockChartData(nextQuote.symbol, nextQuote.market);
      if (requestId !== chartRequestId.current) {
        return;
      }
      if (canonicalSymbol(result.requestedSymbol) !== canonicalSymbol(nextQuote.symbol)) {
        setChartData(null);
        setError(`Received chart data for ${result.requestedSymbol} instead of ${nextQuote.symbol}. Please try the search again.`);
        return;
      }
      setChartData(result);
      setFinancialTab("income");
    } catch (requestError) {
      if (requestId !== chartRequestId.current) {
        return;
      }
      setChartData(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load stock chart data.",
      );
    } finally {
      if (requestId === chartRequestId.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      const requestId = ++searchRequestId.current;
      setSearching(true);
      try {
        const nextResults = await searchStocks(query.trim());
        if (!cancelled && requestId === searchRequestId.current) {
          setResults(nextResults);
        }
      } catch (requestError) {
        if (!cancelled && requestId === searchRequestId.current) {
          setResults([]);
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to search symbols right now.",
          );
        }
      } finally {
        if (!cancelled && requestId === searchRequestId.current) {
          setSearching(false);
        }
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fallback = selectedQuote ?? results[0];
    if (!fallback) {
      return;
    }
    void loadChartData(fallback);
  }

  const selectedHistory = useMemo(
    () => historyForRange(chartData, selectedRange),
    [chartData, selectedRange],
  );
  const lineData = useMemo(() => toLineData(selectedHistory), [selectedHistory]);
  const currency = chartData?.currency ?? selectedQuote?.currency ?? "USD";
  const latestClose = selectedHistory.at(-1)?.close ?? chartData?.price ?? 0;
  const earliestClose = selectedHistory.at(0)?.close ?? latestClose;
  const rangeChange = earliestClose === 0 ? 0 : ((latestClose - earliestClose) / earliestClose) * 100;
  const rangeAmountChange = latestClose - earliestClose;
  const dayAmountChange =
    chartData?.price != null && chartData.previousClose != null
      ? chartData.price - chartData.previousClose
      : chartData?.price != null
      ? chartData.price * (chartData.dayChangePct / 100)
      : null;
  const positiveRange = rangeAmountChange >= 0;
  const positiveDay = (dayAmountChange ?? 0) >= 0;

  hoverRendererRef.current = (hoverState: TradingViewHoverState | null) => {
    if (hoverLabelRef.current) {
      hoverLabelRef.current.textContent = hoverState?.label ?? "";
    }
    if (hoverValuesRef.current) {
      hoverValuesRef.current.textContent = hoverState
        ? chartMode === "candlestick"
          ? `Open: ${formatMoney(currency, hoverState.open ?? null)}  Close: ${formatMoney(currency, hoverState.close ?? null)}  High: ${formatMoney(currency, hoverState.high ?? null)}  Low: ${formatMoney(currency, hoverState.low ?? null)}`
          : `Selected Price: ${formatMoney(currency, hoverState.price ?? null)}`
        : "";
    }
  };

  const handleChartHover = useCallback((hoverState: TradingViewHoverState | null) => {
    hoverRendererRef.current(hoverState);
  }, []);
  const stockTags = [
    chartData?.type,
    chartData?.market ? `${chartData.market} listed security` : null,
    chartData?.country ? `${chartData.country} headquartered` : null,
  ].filter((tag): tag is string => Boolean(tag));
  const detailRows = [
    { label: "Previous Close", value: formatMoney(currency, chartData?.previousClose ?? null) },
    {
      label: "Day Range",
      value:
        chartData?.dayLow != null && chartData?.dayHigh != null
          ? `${formatMoney(currency, chartData.dayLow)} - ${formatMoney(currency, chartData.dayHigh)}`
          : "",
    },
    {
      label: "Year Range",
      value:
        chartData?.fiftyTwoWeekLow != null && chartData?.fiftyTwoWeekHigh != null
          ? `${formatMoney(currency, chartData.fiftyTwoWeekLow)} - ${formatMoney(currency, chartData.fiftyTwoWeekHigh)}`
          : "",
    },
    { label: "Market Cap", value: chartData?.marketCap != null ? `${formatCompactNumber(chartData.marketCap)} ${currency}` : "" },
    { label: "Avg Volume", value: formatCompactNumber(chartData?.averageVolume ?? null) },
    { label: "P/E Ratio", value: formatRatio(chartData?.trailingPe ?? null) },
    { label: "Dividend Yield", value: formatYield(chartData?.dividendYield ?? null) },
    { label: "Primary Exchange", value: chartData?.exchange ?? "" },
  ].filter((row) => row.value);
  const aboutRows = [
    { label: "CEO", value: chartData?.ceo ?? "" },
    { label: "Headquarters", value: chartData?.headquarters ?? "" },
    { label: "Employees", value: formatCompactNumber(chartData?.fullTimeEmployees ?? null) },
    { label: "Sector", value: chartData?.sector ?? "" },
    { label: "Industry", value: chartData?.industry ?? "" },
  ].filter((row) => row.value);
  const topNews = (chartData?.news ?? []).filter((item) => item.title || item.summary || item.link);
  const activeFinancialStatement =
    financialTab === "income"
      ? chartData?.incomeStatement
      : financialTab === "balance"
      ? chartData?.balanceSheet
      : chartData?.cashFlow;

  return (
    <div className="space-y-6">
      <Card className="border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        One query now loads cached intraday and daily bars for the selected ticker. Candle/line
        switching and timeframe changes reuse the same loaded dataset locally, while the backend only
        refreshes the missing tail of cached history for later lookups.
      </Card>

      <DataCard title="Ticker Query" className="border-gray-200">
        <form
          className="grid gap-4 p-4 md:grid-cols-[minmax(0,2fr)_auto] md:items-end md:p-6"
          onSubmit={handleSubmit}
        >
          <div className="grid gap-2">
            <label className="text-sm font-medium text-gray-900">Search A Stock</label>
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value.toUpperCase());
                setSelectedQuote(null);
                setSearchResultsExpanded(true);
                setError("");
              }}
              placeholder="Search by ticker or company name"
            />
          </div>
          <Button type="submit" disabled={!(selectedQuote ?? results[0])}>
            {loading ? "Refreshing..." : "Open Chart"}
          </Button>
        </form>

        <div className="border-t border-gray-200 px-4 py-4 md:px-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-gray-900">Search Results</p>
            <div className="flex items-center gap-3">
              {selectedQuote ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedQuote(null);
                    setSearchResultsExpanded(true);
                  }}
                >
                  Change stock
                </Button>
              ) : null}
              {searching ? <span className="text-xs text-gray-500">Searching...</span> : null}
            </div>
          </div>

          <div className="mt-3 space-y-3">
            {searchResultsExpanded ? (
              <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white">
                {results.length ? (
                <div className="divide-y divide-gray-200">
                    {results.map((result) => {
                      const active =
                        selectedQuote?.symbol === result.symbol && selectedQuote.market === result.market;
                      return (
                        <button
                          key={`${result.market}:${result.symbol}`}
                          type="button"
                          className={`flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors ${
                            active ? "bg-blue-50" : "hover:bg-gray-50"
                          }`}
                          onClick={() => {
                            setSelectedQuote(result);
                            setQuery(result.symbol);
                            setSearchResultsExpanded(false);
                            setSelectedRange("1D");
                            void loadChartData(result);
                          }}
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-900">{result.name}</p>
                            <p className="text-xs text-gray-500">
                              {result.symbol} · {result.market} · {result.type}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">
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
                  <div className="px-4 py-6 text-sm text-gray-500">
                    {query.trim().length < 2 ? "Start typing to search." : "No matches found."}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-200 px-4 py-3 text-sm text-gray-500">
                Search results collapsed after selection.
              </div>
            )}

            {selectedQuote ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{selectedQuote.name}</p>
                    <p className="text-xs text-gray-500">
                      {selectedQuote.symbol} · {selectedQuote.market} · {selectedQuote.currency}{" "}
                      {selectedQuote.price.toFixed(2)}
                    </p>
                  </div>
                  <Badge variant="outline">{selectedQuote.type}</Badge>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </DataCard>

      {error ? (
        <Card className="border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]">
        <DataCard title="History" className="border-gray-200">
          <div className="space-y-5 p-4 md:p-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h3 className="text-lg font-medium text-gray-900">
                  {chartData?.name ?? "Waiting for ticker data..."}
                </h3>
                {chartData?.normalizedSymbol ? (
                  <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {chartData.normalizedSymbol}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <span className="text-3xl font-semibold tracking-tight text-gray-950">
                  {loading ? "Loading..." : formatMoney(currency, chartData?.price ?? null)}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-sm font-medium ${
                      positiveRange ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                    }`}
                  >
                    {loading || !chartData ? "Loading..." : `${positiveRange ? "↑" : "↓"} ${formatPercent(Math.abs(rangeChange)).replace("+", "")}`}
                  </span>
                  <span className={`text-lg font-medium ${positiveRange ? "text-green-600" : "text-red-600"}`}>
                    {loading ? "" : `${formatSignedMoney(currency, rangeAmountChange)} ${rangeLabel(selectedRange)}`}
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <p className={`text-sm font-medium ${positiveDay ? "text-green-600" : "text-red-600"}`}>
                  {`Today: ${formatSignedMoney(currency, dayAmountChange)} (${formatPercent(chartData?.dayChangePct ?? 0)})`}
                </p>
                <p className="text-sm text-gray-700">
                  {marketSessionInfo(chartData)}
                </p>
                <p className="text-xs text-gray-500">
                  {`${statusTimestamp(chartData)} \u00b7 ${currency} \u00b7 ${chartData?.exchange ?? "Unknown exchange"}`}
                </p>
                <p className="text-xs font-medium text-gray-700">
                  <span ref={hoverLabelRef} className="mr-3 text-gray-500" />
                  <span ref={hoverValuesRef} />
                </p>
              </div>
            </div>

            {selectedHistory.length ? (
              <TradingViewChart
                height={320}
                mode={chartMode}
                currency={currency}
                lineData={lineData}
                candlestickData={selectedHistory}
                onHoverChange={handleChartHover}
              />
            ) : (
              <div className="flex h-[320px] items-center justify-center text-sm text-gray-500">
                {loading ? "Loading history..." : "No history returned for this query."}
              </div>
            )}

            <div className="border-t border-gray-200 pt-4">
              <div className="flex flex-wrap items-center gap-2">
                {(["1D", "5D", "1M", "3M", "6M", "YTD", "1Y", "5Y", "All"] as RangeKey[]).map((range) => (
                  <Button
                    key={range}
                    type="button"
                    size="sm"
                    variant={selectedRange === range ? "default" : "outline"}
                    onClick={() => setSelectedRange(range)}
                  >
                    {range}
                  </Button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={chartMode === "candlestick" ? "default" : "outline"}
                  onClick={() => setChartMode("candlestick")}
                >
                  Candles
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={chartMode === "line" ? "default" : "outline"}
                  onClick={() => setChartMode("line")}
                >
                  Line
                </Button>
                <span className="text-xs text-gray-500">
                  Cached datasets: 60d / 5m intraday and max / 1d daily
                </span>
              </div>
            </div>
          </div>
        </DataCard>

        <DataCard title="Stock Details" className="border-gray-200">
          <div className="space-y-4 p-4 md:p-6">
            {stockTags.length ? (
              <div className="flex flex-wrap gap-2">
                {stockTags.map((tag) => (
                  <Badge key={tag} variant="outline" className="rounded-full px-3 py-1 text-xs font-medium text-gray-600">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : null}
            <div className="divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white">
              {detailRows.length ? (
                detailRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-4 px-4 py-4">
                    <span className="text-xs uppercase tracking-[0.18em] text-gray-500">{row.label}</span>
                    <span className="text-right text-sm font-medium text-gray-900">{row.value}</span>
                  </div>
                ))
              ) : (
                <div className="px-4 py-10 text-sm text-gray-400" />
              )}
            </div>
          </div>
        </DataCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]">
        <DataCard title="Top News" className="border-gray-200">
          <div className="space-y-4 p-4 md:p-6">
            {topNews.length ? (
              topNews.map((item, index) => (
                <article key={`${item.link ?? item.title ?? "news"}-${index}`} className="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0">
                  {item.title ? (
                    item.link ? (
                      <a
                        className="text-base font-medium text-gray-900 underline-offset-4 hover:text-blue-700 hover:underline"
                        href={item.link}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {item.title}
                      </a>
                    ) : (
                      <p className="text-base font-medium text-gray-900">{item.title}</p>
                    )
                  ) : null}
                  {(item.publisher || item.publishedAt) ? (
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-gray-500">
                      {[item.publisher, formatNewsTime(item.publishedAt)].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                  {item.summary ? <p className="mt-2 text-sm leading-6 text-gray-700">{item.summary}</p> : null}
                </article>
              ))
            ) : (
              <div className="min-h-40 rounded-xl border border-dashed border-gray-200" />
            )}
          </div>
        </DataCard>

        <DataCard title="About" className="border-gray-200">
          <div className="space-y-5 p-4 md:p-6">
            {chartData?.longBusinessSummary ? (
              <p className="text-sm leading-7 text-gray-800">{chartData.longBusinessSummary}</p>
            ) : (
              <div className="min-h-24 rounded-xl border border-dashed border-gray-200" />
            )}
            {aboutRows.length ? (
              <div className="divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white">
                {aboutRows.map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-4 px-4 py-4">
                    <span className="text-xs uppercase tracking-[0.18em] text-gray-500">{row.label}</span>
                    <span className="max-w-[70%] text-right text-sm font-medium text-gray-900">{row.value}</span>
                  </div>
                ))}
                {chartData?.website ? (
                  <div className="flex items-start justify-between gap-4 px-4 py-4">
                    <span className="text-xs uppercase tracking-[0.18em] text-gray-500">Website</span>
                    <a
                      className="max-w-[70%] text-right text-sm font-medium text-blue-700 underline underline-offset-4"
                      href={chartData.website}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {chartData.website}
                    </a>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </DataCard>
      </div>

      <DataCard title="Financials" className="border-gray-200">
        <div className="space-y-4 p-4 md:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={financialTab === "income" ? "default" : "outline"}
              onClick={() => setFinancialTab("income")}
            >
              Income Statement
            </Button>
            <Button
              type="button"
              size="sm"
              variant={financialTab === "balance" ? "default" : "outline"}
              onClick={() => setFinancialTab("balance")}
            >
              Balance Sheet
            </Button>
            <Button
              type="button"
              size="sm"
              variant={financialTab === "cashflow" ? "default" : "outline"}
              onClick={() => setFinancialTab("cashflow")}
            >
              Cash Flow
            </Button>
          </div>

          {activeFinancialStatement?.periods.length && activeFinancialStatement.rows.length ? (
            <div className="overflow-x-auto rounded-2xl border border-gray-200">
              <table className="min-w-[880px] divide-y divide-gray-200 bg-white text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="sticky left-0 bg-gray-50 px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-gray-500">
                      {activeFinancialStatement.title}
                    </th>
                    {activeFinancialStatement.periods.map((period) => (
                      <th
                        key={period}
                        className="px-4 py-3 text-right text-xs font-medium uppercase tracking-[0.18em] text-gray-500"
                      >
                        {period}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {activeFinancialStatement.rows.map((row) => (
                    <tr key={row.label}>
                      <td className="sticky left-0 bg-white px-4 py-3 font-medium text-gray-900">
                        {row.label}
                      </td>
                      {row.values.map((value, index) => (
                        <td key={`${row.label}-${index}`} className="px-4 py-3 text-right text-gray-700">
                          {value == null ? "" : formatCompactNumber(value)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="min-h-32 rounded-xl border border-dashed border-gray-200" />
          )}
        </div>
      </DataCard>
    </div>
  );
}
