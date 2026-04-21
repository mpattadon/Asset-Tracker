const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const DEV_USER_ID = import.meta.env.VITE_DEV_USER_ID ?? "";
const PREFERRED_CURRENCY_STORAGE_KEY = "asset-tracker.preferred-currency";

export interface SummaryCard {
  label: string;
  value: string;
  delta: string;
  amount?: number | null;
  currency?: string | null;
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
  intradayHistory: Candlestick[];
  dailyHistory: Candlestick[];
  performanceIntradayHistory: Candlestick[];
  performanceDailyHistory: Candlestick[];
}

export interface StockPortfolio {
  id: string;
  name: string;
  market: string | null;
  currency: string | null;
}

export interface CreateStockPortfolioPayload {
  name: string;
  currency: string;
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
  portfolioId: string;
  portfolioName: string;
  assetType: string;
  exDate: string | null;
  currency: string;
  quantity: number | null;
  pricePerUnit: number | null;
  feeNetUsd: number | null;
  feeNetThb: number | null;
  feeNetLocal: number | null;
  feeVatLocal: number | null;
  atsFeeLocal: number | null;
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
  marketLayout?: "US" | "TH";
  portfolioId?: string | null;
  type: string;
  currency: string;
  exDate?: string | null;
  transactionDate: string;
  quantity?: number | null;
  pricePerUnit?: number | null;
  feeNetUsd?: number | null;
  feeNetThb?: number | null;
  feeNetLocal?: number | null;
  feeVatLocal?: number | null;
  atsFeeLocal?: number | null;
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
  rememberMe?: boolean;
}

export interface LoginLocalPayload {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface UsernameLookupPayload {
  username: string;
}

export interface UsernameLookupResponse {
  found: boolean;
}

export interface PasswordResetPayload {
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

export interface ExchangeRate {
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  inverseRate: number;
}

export interface StockChartData {
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
  longBusinessSummary: string | null;
  headquarters: string | null;
  country: string | null;
  ceo: string | null;
  fullTimeEmployees: number | null;
  beta: number | null;
  trailingPe: number | null;
  forwardPe: number | null;
  trailingEps: number | null;
  forwardEps: number | null;
  dividendYield: number | null;
  fiftyDayAverage: number | null;
  twoHundredDayAverage: number | null;
  sharesOutstanding: number | null;
  news: {
    title: string | null;
    publisher: string | null;
    link: string | null;
    publishedAt: string | null;
    summary: string | null;
  }[];
  incomeStatement: {
    title: string;
    periods: string[];
    rows: {
      label: string;
      values: (number | null)[];
    }[];
  } | null;
  balanceSheet: {
    title: string;
    periods: string[];
    rows: {
      label: string;
      values: (number | null)[];
    }[];
  } | null;
  cashFlow: {
    title: string;
    periods: string[];
    rows: {
      label: string;
      values: (number | null)[];
    }[];
  } | null;
  intradayHistory: Candlestick[];
  dailyHistory: Candlestick[];
}

export interface StockChartDetails {
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
  longBusinessSummary: string | null;
  headquarters: string | null;
  country: string | null;
  ceo: string | null;
  fullTimeEmployees: number | null;
  beta: number | null;
  trailingPe: number | null;
  forwardPe: number | null;
  trailingEps: number | null;
  forwardEps: number | null;
  dividendYield: number | null;
  fiftyDayAverage: number | null;
  twoHundredDayAverage: number | null;
  sharesOutstanding: number | null;
  news: {
    title: string | null;
    publisher: string | null;
    link: string | null;
    publishedAt: string | null;
    summary: string | null;
  }[];
  incomeStatement: StockChartData["incomeStatement"];
  balanceSheet: StockChartData["balanceSheet"];
  cashFlow: StockChartData["cashFlow"];
}

export interface StockChartHistory {
  dailyHistory: Candlestick[];
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  if (DEV_USER_ID) {
    headers.set("X-User-Id", DEV_USER_ID);
  }
  if (typeof window !== "undefined") {
    const preferredCurrency = window.localStorage.getItem(PREFERRED_CURRENCY_STORAGE_KEY);
    if (preferredCurrency) {
      headers.set("X-Preferred-Currency", preferredCurrency);
    }
  }

  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers,
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    let message = "";

