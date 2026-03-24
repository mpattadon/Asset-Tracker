const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const DEV_USER_ID = "user-123";

export interface SummaryCard {
  label: string;
  value: string;
  delta: string;
}

export interface AllocationItem {
  area: string;
  percent: number;
  color: string;
}

export interface SummaryData {
  cards: SummaryCard[];
  allocation: AllocationItem[];
}

export interface StockSeedHolding {
  symbol: string;
  name: string;
  market: string;
  type: string;
  price: number;
  quantity: number;
  avgCost: number;
  dayChangePct: number;
  currency: string;
}

export interface StockLot {
  id: string;
  symbol: string;
  name: string;
  market: string;
  type: string;
  currency: string;
  purchaseDate: string;
  purchasePrice: number;
  quantity: number;
}

export interface Candlestick {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface StockMarketSeed {
  title: string;
  currency: string;
  value: number;
  dayChange: number;
  dayChangePct: number;
  totalChange: number;
  totalChangePct: number;
  breakdown: { label: string; value: number; color: string }[];
  performance: { change: string; series: number[] };
  series: number[];
  candlesticks: Candlestick[];
  holdings: StockSeedHolding[];
  lots: StockLot[];
}

export interface StockSummary {
  market: string;
  title: string;
  currency: string;
  totalValue: number;
  dayChange: number;
  dayChangePct: number;
  totalChange: number;
  totalChangePct: number;
  series: number[];
  candlesticks: Candlestick[];
}

export interface StockLotView {
  id: string;
  purchaseDate: string;
  purchasePrice: number;
  quantity: number;
  currentPrice: number;
  dayGain: number;
  dayChangePct: number;
  value: number;
}

export interface StockPositionView {
  symbol: string;
  name: string;
  market: string;
  type: string;
  currency: string;
  price: number;
  quantity: number;
  dayGain: number;
  dayChangePct: number;
  value: number;
  totalChange: number;
  totalChangePct: number;
  lots: StockLotView[];
}

export interface QuoteResult {
  symbol: string;
  name: string;
  market: string;
  type: string;
  currency: string;
  price: number;
  dayChangePct: number;
}

export interface AddHoldingPayload {
  symbol: string;
  name: string;
  market: string;
  type: string;
  currency: string;
  purchaseDate: string;
  quantity: number;
  purchasePrice: number;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "X-User-Id": DEV_USER_ID,
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}

export function getAssetSummary() {
  return apiFetch<SummaryData>("/api/assets/summary");
}

export function getStockSeed(market: string) {
  return apiFetch<StockMarketSeed>(`/api/assets/stocks?market=${encodeURIComponent(market)}`);
}

export function getStockSummary(market: string) {
  return apiFetch<StockSummary>(`/api/stocks/markets/${encodeURIComponent(market)}/summary`);
}

export function getStockHoldings(market: string, sortByDay = false) {
  const query = sortByDay ? "?sort=dayChangePct" : "";
  return apiFetch<StockPositionView[]>(
    `/api/stocks/markets/${encodeURIComponent(market)}/holdings${query}`,
  );
}

export function searchStocks(query: string, market: string) {
  return apiFetch<QuoteResult[]>(
    `/api/stocks/search?query=${encodeURIComponent(query)}&market=${encodeURIComponent(market)}`,
  );
}

export function addHolding(market: string, payload: AddHoldingPayload) {
  return apiFetch<StockPositionView>(`/api/stocks/markets/${encodeURIComponent(market)}/holdings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}
