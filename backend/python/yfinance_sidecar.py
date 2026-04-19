from __future__ import annotations

import json
import logging
from datetime import date, datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import parse_qs, urlparse

import yfinance as yf


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


def normalize_market(value: str | None) -> str:
    if not value:
        return "US"
    upper = value.upper()
    if upper in {"THAI", "TH"}:
        return "TH"
    return upper


def normalize_symbol(symbol: str, market: str) -> str:
    symbol = symbol.strip().upper()
    if market == "TH" and not symbol.endswith(".BK"):
        return f"{symbol}.BK"
    if market == "UK" and not symbol.endswith(".L"):
        return f"{symbol}.L"
    if market == "TW" and not symbol.endswith(".TW"):
        return f"{symbol}.TW"
    return symbol


def denormalize_symbol(symbol: str, market: str) -> str:
    if market == "TH" and symbol.endswith(".BK"):
        return symbol[:-3]
    if market == "UK" and symbol.endswith(".L"):
        return symbol[:-2]
    if market == "TW" and symbol.endswith(".TW"):
        return symbol[:-3]
    return symbol


def json_default(value: Any) -> str:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def mapping_payload(value: Any) -> dict[str, Any]:
    try:
        return dict(value) if value else {}
    except Exception:
        return {}


def safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def history_payload(symbol: str, market: str, period: str, interval: str) -> list[dict[str, Any]]:
    ticker = yf.Ticker(normalize_symbol(symbol, market))
    frame = ticker.history(period=period or "1mo", interval=interval or "1d", auto_adjust=False, actions=False)
    if frame is None or frame.empty:
        return []

    records: list[dict[str, Any]] = []
    for index, row in frame.iterrows():
        records.append(
            {
                "time": index.isoformat() if hasattr(index, "isoformat") else str(index),
                "open": float(row.get("Open", 0) or 0),
                "high": float(row.get("High", 0) or 0),
                "low": float(row.get("Low", 0) or 0),
                "close": float(row.get("Close", 0) or 0),
            }
        )
    return records


def quote_payload(symbol: str, market: str) -> dict[str, Any] | None:
    ticker_symbol = normalize_symbol(symbol, market)
    ticker = yf.Ticker(ticker_symbol)
    history = ticker.history(period="5d", interval="1d", auto_adjust=False, actions=False)
    if history is None or history.empty:
        return None

    info = {}
    try:
        info = ticker.get_info() or {}
    except Exception:
        info = {}

    close = float(history["Close"].iloc[-1] or 0)
    prev_close = float(history["Close"].iloc[-2] or close) if len(history.index) > 1 else close
    day_change_pct = 0.0 if prev_close == 0 else ((close - prev_close) / prev_close) * 100
    return {
        "symbol": denormalize_symbol(ticker_symbol, market),
        "name": info.get("longName") or info.get("shortName") or denormalize_symbol(ticker_symbol, market),
        "market": market,
        "type": info.get("quoteType") or info.get("instrumentType") or "Stock",
        "currency": info.get("currency") or "USD",
        "price": close,
        "dayChangePct": day_change_pct,
    }


