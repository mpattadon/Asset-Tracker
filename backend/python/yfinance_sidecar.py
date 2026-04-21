from __future__ import annotations

import copy
import json
import logging
import math
import threading
import time
from datetime import date, datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import parse_qs, urlparse

import pandas as pd
import yfinance as yf


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

SEARCH_CACHE_TTL_SECONDS = 300
INSPECT_CACHE_TTL_SECONDS = 300
SEARCH_CACHE_VERSION = "v4"
SIDECAR_VERSION = "2026-04-21-search-v4"

_search_cache: dict[tuple[str, str | None, tuple[str, ...]], tuple[float, list[dict[str, Any]]]] = {}
_inspect_cache: dict[tuple[str, str, str, str], tuple[float, dict[str, Any]]] = {}
_cache_lock = threading.Lock()


def normalize_market(value: str | None) -> str:
    if not value:
        return "US"
    upper = value.upper()
    if upper in {"THAI", "TH"}:
        return "TH"
    return upper


def market_from_symbol(symbol: str | None) -> str | None:
    normalized = (symbol or "").strip().upper()
    if not normalized:
        return None
    if ":" in normalized:
        prefix = normalized.split(":", 1)[0]
        if prefix == "SET":
            return "TH"
        return prefix
    if "." in normalized:
        suffix = normalized.rsplit(".", 1)[1]
        if suffix == "BK":
            return "TH"
        if suffix == "L":
            return "UK"
        if suffix == "TW":
            return "TW"
        return suffix
    return None


def normalize_symbol(symbol: str, market: str) -> str:
    symbol = symbol.strip().upper()
    if ":" in symbol:
        symbol = symbol.split(":")[-1]
    if market == "TH" and not symbol.endswith(".BK"):
        return f"{symbol}.BK"
    if market == "UK" and not symbol.endswith(".L"):
        return f"{symbol}.L"
    if market == "TW" and not symbol.endswith(".TW"):
        return f"{symbol}.TW"
    return symbol


def denormalize_symbol(symbol: str, market: str) -> str:
    if ":" in symbol:
        symbol = symbol.split(":")[-1]
    if market == "TH" and symbol.endswith(".BK"):
        return symbol[:-3]
    if market == "UK" and symbol.endswith(".L"):
        return symbol[:-2]
    if market == "TW" and symbol.endswith(".TW"):
        return symbol[:-3]
    return symbol


def canonical_symbol(symbol: str | None) -> str:
    normalized = (symbol or "").strip().upper()
    if ":" in normalized:
        normalized = normalized.split(":", 1)[1]
    if "." in normalized:
        normalized = normalized.split(".", 1)[0]
    return normalized


def infer_market(symbol: str | None, exchange: str | None) -> str:
    normalized_symbol = (symbol or "").upper()
    normalized_exchange = (exchange or "").upper()
    derived_market = market_from_symbol(normalized_symbol)
    if derived_market:
        return derived_market
    if normalized_symbol.endswith(".BK") or any(token in normalized_exchange for token in {"BANGKOK", "THAILAND", "SET"}):
        return "TH"
    if normalized_symbol.endswith(".L") or any(token in normalized_exchange for token in {"LONDON", "LSE"}):
        return "UK"
    if normalized_symbol.endswith(".TW") or any(token in normalized_exchange for token in {"TAIWAN", "TPE"}):
        return "TW"
    return "US"


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
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(numeric) or math.isinf(numeric):
        return None
    return numeric


def safe_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        numeric = int(value)
    except (TypeError, ValueError):
        return None
    return numeric


def first_non_empty(*values: Any) -> str | None:
    for value in values:
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return None


def latest_symbol_price(symbol: str) -> float | None:
    ticker = yf.Ticker(symbol)
    fast_info = mapping_payload(getattr(ticker, "fast_info", None))
    price = safe_float(fast_info.get("lastPrice") or fast_info.get("regularMarketPrice"))
    if price is not None and price > 0:
        return price
    try:
        history = ticker.history(period="5d", interval="1d", auto_adjust=False, actions=False)
    except Exception:
        history = None
    if history is None or history.empty:
        return None
    try:
        close = safe_float(history["Close"].iloc[-1])
    except Exception:
        close = None
    return close if close and close > 0 else None


