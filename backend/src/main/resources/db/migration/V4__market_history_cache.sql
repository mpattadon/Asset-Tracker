CREATE TABLE IF NOT EXISTS market_history_cache (
    normalized_symbol TEXT NOT NULL,
    market_code TEXT NOT NULL,
    interval_code TEXT NOT NULL,
    bar_time TEXT NOT NULL,
    bar_epoch_seconds BIGINT NOT NULL,
    open_price DECIMAL(24,10) NOT NULL,
    high_price DECIMAL(24,10) NOT NULL,
    low_price DECIMAL(24,10) NOT NULL,
    close_price DECIMAL(24,10) NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (normalized_symbol, market_code, interval_code, bar_time)
);

CREATE INDEX IF NOT EXISTS idx_market_history_cache_lookup
    ON market_history_cache (normalized_symbol, market_code, interval_code, bar_epoch_seconds);

CREATE TABLE IF NOT EXISTS market_history_cache_state (
    normalized_symbol TEXT NOT NULL,
    market_code TEXT NOT NULL,
    interval_code TEXT NOT NULL,
    coverage_period TEXT NOT NULL,
    last_bar_time TEXT,
    last_bar_epoch_seconds BIGINT,
    last_refreshed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (normalized_symbol, market_code, interval_code)
);
