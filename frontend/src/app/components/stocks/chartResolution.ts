import { Candlestick } from "../../api";

export type ChartRangeKey = "1D" | "5D" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "5Y" | "All";
export type ChartResolution = "5m" | "15m" | "1h" | "4h" | "1d" | "1w" | "1mo";

export function resolutionOptionsForRange(range: ChartRangeKey): ChartResolution[] {
  switch (range) {
    case "1D":
      return ["5m", "15m", "1h"];
    case "5D":
      return ["15m", "1h", "4h", "1d"];
    case "1M":
    case "3M":
      return ["1d", "1w"];
    case "6M":
    case "YTD":
    case "1Y":
      return ["1d", "1w"];
    case "5Y":
    case "All":
      return ["1w", "1mo"];
    default:
      return ["1d"];
  }
}

export function defaultResolutionForRange(range: ChartRangeKey): ChartResolution {
  switch (range) {
    case "1D":
      return "5m";
    case "5D":
      return "1h";
    case "1M":
    case "3M":
      return "1d";
    case "6M":
    case "YTD":
    case "1Y":
      return "1w";
    case "5Y":
    case "All":
      return "1mo";
    default:
      return "1d";
  }
}

export function formatResolutionLabel(resolution: ChartResolution) {
  return resolution.toUpperCase();
}

function epochMillis(rawTime: string) {
  const parsed = Date.parse(rawTime);
  if (!Number.isNaN(parsed)) {
    return parsed;
  }
  const fallback = Date.parse(`${rawTime}T00:00:00Z`);
  return Number.isNaN(fallback) ? 0 : fallback;
}

function dayBucketStart(timestamp: number) {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function weekBucketStart(timestamp: number) {
  const date = new Date(dayBucketStart(timestamp));
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + offset);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function monthBucketStart(timestamp: number) {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

function intradayBucketStart(timestamp: number, minutes: number) {
  const interval = minutes * 60 * 1000;
  return Math.floor(timestamp / interval) * interval;
}

function bucketStart(timestamp: number, resolution: ChartResolution) {
  switch (resolution) {
    case "5m":
      return intradayBucketStart(timestamp, 5);
    case "15m":
      return intradayBucketStart(timestamp, 15);
    case "1h":
      return intradayBucketStart(timestamp, 60);
    case "4h":
      return intradayBucketStart(timestamp, 240);
    case "1d":
      return dayBucketStart(timestamp);
    case "1w":
      return weekBucketStart(timestamp);
    case "1mo":
      return monthBucketStart(timestamp);
    default:
      return timestamp;
  }
}

function bucketTimeLabel(bucket: number, resolution: ChartResolution) {
  if (resolution === "1d" || resolution === "1w" || resolution === "1mo") {
    return new Date(bucket).toISOString().slice(0, 10);
  }
  return new Date(bucket).toISOString();
}

export function aggregateCandles(history: Candlestick[], resolution: ChartResolution) {
  if (!history.length) {
    return history;
  }

  const next: Candlestick[] = [];
  let currentBucket: number | null = null;
  let current: Candlestick | null = null;

  for (const bar of history) {
    const timestamp = epochMillis(bar.time);
    const bucket = bucketStart(timestamp, resolution);
    if (currentBucket !== bucket || !current) {
      if (current) {
        next.push(current);
      }
      currentBucket = bucket;
      current = {
        time: bucketTimeLabel(bucket, resolution),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      };
      continue;
    }

    current.high = Math.max(current.high, bar.high);
    current.low = Math.min(current.low, bar.low);
    current.close = bar.close;
  }

  if (current) {
    next.push(current);
  }

  return next;
}