    if (contentType.includes("application/json")) {
      const payload = await response.json().catch(() => null) as { message?: string; error?: string } | null;
      message = payload?.message || payload?.error || "";
    } else {
      message = await response.text();
    }

    const normalized = message.trim().toLowerCase() === "ticker not found"
      ? "Ticker Not Found"
      : message.trim();

    throw new Error(normalized || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength === "0") {
    return null as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await response.text();
    return (text ? (text as T) : null) as T;
  }

  const body = await response.text();
  if (!body.trim()) {
    return null as T;
  }

  return JSON.parse(body) as T;
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

export function getStockPortfolios() {
  return apiFetch<StockPortfolio[]>("/api/stocks/portfolios");
}

export function createStockPortfolio(payload: CreateStockPortfolioPayload) {
  return apiFetch<StockPortfolio>("/api/stocks/portfolios", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function deleteStockPortfolio(portfolioId: string) {
  return apiFetch<void>(`/api/stocks/portfolios/${encodeURIComponent(portfolioId)}`, {
    method: "DELETE",
  });
}

export function getPortfolioStockSummary(portfolioId?: string) {
  const params = new URLSearchParams();
  if (portfolioId && portfolioId !== "all") {
    params.set("portfolioId", portfolioId);
  }
  const query = params.toString();
  return apiFetch<StockSummary>(`/api/stocks/summary${query ? `?${query}` : ""}`);
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

export function getPortfolioStockHoldings(
  portfolioId?: string,
  sortByDay = false,
) {
  const params = new URLSearchParams();
  if (portfolioId && portfolioId !== "all") {
    params.set("portfolioId", portfolioId);
  }
  if (sortByDay) {
    params.set("sort", "dayChangePct");
  }
  const query = params.toString();
  return apiFetch<StockPositionView[]>(`/api/stocks/holdings${query ? `?${query}` : ""}`);
}

export function getPortfolioStockTransactions(portfolioId?: string) {
  const params = new URLSearchParams();
  if (portfolioId && portfolioId !== "all") {
    params.set("portfolioId", portfolioId);
  }
  const query = params.toString();
  return apiFetch<StockTransactionView[]>(`/api/stocks/transactions${query ? `?${query}` : ""}`);
}

export function searchStocks(query: string, market?: string) {
  const params = new URLSearchParams({
    query,
  });
  if (market && market.trim()) {
    params.set("market", market);
  }
  return apiFetch<QuoteResult[]>(`/api/stocks/search?${params.toString()}`);
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

export function addPortfolioStockTransaction(portfolioId: string, payload: CreateStockTransactionPayload) {
  const params = new URLSearchParams({
    portfolioId,
  });
  return apiFetch<StockTransactionView>(`/api/stocks/transactions?${params.toString()}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function updateStockTransaction(transactionId: string, payload: CreateStockTransactionPayload) {
  return apiFetch<StockTransactionView>(`/api/stocks/transactions/${encodeURIComponent(transactionId)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
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

export function checkLocalUsername(payload: UsernameLookupPayload) {
  return apiFetch<UsernameLookupResponse>("/api/auth/password-reset/local/check", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function resetLocalPassword(payload: PasswordResetPayload) {
  return apiFetch<{ success: boolean }>("/api/auth/password-reset/local", {
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

export function getExchangeRate(base: string, quote: string) {
  const params = new URLSearchParams({ base, quote });
  return apiFetch<ExchangeRate>(`/api/market/fx?${params.toString()}`);
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

export function getStockChartData(symbol: string, market: string) {
  const params = new URLSearchParams({
    symbol,
    market,
  });
  return apiFetch<StockChartData>(`/api/stocks/chart-data?${params.toString()}`);
}

export function getStockChartDetails(symbol: string, market: string) {
  const params = new URLSearchParams({
    symbol,
    market,
  });
  return apiFetch<StockChartDetails>(`/api/stocks/details?${params.toString()}`);
}

export function getStockChartHistory(symbol: string, market: string) {
  const params = new URLSearchParams({
    symbol,
    market,
  });
  return apiFetch<StockChartHistory>(`/api/stocks/chart-history?${params.toString()}`);
}
