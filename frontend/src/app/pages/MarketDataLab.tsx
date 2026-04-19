import { FormEvent, useEffect, useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DataCard, PageContainer, PageHeader, SummaryCard, SummaryGrid } from "../components/layout/index";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
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
import { Candlestick, getTickerDiagnostics, TickerDiagnostics } from "../api";

type MarketKey = "US" | "TH" | "UK" | "TW";
type PeriodKey = "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y";
type IntervalKey = "1m" | "2m" | "5m" | "15m" | "30m" | "1h" | "1d";

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

function chartData(history: Candlestick[]) {
  return history.map((bar) => ({
    time: bar.time,
    close: bar.close,
  }));
}

export function MarketDataLab() {
  const [symbol, setSymbol] = useState("AAPL");
  const [market, setMarket] = useState<MarketKey>("US");
  const [period, setPeriod] = useState<PeriodKey>("1d");
  const [interval, setInterval] = useState<IntervalKey>("5m");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [diagnostics, setDiagnostics] = useState<TickerDiagnostics | null>(null);

  async function loadDiagnostics(nextSymbol = symbol, nextMarket = market, nextPeriod = period, nextInterval = interval) {
    setLoading(true);
    setError("");
    try {
      const result = await getTickerDiagnostics(nextSymbol, nextMarket, nextPeriod, nextInterval);
      setDiagnostics(result);
    } catch (requestError) {
      setDiagnostics(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load ticker diagnostics.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDiagnostics("AAPL", "US", "1d", "5m");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadDiagnostics(symbol, market, period, interval);
  }

  const priceHistory = useMemo(() => chartData(diagnostics?.history ?? []), [diagnostics]);
  const currency = diagnostics?.currency ?? "USD";
  const latestClose = diagnostics?.history.at(-1)?.close ?? diagnostics?.price ?? 0;
  const earliestClose = diagnostics?.history.at(0)?.close ?? latestClose;
  const rangeChange = earliestClose === 0 ? 0 : ((latestClose - earliestClose) / earliestClose) * 100;

  return (
    <PageContainer>
      <PageHeader title="YFinance Lab" />

      <Card className="border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        This page queries the Java backend, which then calls the local Python <code>yfinance</code> sidecar.
        For Thai stocks, set market to <code>TH</code> and enter the plain ticker like <code>PTT</code>;
        the app resolves it to Yahoo&apos;s <code>.BK</code> symbol format.
        The default view uses intraday candles.
      </Card>

      <DataCard title="Ticker Query" className="border-gray-200">
        <form className="grid gap-4 p-4 sm:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] sm:p-6" onSubmit={handleSubmit}>
          <Input
            value={symbol}
            onChange={(event) => setSymbol(event.target.value.toUpperCase())}
            placeholder="Ticker, e.g. AAPL or PTT"
          />

          <Select value={market} onValueChange={(value) => setMarket(value as MarketKey)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="US">US</SelectItem>
              <SelectItem value="TH">TH</SelectItem>
              <SelectItem value="UK">UK</SelectItem>
              <SelectItem value="TW">TW</SelectItem>
            </SelectContent>
          </Select>

          <Select value={period} onValueChange={(value) => setPeriod(value as PeriodKey)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">1d</SelectItem>
              <SelectItem value="5d">5d</SelectItem>
              <SelectItem value="1mo">1mo</SelectItem>
              <SelectItem value="3mo">3mo</SelectItem>
              <SelectItem value="6mo">6mo</SelectItem>
              <SelectItem value="1y">1y</SelectItem>
            </SelectContent>
          </Select>

          <Select value={interval} onValueChange={(value) => setInterval(value as IntervalKey)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1m">1m</SelectItem>
              <SelectItem value="2m">2m</SelectItem>
              <SelectItem value="5m">5m</SelectItem>
              <SelectItem value="15m">15m</SelectItem>
              <SelectItem value="30m">30m</SelectItem>
              <SelectItem value="1h">1h</SelectItem>
              <SelectItem value="1d">1d</SelectItem>
            </SelectContent>
          </Select>

          <Button type="submit" disabled={loading || !symbol.trim()}>
            {loading ? "Loading..." : "Run Query"}
          </Button>
        </form>
      </DataCard>

      {error ? (
        <Card className="border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </Card>
      ) : null}

      <SummaryGrid>
        <SummaryCard label="Resolved Symbol" value={diagnostics?.normalizedSymbol ?? "Waiting..."} />
        <SummaryCard label="Last Price" value={loading ? "Loading..." : formatMoney(currency, diagnostics?.price ?? null)} />
        <SummaryCard
          label="Day Change"
          value={loading || !diagnostics ? "Loading..." : formatPercent(diagnostics.dayChangePct)}
          className={diagnostics && diagnostics.dayChangePct >= 0 ? "text-green-600" : "text-red-600"}
        />
        <SummaryCard
          label="Range Change"
          value={loading || !diagnostics ? "Loading..." : formatPercent(rangeChange)}
          className={rangeChange >= 0 ? "text-green-600" : "text-red-600"}
        />
      </SummaryGrid>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <DataCard title="History" className="border-gray-200">
          <div className="p-4 sm:p-6">
            {priceHistory.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={priceHistory}>
                  <XAxis dataKey="time" hide />
                  <YAxis
                    stroke="#9ca3af"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => formatMoney(currency, value, 0)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => [formatMoney(currency, value), "Close"]}
                    labelFormatter={(label) => String(label)}
                  />
                  <Line type="monotone" dataKey="close" stroke="#2563eb" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[280px] items-center justify-center text-sm text-gray-500">
                {loading ? "Loading history..." : "No history returned for this query."}
              </div>
            )}
          </div>
        </DataCard>

        <DataCard title="Metadata" className="border-gray-200">
          <div className="grid gap-3 p-4 text-sm sm:p-6">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">Name</p>
              <p className="mt-1 text-base text-gray-900">{diagnostics?.name ?? "Waiting..."}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-gray-200 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">Market</p>
                <p className="mt-1 text-gray-900">{diagnostics?.market ?? "N/A"}</p>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">Type</p>
                <p className="mt-1 text-gray-900">{diagnostics?.type ?? "N/A"}</p>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">Exchange</p>
                <p className="mt-1 text-gray-900">{diagnostics?.exchange ?? "N/A"}</p>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">Timezone</p>
                <p className="mt-1 text-gray-900">{diagnostics?.timezone ?? "N/A"}</p>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">Sector</p>
                <p className="mt-1 text-gray-900">{diagnostics?.sector ?? "N/A"}</p>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">Industry</p>
                <p className="mt-1 text-gray-900">{diagnostics?.industry ?? "N/A"}</p>
              </div>
            </div>
            {diagnostics?.website ? (
              <a
                className="text-sm text-blue-700 underline underline-offset-4"
                href={diagnostics.website}
                rel="noreferrer"
                target="_blank"
              >
                {diagnostics.website}
              </a>
            ) : null}
          </div>
        </DataCard>
      </div>

      <DataCard title="Price Snapshot" className="border-gray-200">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Previous Close</TableHead>
                <TableHead>Open</TableHead>
                <TableHead>Day Low</TableHead>
                <TableHead>Day High</TableHead>
                <TableHead>52W Low</TableHead>
                <TableHead>52W High</TableHead>
                <TableHead>Volume</TableHead>
                <TableHead>Avg Volume</TableHead>
                <TableHead>Market Cap</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>{formatMoney(currency, diagnostics?.previousClose ?? null)}</TableCell>
                <TableCell>{formatMoney(currency, diagnostics?.openPrice ?? null)}</TableCell>
                <TableCell>{formatMoney(currency, diagnostics?.dayLow ?? null)}</TableCell>
                <TableCell>{formatMoney(currency, diagnostics?.dayHigh ?? null)}</TableCell>
                <TableCell>{formatMoney(currency, diagnostics?.fiftyTwoWeekLow ?? null)}</TableCell>
                <TableCell>{formatMoney(currency, diagnostics?.fiftyTwoWeekHigh ?? null)}</TableCell>
                <TableCell>{formatCompactNumber(diagnostics?.volume ?? null)}</TableCell>
                <TableCell>{formatCompactNumber(diagnostics?.averageVolume ?? null)}</TableCell>
                <TableCell>{formatCompactNumber(diagnostics?.marketCap ?? null)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </DataCard>

      <DataCard title="Returned Bars" className="border-gray-200">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Time</TableHead>
                <TableHead className="text-right">Open</TableHead>
                <TableHead className="text-right">High</TableHead>
                <TableHead className="text-right">Low</TableHead>
                <TableHead className="text-right">Close</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {diagnostics?.history.length ? (
                diagnostics.history.slice(-20).reverse().map((bar) => (
                  <TableRow key={bar.time}>
                    <TableCell>{bar.time}</TableCell>
                    <TableCell className="text-right">{formatMoney(currency, bar.open)}</TableCell>
                    <TableCell className="text-right">{formatMoney(currency, bar.high)}</TableCell>
                    <TableCell className="text-right">{formatMoney(currency, bar.low)}</TableCell>
                    <TableCell className="text-right">{formatMoney(currency, bar.close)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-gray-500">
                    {loading ? "Loading bars..." : "No price bars returned."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </DataCard>
    </PageContainer>
  );
}