def compact_location(info: dict[str, Any]) -> tuple[str | None, str | None]:
    country = first_non_empty(info.get("country"))
    parts = [
        first_non_empty(info.get("city")),
        first_non_empty(info.get("state")),
        country,
    ]
    filtered = [part for part in parts if part]
    return (", ".join(filtered) if filtered else None, country)


def ceo_name(info: dict[str, Any]) -> str | None:
    officers = info.get("companyOfficers") or []
    if not isinstance(officers, list):
        return None
    for officer in officers:
        if not isinstance(officer, dict):
            continue
        title = first_non_empty(officer.get("title"), officer.get("maxAge"))
        name = first_non_empty(officer.get("name"))
        if name and title and "CEO" in title.upper():
            return name
    for officer in officers:
        if isinstance(officer, dict):
            name = first_non_empty(officer.get("name"))
            if name:
                return name
    return None


def news_payload(ticker: yf.Ticker, limit: int = 5) -> list[dict[str, Any]]:
    try:
        items = ticker.get_news(count=limit, tab="news") or []
    except Exception:
        return []

    news_items: list[dict[str, Any]] = []
    for item in items[:limit]:
        if not isinstance(item, dict):
            continue
        content = item.get("content") if isinstance(item.get("content"), dict) else item
        canonical_url = content.get("canonicalUrl") if isinstance(content.get("canonicalUrl"), dict) else {}
        click_through = content.get("clickThroughUrl") if isinstance(content.get("clickThroughUrl"), dict) else {}
        link = first_non_empty(
            click_through.get("url"),
            canonical_url.get("url"),
            content.get("link"),
            item.get("link"),
        )
        published_at = None
        publish_time = safe_int(content.get("providerPublishTime") or item.get("providerPublishTime"))
        if publish_time is not None:
            published_at = datetime.fromtimestamp(publish_time).isoformat()

        news_items.append(
            {
                "title": first_non_empty(content.get("title"), item.get("title")),
                "publisher": first_non_empty(content.get("publisher"), item.get("publisher")),
                "link": link,
                "publishedAt": published_at,
                "summary": first_non_empty(content.get("summary"), item.get("summary")),
            }
        )
    return news_items


def cache_get(cache: dict[Any, tuple[float, Any]], key: Any, ttl_seconds: int) -> Any:
    with _cache_lock:
        cached = cache.get(key)
        if not cached:
            return None
        created_at, payload = cached
        if time.time() - created_at > ttl_seconds:
            cache.pop(key, None)
            return None
        return copy.deepcopy(payload)


def cache_put(cache: dict[Any, tuple[float, Any]], key: Any, payload: Any) -> Any:
    stored = copy.deepcopy(payload)
    with _cache_lock:
        cache[key] = (time.time(), stored)
    return copy.deepcopy(stored)


def format_period_label(value: Any) -> str:
    if value is None:
        return ""
    if hasattr(value, "strftime"):
        try:
            return value.strftime("%Y-%m-%d")
        except Exception:
            pass
    return str(value)


def financial_statement_payload(title: str, frame: Any, max_periods: int = 6) -> dict[str, Any]:
    if frame is None or getattr(frame, "empty", True):
        return {"title": title, "periods": [], "rows": []}

    try:
        subset = frame.iloc[:, :max_periods]
    except Exception:
        return {"title": title, "periods": [], "rows": []}

    periods = [format_period_label(column) for column in list(subset.columns)]
    rows: list[dict[str, Any]] = []
    for index, row in subset.iterrows():
        values: list[float | None] = []
        has_value = False
        for value in row.tolist():
            numeric = safe_float(value)
            values.append(numeric)
            if numeric is not None:
                has_value = True
        if has_value:
            rows.append(
                {
                    "label": str(index),
                    "values": values,
                }
            )

    return {
        "title": title,
        "periods": periods,
        "rows": rows,
    }