def inspect_payload(symbol: str, market: str, period: str, interval: str) -> dict[str, Any] | None:
    ticker_symbol = normalize_symbol(symbol, market)
    ticker = yf.Ticker(ticker_symbol)
    quote = quote_payload(symbol, market)
    if quote is None:
        return None

    history = history_payload(symbol, market, period, interval)
    try:
        info = ticker.get_info() or {}
    except Exception:
        info = {}
    fast_info = mapping_payload(getattr(ticker, "fast_info", None))

    return {
        "requestedSymbol": symbol.strip().upper(),
        "normalizedSymbol": ticker_symbol,
        "symbol": quote["symbol"],
        "market": market,
        "name": quote["name"],
        "type": quote["type"],
        "currency": quote["currency"],
        "price": quote["price"],
        "dayChangePct": quote["dayChangePct"],
        "exchange": info.get("fullExchangeName") or info.get("exchange"),
        "timezone": info.get("exchangeTimezoneName") or fast_info.get("timezone"),
        "previousClose": safe_float(fast_info.get("previousClose") or info.get("previousClose")),
        "openPrice": safe_float(fast_info.get("open") or info.get("open")),
        "dayHigh": safe_float(fast_info.get("dayHigh") or info.get("dayHigh")),
        "dayLow": safe_float(fast_info.get("dayLow") or info.get("dayLow")),
        "fiftyTwoWeekHigh": safe_float(fast_info.get("yearHigh") or info.get("fiftyTwoWeekHigh")),
        "fiftyTwoWeekLow": safe_float(fast_info.get("yearLow") or info.get("fiftyTwoWeekLow")),
        "volume": safe_float(fast_info.get("lastVolume") or info.get("volume")),
        "averageVolume": safe_float(fast_info.get("tenDayAverageVolume") or info.get("averageVolume")),
        "marketCap": safe_float(fast_info.get("marketCap") or info.get("marketCap")),
        "sector": info.get("sector") or info.get("sectorDisp"),
        "industry": info.get("industry") or info.get("industryDisp"),
        "website": info.get("website"),
        "history": history,
    }


def search_payload(query: str, market: str, types: list[str]) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    try:
        search = yf.Search(query=query, max_results=12)
        quotes = getattr(search, "quotes", None) or []
    except Exception:
        quotes = []

    for item in quotes:
        symbol = item.get("symbol")
        if not symbol:
            continue
        quote_market = normalize_market(item.get("exchange", market))
        if market and market != "US":
            if market == "TH" and not symbol.endswith(".BK"):
                continue
            if market == "UK" and not symbol.endswith(".L"):
                continue
            if market == "TW" and not symbol.endswith(".TW"):
                continue
        quote_type = item.get("quoteType") or item.get("typeDisp") or "Stock"
        if types and quote_type not in types and quote_type.upper() not in {value.upper() for value in types}:
            continue
        payload = quote_payload(symbol, quote_market)
        if payload:
            payload["name"] = item.get("shortname") or item.get("longname") or payload["name"]
            payload["type"] = quote_type
            results.append(payload)
        if len(results) >= 8:
            break

    if not results:
        fallback = quote_payload(query, market)
        if fallback:
            results.append(fallback)
    return results


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        market = normalize_market(params.get("market", ["US"])[0])

        try:
            if parsed.path == "/internal/market/quote":
                symbol = params.get("symbol", [""])[0]
                payload = quote_payload(symbol, market)
                if payload is None:
                    self.respond(HTTPStatus.NOT_FOUND, {"error": "Quote not found"})
                    return
                self.respond(HTTPStatus.OK, payload)
                return

            if parsed.path == "/internal/market/search":
                query = params.get("query", [""])[0]
                types = params.get("type", [])
                self.respond(HTTPStatus.OK, search_payload(query, market, types))
                return

            if parsed.path == "/internal/market/history":
                symbol = params.get("symbol", [""])[0]
                period = params.get("period", ["1mo"])[0]
                interval = params.get("interval", ["1d"])[0]
                self.respond(HTTPStatus.OK, history_payload(symbol, market, period, interval))
                return

            if parsed.path == "/internal/market/inspect":
                symbol = params.get("symbol", [""])[0]
                period = params.get("period", ["1mo"])[0]
                interval = params.get("interval", ["1d"])[0]
                payload = inspect_payload(symbol, market, period, interval)
                if payload is None:
                    self.respond(HTTPStatus.NOT_FOUND, {"error": "Ticker not found"})
                    return
                self.respond(HTTPStatus.OK, payload)
                return

            self.respond(HTTPStatus.NOT_FOUND, {"error": "Unknown endpoint"})
        except Exception as exc:  # noqa: BLE001
            logging.exception("sidecar request failed")
            self.respond(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(exc)})

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A003
        logging.info("%s - %s", self.address_string(), format % args)

    def respond(self, status: HTTPStatus, payload: Any) -> None:
        body = json.dumps(payload, default=json_default).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", 9001), Handler)
    logging.info("yfinance sidecar listening on http://127.0.0.1:9001")
    server.serve_forever()


if __name__ == "__main__":
    main()
