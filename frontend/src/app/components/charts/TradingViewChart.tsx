"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BusinessDay,
  CandlestickData,
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramData,
  HistogramSeries,
  MismatchDirection,
  LineData,
  LineSeries,
  MouseEventParams,
  SeriesDataItemTypeMap,
  ISeriesApi,
  Time,
  UTCTimestamp,
} from "lightweight-charts";
import { cn } from "../ui/utils";

export interface TradingViewLinePoint {
  time: string;
  value: number;
  color?: string;
}

export interface TradingViewHistogramPoint {
  time: string;
  value: number;
  color?: string;
}

export interface TradingViewCandlestickPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface TradingViewChartProps {
  className?: string;
  height?: number;
  mode: "line" | "candlestick" | "histogram";
  lineData?: TradingViewLinePoint[];
  histogramData?: TradingViewHistogramPoint[];
  candlestickData?: TradingViewCandlestickPoint[];
  currency?: string;
  accentColor?: string;
  valueFormatter?: (value: number) => string;
  onHoverChange?: (hoverState: HoverState | null) => void;
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MIDNIGHT_WITH_OFFSET_PATTERN = /^\d{4}-\d{2}-\d{2}T00:00(?::00(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

function toBusinessDay(rawDate: string): BusinessDay {
  const [year, month, day] = rawDate.split("-").map(Number);
  return { year, month, day };
}

function toChartTime(rawTime: string): Time {
  if (DATE_ONLY_PATTERN.test(rawTime)) {
    return toBusinessDay(rawTime);
  }
  if (MIDNIGHT_WITH_OFFSET_PATTERN.test(rawTime)) {
    return toBusinessDay(rawTime.slice(0, 10));
  }
  const parsed = Date.parse(rawTime);
  if (Number.isNaN(parsed)) {
    if (rawTime.startsWith("P")) {
      return toBusinessDay("2026-01-01");
    }
    return toBusinessDay(rawTime.slice(0, 10));
  }
  return Math.floor(parsed / 1000) as UTCTimestamp;
}

function hasBusinessDay(time: Time): time is BusinessDay {
  return typeof time === "object" && time !== null && "year" in time && "month" in time && "day" in time;
}

function timeSortKey(time: Time) {
  if (hasBusinessDay(time)) {
    return `${time.year.toString().padStart(4, "0")}-${time.month.toString().padStart(2, "0")}-${time.day
      .toString()
      .padStart(2, "0")}`;
  }
  return `ts:${time}`;
}

function compareChartTimes(left: Time, right: Time) {
  const leftKey = timeSortKey(left);
  const rightKey = timeSortKey(right);
  if (leftKey < rightKey) {
    return -1;
  }
  if (leftKey > rightKey) {
    return 1;
  }
  return 0;
}

function toDisplayDate(time: Time, withTime: boolean) {
  const date = hasBusinessDay(time)
    ? new Date(Date.UTC(time.year, time.month - 1, time.day))
    : new Date(Number(time) * 1000);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: withTime ? undefined : "numeric",
    hour: withTime ? "2-digit" : undefined,
    minute: withTime ? "2-digit" : undefined,
    hour12: false,
    timeZone: "UTC",
  }).format(date);
}

function buildPriceFormatter(currency?: string, valueFormatter?: (value: number) => string) {
  if (valueFormatter) {
    return valueFormatter;
  }

  if (!currency) {
    return (value: number) =>
      value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  return (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
}

export interface HoverState {
  label: string;
  price?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
}

export function TradingViewChart({
  className,
  height = 280,
  mode,
  lineData = [],
  histogramData = [],
  candlestickData = [],
  currency,
  accentColor = "#2563eb",
  valueFormatter,
  onHoverChange,
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastWidthRef = useRef<number>(0);
  const [renderError, setRenderError] = useState<string | null>(null);
  const priceFormatter = useMemo(
    () => buildPriceFormatter(currency, valueFormatter),
    [currency, valueFormatter],
  );
  const intradaySeries = useMemo(() => {
    const source =
      mode === "candlestick"
        ? candlestickData
        : mode === "histogram"
        ? histogramData
        : lineData;
    return source.some((point) => !hasBusinessDay(toChartTime(point.time)));
  }, [candlestickData, histogramData, lineData, mode]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    setRenderError(null);

    const rawEffectiveData =
      mode === "candlestick"
        ? candlestickData.map((point) => ({ ...point, chartTime: toChartTime(point.time) }))
        : mode === "histogram"
        ? histogramData.map((point) => ({ ...point, chartTime: toChartTime(point.time) }))
        : lineData.map((point) => ({ ...point, chartTime: toChartTime(point.time) }));

    const dedupedByTime = new Map<string, (typeof rawEffectiveData)[number]>();
    for (const point of rawEffectiveData) {
      dedupedByTime.set(timeSortKey(point.chartTime), point);
    }

    const effectiveData = Array.from(dedupedByTime.values()).sort((left, right) =>
      compareChartTimes(left.chartTime, right.chartTime),
    );

    let chart: ReturnType<typeof createChart> | null = null;
    let activeSeries: ISeriesApi<"Candlestick" | "Histogram" | "Line", Time> | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const handleCrosshairMove = (param: MouseEventParams<Time>) => {
      if (!activeSeries) {
        return;
      }
      if (!param.point || param.logical == null || !param.time) {
        return;
      }
      const logicalIndex = Math.round(param.logical);
      const dataPoint = activeSeries.dataByIndex(logicalIndex, MismatchDirection.NearestLeft) as
        | SeriesDataItemTypeMap<Time>["Candlestick"]
        | SeriesDataItemTypeMap<Time>["Histogram"]
        | SeriesDataItemTypeMap<Time>["Line"]
        | undefined;
      if (!dataPoint) {
        return;
      }

      if (mode === "candlestick" && "open" in dataPoint) {
        onHoverChange?.({
          label: toDisplayDate(param.time, intradaySeries),
          open: dataPoint.open,
          high: dataPoint.high,
          low: dataPoint.low,
          close: dataPoint.close,
        });
        return;
      }

      if ("value" in dataPoint) {
        onHoverChange?.({
          label: toDisplayDate(param.time, intradaySeries),
          price: dataPoint.value,
        });
      }
    };

    try {
      chart = createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height,
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: "#6b7280",
          attributionLogo: false,
        },
        grid: {
          vertLines: { color: "#eef2f7" },
          horzLines: { color: "#eef2f7" },
        },
        crosshair: {
          mode: CrosshairMode.Magnet,
        },
        rightPriceScale: {
          borderColor: "#e5e7eb",
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: true,
        },
        handleScale: {
          axisPressedMouseMove: true,
          mouseWheel: true,
          pinch: true,
        },
        timeScale: {
          borderColor: "#e5e7eb",
          timeVisible: intradaySeries,
          secondsVisible: false,
          rightOffset: 6,
          tickMarkFormatter: (time) => toDisplayDate(time, false),
        },
        localization: {
          priceFormatter,
          timeFormatter: (time) => toDisplayDate(time, true),
        },
      });

      if (mode === "candlestick") {
        const nextSeries = chart.addSeries(CandlestickSeries, {
          upColor: "#16a34a",
          downColor: "#dc2626",
          borderVisible: false,
          wickUpColor: "#16a34a",
          wickDownColor: "#dc2626",
          lastValueVisible: false,
          priceLineVisible: false,
        });
        nextSeries.setData(
          effectiveData.map<CandlestickData<Time>>((point) => ({
            time: point.chartTime,
            open: point.open,
            high: point.high,
            low: point.low,
            close: point.close,
          })),
        );
        activeSeries = nextSeries;
      } else if (mode === "histogram") {
        const nextSeries = chart.addSeries(HistogramSeries, {
          color: accentColor,
          base: 0,
          lastValueVisible: false,
          priceLineVisible: false,
        });
        nextSeries.setData(
          effectiveData.map<HistogramData<Time>>((point) => ({
            time: point.chartTime,
            value: point.value,
            color: point.color,
          })),
        );
        activeSeries = nextSeries;
      } else {
        const nextSeries = chart.addSeries(LineSeries, {
          color: accentColor,
          lineWidth: 2,
          pointMarkersVisible: false,
          lastValueVisible: false,
          priceLineVisible: false,
        });
        nextSeries.setData(
          effectiveData.map<LineData<Time>>((point) => ({
            time: point.chartTime,
            value: point.value,
            color: point.color,
          })),
        );
        activeSeries = nextSeries;
      }

      const latestPoint = effectiveData.at(-1);
      const latestHoverState: HoverState | null = latestPoint
        ? mode === "candlestick"
          ? {
              label: toDisplayDate(latestPoint.chartTime, intradaySeries),
              open: latestPoint.open,
              high: latestPoint.high,
              low: latestPoint.low,
              close: latestPoint.close,
            }
          : {
              label: toDisplayDate(latestPoint.chartTime, intradaySeries),
              price: latestPoint.value,
            }
        : null;
      onHoverChange?.(latestHoverState);

      chart.subscribeCrosshairMove(handleCrosshairMove);

      chart.timeScale().fitContent();
      lastWidthRef.current = containerRef.current.clientWidth;

      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry || !chart) {
          return;
        }
        if (entry.contentRect.width === lastWidthRef.current) {
          return;
        }
        lastWidthRef.current = entry.contentRect.width;
        chart.applyOptions({
          width: entry.contentRect.width,
        });
      });
      resizeObserver.observe(containerRef.current);
    } catch (error) {
      console.error("TradingViewChart failed to render", error);
      setRenderError("Chart unavailable for this dataset.");
      onHoverChange?.(null);
      resizeObserver?.disconnect();
      chart?.remove();
      return;
    }

    return () => {
      if (chart) {
        chart.unsubscribeCrosshairMove(handleCrosshairMove);
      }
      onHoverChange?.(null);
      resizeObserver?.disconnect();
      chart?.remove();
    };
  }, [accentColor, candlestickData, height, histogramData, intradaySeries, lineData, mode, onHoverChange, priceFormatter]);

  if (renderError) {
    return (
      <div
        className={cn(
          "flex w-full items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm text-amber-900",
          className,
        )}
        style={{ height }}
      >
        {renderError}
      </div>
    );
  }

  return <div ref={containerRef} className={cn("h-full w-full", className)} style={{ height }} />;
}