def history_payload(
    symbol: str,
    market: str,
    period: str,
    interval: str,
    start: str | None = None,
    end: str | None = None,
) -> list[dict[str, Any]]:
    ticker = yf.Ticker(normalize_symbol(symbol, market))
    history_kwargs: dict[str, Any] = {
        "interval": interval or "1d",
        "auto_adjust": False,
        "actions": False,
    }
    if start or end:
        if start:
            history_kwargs["start"] = datetime.fromisoformat(start.replace("Z", "+00:00"))
        if end:
            history_kwargs["end"] = datetime.fromisoformat(end.replace("Z", "+00:00"))
    else:
        history_kwargs["period"] = period or "1mo"
    frame = ticker.history(**history_kwargs)
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


def quote_payload_fast(symbol: str, market: str) -> dict[str, Any] | None:
    ticker_symbol = normalize_symbol(symbol, market)
    ticker = yf.Ticker(ticker_symbol)
    fast_info = mapping_payload(getattr(ticker, "fast_info", None))
    close = safe_float(fast_info.get("lastPrice") or fast_info.get("regularMarketPrice"))
    prev_close = safe_float(fast_info.get("previousClose"))

    history = None
    if close is None or prev_close is None:
        history = ticker.history(period="5d", interval="1d", auto_adjust=False, actions=False)
        if history is None or history.empty:
            return None
        close = close if close is not None else float(history["Close"].iloc[-1] or 0)
        prev_close = (
            prev_close
            if prev_close is not None
            else float(history["Close"].iloc[-2] or close) if len(history.index) > 1 else close
        )

    day_change_pct = 0.0 if prev_close == 0 else ((close - prev_close) / prev_close) * 100
    return {
        "symbol": denormalize_symbol(ticker_symbol, market),
        "name": denormalize_symbol(ticker_symbol, market),
        "market": market,
        "type": "Stock",
        "currency": fast_info.get("currency") or ("THB" if market == "TH" else "USD"),
        "price": close,
        "dayChangePct": day_change_pct,
    }


def quote_payload(symbol: str, market: str) -> dict[str, Any] | None:
    base_payload = quote_payload_fast(symbol, market)
    if base_payload is None:
        return None

    ticker_symbol = normalize_symbol(symbol, market)
    ticker = yf.Ticker(ticker_symbol)
    try:
        info = ticker.get_info() or {}
    except Exception:
        info = {}

    if info:
        base_payload["name"] = info.get("longName") or info.get("shortName") or base_payload["name"]
        base_payload["type"] = info.get("quoteType") or info.get("instrumentType") or base_payload["type"]
        base_payload["currency"] = info.get("currency") or base_payload["currency"]
    return base_payload


def fx_rate_payload(base_currency: str, quote_currency: str) -> dict[str, Any] | None:
    base = (base_currency or "").strip().upper()
    quote = (quote_currency or "").strip().upper()
    if not base or not quote:
        return None
    if base == quote:
        return {
            "baseCurrency": base,
            "quoteCurrency": quote,
            "rate": 1.0,
            "inverseRate": 1.0,
            "pairSymbol": f"{base}{quote}=X",
        }

    direct_symbol = f"{base}{quote}=X"
    direct_rate = latest_symbol_price(direct_symbol)
    if direct_rate and direct_rate > 0:
        return {
            "baseCurrency": base,
            "quoteCurrency": quote,
            "rate": direct_rate,
            "inverseRate": 1 / direct_rate,
            "pairSymbol": direct_symbol,
        }

    inverse_symbol = f"{quote}{base}=X"
    inverse_rate = latest_symbol_price(inverse_symbol)
    if inverse_rate and inverse_rate > 0:
        rate = 1 / inverse_rate
        return {
            "baseCurrency": base,
            "quoteCurrency": quote,
            "rate": rate,
            "inverseRate": inverse_rate,
            "pairSymbol": inverse_symbol,
        }
    return None


