import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Candlestick, StockSummary } from "../../api";
import { DataCard } from "../layout/index";
import { HoverState as TradingViewHoverState, TradingViewChart } from "../charts/TradingViewChart";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  aggregateCandles,
  ChartResolution,
  defaultResolutionForRange,
  formatResolutionLabel,
  resolutionOptionsForRange,
} from "./chartResolution";

type PortfolioChartMode = "line" | "candlestick";
type RangeKey = "1D" | "5D" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "5Y" | "All";

interface PortfolioChartPanelProps {
  summary: StockSummary;
  loading?: boolean;
  badgeLabel?: string;
  changeLabel?: string;
  showPerformance?: boolean;
  availableRanges?: RangeKey[];
  resolutionOptionsOverride?: Partial<Record<RangeKey, ChartResolution[]>>;
  defaultRange?: RangeKey;
  defaultChartMode?: PortfolioChartMode;
}

function symbolForCurrency(currency: string) {
  if (!currency || currency === "MIXED") {
    return "";
  }
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

function formatPercent(value: number | null) {
  if (value == null || Number.isNaN(value)) {
    return "N/A";
  }
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

function toLineData(history: Candlestick[]) {
  return history.map((bar) => ({
    time: bar.time,
    value: bar.close,
  }));
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

function historyForRange(intradayHistory: Candlestick[], dailyHistory: Candlestick[], fallbackHistory: Candlestick[], range: RangeKey) {
  const useIntraday = range === "1D";
  const source = useIntraday && intradayHistory.length
    ? intradayHistory
    : dailyHistory.length
    ? dailyHistory
    : fallbackHistory;

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

function rangeLabel(range: RangeKey) {
  return range === "1D" ? "Today" : range;
}

export function PortfolioChartPanel({
  summary,
  loading = false,
  badgeLabel = "Portfolio",
  changeLabel = "Today",
  showPerformance = true,
  availableRanges = ["1D", "5D", "1M", "3M", "6M", "YTD", "1Y", "5Y", "All"],
  resolutionOptionsOverride,
  defaultRange,
  defaultChartMode = "candlestick",
}: PortfolioChartPanelProps) {
  const initialRange =
    defaultRange && availableRanges.includes(defaultRange)
      ? defaultRange
      : availableRanges[0] ?? "1D";
  const [selectedRange, setSelectedRange] = useState<RangeKey>(initialRange);
  const [selectedResolution, setSelectedResolution] = useState<ChartResolution>(
    (resolutionOptionsOverride?.[initialRange] ?? resolutionOptionsForRange(initialRange))[0] ??
      defaultResolutionForRange(initialRange),
  );
  const [chartMode, setChartMode] = useState<PortfolioChartMode>(defaultChartMode);
  const currency = summary.currency || "USD";

  const selectedValueHistory = useMemo(
    () => historyForRange(summary.intradayHistory, summary.dailyHistory, summary.candlesticks, selectedRange),
    [selectedRange, summary.candlesticks, summary.dailyHistory, summary.intradayHistory],
  );
  const selectedPerformanceHistory = useMemo(
    () =>
      historyForRange(
        summary.performanceIntradayHistory,
        summary.performanceDailyHistory,
        summary.performanceDailyHistory,
        selectedRange,
      ),
    [selectedRange, summary.performanceDailyHistory, summary.performanceIntradayHistory],
  );
  const resolutionOptions = useMemo(
    () => resolutionOptionsOverride?.[selectedRange] ?? resolutionOptionsForRange(selectedRange),
    [resolutionOptionsOverride, selectedRange],
  );

  useEffect(() => {
    if (!availableRanges.includes(selectedRange)) {
      setSelectedRange(availableRanges[0] ?? "1D");
    }
  }, [availableRanges, selectedRange]);

  useEffect(() => {
    const nextRange =
      defaultRange && availableRanges.includes(defaultRange)
        ? defaultRange
        : availableRanges[0] ?? "1D";
    setSelectedRange(nextRange);
    setSelectedResolution(
      (resolutionOptionsOverride?.[nextRange] ?? resolutionOptionsForRange(nextRange))[0] ??
        defaultResolutionForRange(nextRange),
    );
  }, [availableRanges, defaultRange, resolutionOptionsOverride]);

  useEffect(() => {
    setChartMode(defaultChartMode);
  }, [defaultChartMode]);

  useEffect(() => {
    if (!resolutionOptions.includes(selectedResolution)) {
      setSelectedResolution(
        resolutionOptions[0] ?? defaultResolutionForRange(selectedRange),
      );
    }
  }, [resolutionOptions, selectedRange, selectedResolution]);

  const resolvedValueHistory = useMemo(
    () => aggregateCandles(selectedValueHistory, selectedResolution),
    [selectedResolution, selectedValueHistory],
  );
  const resolvedPerformanceHistory = useMemo(
    () => aggregateCandles(selectedPerformanceHistory, selectedResolution),
    [selectedPerformanceHistory, selectedResolution],
  );

  const valueLineData = useMemo(() => toLineData(resolvedValueHistory), [resolvedValueHistory]);
  const performanceLineData = useMemo(() => toLineData(resolvedPerformanceHistory), [resolvedPerformanceHistory]);

  const latestClose = resolvedValueHistory.at(-1)?.close ?? summary.totalValue ?? 0;
  const earliestClose = resolvedValueHistory.at(0)?.close ?? latestClose;
  const rangeAmountChange = latestClose - earliestClose;
  const rangeChange = earliestClose === 0 ? 0 : ((latestClose - earliestClose) / earliestClose) * 100;
  const positiveRange = rangeAmountChange >= 0;
  const positiveDay = summary.dayChange >= 0;
  const latestTime =
    resolvedValueHistory.at(-1)?.time ??
    summary.dailyHistory.at(-1)?.time ??
    summary.candlesticks.at(-1)?.time ??
    "";

  const latestPerformance = resolvedPerformanceHistory.at(-1)?.close ?? summary.totalChangePct ?? 0;
  const performancePositive = latestPerformance >= 0;

  const valueHoverLabelRef = useRef<HTMLSpanElement | null>(null);
  const valueHoverValuesRef = useRef<HTMLSpanElement | null>(null);
  const valueHoverRendererRef = useRef<(hoverState: TradingViewHoverState | null) => void>(() => {});

  valueHoverRendererRef.current = (hoverState: TradingViewHoverState | null) => {
    if (valueHoverLabelRef.current) {
      valueHoverLabelRef.current.textContent = hoverState?.label ?? "";
    }
    if (valueHoverValuesRef.current) {
      valueHoverValuesRef.current.textContent = hoverState
        ? chartMode === "candlestick"
          ? `Open: ${formatMoney(currency, hoverState.open ?? null)}  Close: ${formatMoney(currency, hoverState.close ?? null)}  High: ${formatMoney(currency, hoverState.high ?? null)}  Low: ${formatMoney(currency, hoverState.low ?? null)}`
          : `Selected Value: ${formatMoney(currency, hoverState.price ?? null)}`
        : "";
    }
  };

  const performanceHoverLabelRef = useRef<HTMLSpanElement | null>(null);
  const performanceHoverValuesRef = useRef<HTMLSpanElement | null>(null);
  const performanceHoverRendererRef = useRef<(hoverState: TradingViewHoverState | null) => void>(() => {});

  performanceHoverRendererRef.current = (hoverState: TradingViewHoverState | null) => {
    if (performanceHoverLabelRef.current) {
      performanceHoverLabelRef.current.textContent = hoverState?.label ?? "";
    }
    if (performanceHoverValuesRef.current) {
      performanceHoverValuesRef.current.textContent = hoverState
        ? `Selected Performance: ${formatPercent(hoverState.price ?? null)}`
        : "";
    }
  };

  const handleValueHover = useCallback((hoverState: TradingViewHoverState | null) => {
    valueHoverRendererRef.current(hoverState);
  }, []);

  const handlePerformanceHover = useCallback((hoverState: TradingViewHoverState | null) => {
    performanceHoverRendererRef.current(hoverState);
  }, []);

  return (
    <DataCard className="border-gray-200">
      <div className="space-y-6 p-4 md:p-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="text-lg font-medium text-gray-900">{summary.title}</h3>
            <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600">
              {badgeLabel}
            </span>
          </div>
          <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
            <span className="text-3xl font-semibold tracking-tight text-gray-950">
              {loading ? "Loading..." : formatMoney(currency, summary.totalValue)}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-sm font-medium ${
                  positiveRange ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                }`}
              >
                {loading ? "Loading..." : `${positiveRange ? "↑" : "↓"} ${formatPercent(Math.abs(rangeChange)).replace("+", "")}`}
              </span>
              <span className={`text-lg font-medium ${positiveRange ? "text-green-600" : "text-red-600"}`}>
                {loading ? "" : `${formatSignedMoney(currency, rangeAmountChange)} ${rangeLabel(selectedRange)}`}
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <p className={`text-sm font-medium ${positiveDay ? "text-green-600" : "text-red-600"}`}>
              {`${changeLabel}: ${formatSignedMoney(currency, summary.dayChange)} (${formatPercent(summary.dayChangePct)})`}
            </p>
            <p className="text-xs text-gray-500">
              {latestTime ? `${formatBarTime(latestTime)} · ${currency} · Portfolio` : "Waiting for portfolio history..."}
            </p>
            <p className="text-xs font-medium text-gray-700">
              <span ref={valueHoverLabelRef} className="mr-3 text-gray-500" />
              <span ref={valueHoverValuesRef} />
            </p>
          </div>
        </div>

        {resolvedValueHistory.length ? (
          <TradingViewChart
            height={320}
            mode={chartMode}
            currency={currency === "MIXED" ? undefined : currency}
            lineData={valueLineData}
            candlestickData={resolvedValueHistory}
            onHoverChange={handleValueHover}
          />
        ) : (
          <div className="flex h-[320px] items-center justify-center text-sm text-gray-500">
            {loading ? "Loading history..." : "No history returned for this portfolio."}
          </div>
        )}

        {showPerformance ? (
          <div className="border-t border-gray-200 pt-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-3">
                <h4 className="text-base font-medium text-gray-900">Performance</h4>
                <span className={`text-sm font-medium ${performancePositive ? "text-green-600" : "text-red-600"}`}>
                  {formatPercent(latestPerformance)}
                </span>
              </div>
              <p className="text-xs font-medium text-gray-700">
                <span ref={performanceHoverLabelRef} className="mr-3 text-gray-500" />
                <span ref={performanceHoverValuesRef} />
              </p>
            </div>

            {resolvedPerformanceHistory.length ? (
              <div className="mt-4">
                <TradingViewChart
                  height={220}
                  mode="line"
                  lineData={performanceLineData}
                  valueFormatter={(value) => formatPercent(value)}
                  onHoverChange={handlePerformanceHover}
                />
              </div>
            ) : (
              <div className="mt-4 flex h-[220px] items-center justify-center text-sm text-gray-500">
                {loading ? "Loading performance..." : "No performance history returned for this portfolio."}
              </div>
            )}
          </div>
        ) : null}

        <div className="border-t border-gray-200 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            {availableRanges.map((range) => (
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
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-gray-500">
                Resolution
              </span>
              <Select
                value={selectedResolution}
                onValueChange={(value) => setSelectedResolution(value as ChartResolution)}
              >
                <SelectTrigger className="h-8 w-[96px] border-gray-200 bg-white text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {resolutionOptions.map((resolution) => (
                    <SelectItem key={resolution} value={resolution}>
                      {formatResolutionLabel(resolution)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    </DataCard>
  );
}
