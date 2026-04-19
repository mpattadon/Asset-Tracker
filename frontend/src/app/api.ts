const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const DEV_USER_ID = import.meta.env.VITE_DEV_USER_ID ?? "";

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

export interface StockTransactionView {
  id: string;
  transactionType: "BUY" | "SELL" | "DIVIDEND" | string;
  date: string;
  symbol: string;
  name: string;
  market: string;
  currency: string;
  quantity: number | null;
  pricePerUnit: number | null;
  feeNetUsd: number | null;
  feeNetThb: number | null;
  fxActualRate: number | null;
  fxDimeRate: number | null;
  usdActual: number | null;
  bahtActual: number | null;
  totalUsd: number | null;
  totalBahtDime: number | null;
  netPricePerShare: number | null;
  realizedPnl: number | null;
  realizedPnlPct: number | null;
  unitsEntitled: number | null;
  dividendPerShare: number | null;
  grossDividend: number | null;
  withholdingTaxRate: number | null;
  withholdingTaxAmount: number | null;
  netDividend: number | null;
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

export interface CreateStockTransactionPayload {
  transactionType: "BUY" | "SELL" | "DIVIDEND";
  symbol: string;
  name: string;
  market: string;
  type: string;
  currency: string;
  transactionDate: string;
  quantity?: number | null;
  pricePerUnit?: number | null;
  feeNetUsd?: number | null;
  feeNetThb?: number | null;
  fxActualRate?: number | null;
  fxDimeRate?: number | null;
  dividendPerShare?: number | null;
  withholdingTaxRate?: number | null;
}

export interface SyncStatus {
  providerType: string;
  providerFileId: string | null;
  revision: string | null;
  status: string;
  lastPullAt: string | null;
  lastPushAt: string | null;
  lastError: string | null;
}

export interface AuthState {
  setupRequired: boolean;
  authenticated: boolean;
  authProvider: string | null;
  externalUserId: string | null;
  email: string | null;
  displayName: string | null;
  syncStatus: SyncStatus | null;
}

export interface RegisterLocalPayload {
  username: string;
  password: string;
  email?: string;
}

export interface LoginLocalPayload {
  username: string;
  password: string;
}

export interface ShareStatus {
  privateHostRunning: boolean;
  shareEnabled: boolean;
  privateUrl: string | null;
  shareUrl: string | null;
  frontendAvailable: boolean;
}

export interface TickerDiagnostics {
  requestedSymbol: string;
  normalizedSymbol: string;
  market: string;
  name: string;
  type: string;
  currency: string;
  price: number;
  dayChangePct: number;
  exchange: string | null;
  timezone: string | null;
  previousClose: number | null;
  openPrice: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  volume: number | null;
  averageVolume: number | null;
  marketCap: number | null;
  sector: string | null;
  industry: string | null;
  website: string | null;
  history: Candlestick[];
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  if (DEV_USER_ID) {
    headers.set("X-User-Id", DEV_USER_ID);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers,
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

export function getStockTransactions(market: string) {
  return apiFetch<StockTransactionView[]>(
    `/api/stocks/markets/${encodeURIComponent(market)}/transactions`,
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

export function addStockTransaction(market: string, payload: CreateStockTransactionPayload) {
  return apiFetch<StockTransactionView>(
    `/api/stocks/markets/${encodeURIComponent(market)}/transactions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
}

export function getAuthBootstrap() {
  return apiFetch<AuthState>("/api/auth/bootstrap");
}

export function registerLocal(payload: RegisterLocalPayload) {
  return apiFetch<AuthState>("/api/auth/register/local", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function loginLocal(payload: LoginLocalPayload) {
  return apiFetch<AuthState>("/api/auth/login/local", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function logout() {
  return apiFetch<AuthState>("/api/auth/logout", {
    method: "POST",
  });
}

export function getShareStatus() {
  return apiFetch<ShareStatus>("/api/app/share/status");
}

export function startShare() {
  return apiFetch<ShareStatus>("/api/app/share/start", {
    method: "POST",
  });
}

export function stopShare() {
  return apiFetch<ShareStatus>("/api/app/share/stop", {
    method: "POST",
  });
}

export function getTickerDiagnostics(
  symbol: string,
  market: string,
  period: string,
  interval: string,
) {
  const params = new URLSearchParams({
    symbol,
    market,
    period,
    interval,
  });
  return apiFetch<TickerDiagnostics>(`/api/stocks/inspect?${params.toString()}`);
}