def exact_search_candidates(query: str, requested_market: str | None) -> list[tuple[str, str]]:
    normalized_query = query.strip().upper()
    if not normalized_query:
        return []

    if requested_market:
        return [(normalized_query, requested_market)]

    derived_market = market_from_symbol(normalized_query)
    if derived_market:
        return [(normalized_query, derived_market)]

    # Favor the markets this app supports most directly for naked ticker input.
    return [
        (normalized_query, "TH"),
        (normalized_query, "US"),
        (normalized_query, "UK"),
        (normalized_query, "TW"),
    ]


def market_rank(market: str) -> int:
    return {
        "TH": 0,
        "US": 1,
        "UK": 2,
        "TW": 3,
    }.get(market, 10)


def inspect_payload(symbol: str, market: str, period: str, interval: str) -> dict[str, Any] | None:
    cache_key = (symbol.strip().upper(), market, period, interval)
    cached = cache_get(_inspect_cache, cache_key, INSPECT_CACHE_TTL_SECONDS)
    if cached is not None:
        return cached
    ticker_symbol = normalize_symbol(symbol, market)
    ticker = yf.Ticker(ticker_symbol)
    quote = quote_payload_fast(symbol, market)
    if quote is None:
        return None
    try:
        info = ticker.get_info() or {}
    except Exception:
        info = {}
    fast_info = mapping_payload(getattr(ticker, "fast_info", None))
    headquarters, country = compact_location(info)
    try:
        income_stmt = ticker.get_income_stmt(pretty=True, freq="yearly")
    except Exception:
        income_stmt = pd.DataFrame()
    try:
        balance_sheet = ticker.get_balance_sheet(pretty=True, freq="yearly")
    except Exception:
        balance_sheet = pd.DataFrame()
    try:
        cash_flow = ticker.get_cash_flow(pretty=True, freq="yearly")
    except Exception:
        cash_flow = pd.DataFrame()

    payload = {
        "requestedSymbol": symbol.strip().upper(),
        "normalizedSymbol": ticker_symbol,
        "symbol": quote["symbol"],
        "market": market,
        "name": info.get("longName") or info.get("shortName") or quote["name"],
        "type": info.get("quoteType") or info.get("instrumentType") or quote["type"],
        "currency": info.get("currency") or quote["currency"],
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
        "longBusinessSummary": info.get("longBusinessSummary"),
        "headquarters": headquarters,
        "country": country,
        "ceo": ceo_name(info),
        "fullTimeEmployees": safe_float(info.get("fullTimeEmployees")),
        "beta": safe_float(info.get("beta")),
        "trailingPe": safe_float(info.get("trailingPE") or info.get("trailingPe")),
        "forwardPe": safe_float(info.get("forwardPE") or info.get("forwardPe")),
        "trailingEps": safe_float(info.get("trailingEps")),
        "forwardEps": safe_float(info.get("forwardEps")),
        "dividendYield": safe_float(info.get("dividendYield")),
        "fiftyDayAverage": safe_float(info.get("fiftyDayAverage")),
        "twoHundredDayAverage": safe_float(info.get("twoHundredDayAverage")),
        "sharesOutstanding": safe_float(info.get("sharesOutstanding")),
        "news": news_payload(ticker),
        "incomeStatement": financial_statement_payload("Income Statement", income_stmt),
        "balanceSheet": financial_statement_payload("Balance Sheet", balance_sheet),
        "cashFlow": financial_statement_payload("Cash Flow", cash_flow),
        "history": [],
    }
    return cache_put(_inspect_cache, cache_key, payload)


def search_payload(query: str, market: str | None, types: list[str]) -> list[dict[str, Any]]:
    cache_key = (SEARCH_CACHE_VERSION, query.strip().upper(), market.strip().upper() if market else None, tuple(sorted(value.upper() for value in types)))
    cached = cache_get(_search_cache, cache_key, SEARCH_CACHE_TTL_SECONDS)
    if cached is not None:
        return cached
    results: list[dict[str, Any]] = []
    seen_keys: set[tuple[str, str]] = set()

    def append_result(payload: dict[str, Any], prefer_front: bool = False) -> None:
        symbol = str(payload.get("symbol") or "").strip().upper()
        payload_market = str(payload.get("market") or "").strip().upper()
        if not symbol or not payload_market:
            return
        key = (symbol, payload_market)
        if key in seen_keys:
            return
        seen_keys.add(key)
        if prefer_front:
            results.insert(0, payload)
        else:
            results.append(payload)

    try:
        search = yf.Search(query=query, max_results=20)
        quotes = getattr(search, "quotes", None) or []
    except Exception:
        quotes = []

    requested_market = normalize_market(market) if market else None
    normalized_types = {value.upper() for value in types}
    for item in quotes:
        symbol = item.get("symbol")
        if not symbol:
            continue
        quote_market = infer_market(symbol, item.get("exchange"))
        if not quote_market:
            continue
        if requested_market and quote_market != requested_market:
            continue
        quote_type = item.get("quoteType") or item.get("typeDisp") or "Stock"
        if normalized_types and quote_type.upper() not in normalized_types:
            continue

        price = safe_float(
            item.get("regularMarketPrice")
            or item.get("postMarketPrice")
            or item.get("preMarketPrice")
            or item.get("price")
        )
        day_change_pct = safe_float(
            item.get("regularMarketChangePercent")
            or item.get("postMarketChangePercent")
            or item.get("preMarketChangePercent")
        )
        payload = {
            "symbol": denormalize_symbol(symbol, quote_market),
            "name": item.get("shortname") or item.get("longname") or denormalize_symbol(symbol, quote_market),
            "market": quote_market,
            "type": quote_type,
            "currency": item.get("currency") or ("THB" if quote_market == "TH" else "USD"),
            "price": price or 0.0,
            "dayChangePct": day_change_pct or 0.0,
        }
        append_result(payload)
        if len(results) >= 8:
            break

    query_canonical = canonical_symbol(query)
    has_exact_result = any(
        canonical_symbol(str(result.get("symbol") or "")) == query_canonical
        and (not requested_market or str(result.get("market") or "").upper() == requested_market)
        for result in results
    )

    exact_matches: list[dict[str, Any]] = []
    if not has_exact_result:
        for symbol_candidate, market_candidate in exact_search_candidates(query, requested_market):
            fallback = quote_payload_fast(symbol_candidate, market_candidate)
            if not fallback:
                continue
            if normalized_types and str(fallback.get("type") or "").upper() not in normalized_types:
                continue
            exact_matches.append(fallback)

    exact_matches.sort(
        key=lambda payload: (
            market_rank(str(payload.get("market") or "").upper()),
            0 if str(payload.get("type") or "").upper() == "EQUITY" else 1,
            str(payload.get("symbol") or ""),
        )
    )
    for exact_match in reversed(exact_matches):
        append_result(exact_match, prefer_front=True)

    if not results and requested_market:
        fallback = quote_payload(query, requested_market)
        if fallback:
            append_result(fallback)

    if len(results) > 8:
        results = results[:8]
    return cache_put(_search_cache, cache_key, results)


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        market = normalize_market(params.get("market", ["US"])[0])

        try:
            if parsed.path == "/internal/market/version":
                self.respond(
                    HTTPStatus.OK,
                    {
                        "sidecarVersion": SIDECAR_VERSION,
                        "searchCacheVersion": SEARCH_CACHE_VERSION,
                    },
                )
                return

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
                requested_market = params.get("market", [None])[0]
                self.respond(HTTPStatus.OK, search_payload(query, requested_market, types))
                return

            if parsed.path == "/internal/market/fx":
                base = params.get("base", [""])[0]
                quote = params.get("quote", [""])[0]
                payload = fx_rate_payload(base, quote)
                if payload is None:
                    self.respond(HTTPStatus.NOT_FOUND, {"error": "FX rate not found"})
                    return
                self.respond(HTTPStatus.OK, payload)
                return

            if parsed.path == "/internal/market/history":
                symbol = params.get("symbol", [""])[0]
                period = params.get("period", ["1mo"])[0]
                interval = params.get("interval", ["1d"])[0]
                start = params.get("start", [None])[0]
                end = params.get("end", [None])[0]
                self.respond(HTTPStatus.OK, history_payload(symbol, market, period, interval, start, end))
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
        body = json.dumps(payload, default=json_default, allow_nan=False).encode("utf-8")
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
