CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    external_user_id TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    display_name TEXT,
    auth_provider TEXT NOT NULL DEFAULT 'local',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS local_users (
    user_id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS currencies (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    decimal_places INTEGER NOT NULL DEFAULT 2,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS markets (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    default_currency_id TEXT,
    timezone TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (default_currency_id) REFERENCES currencies(id)
);

CREATE TABLE IF NOT EXISTS exchanges (
    id TEXT PRIMARY KEY,
    market_id TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    mic_code TEXT,
    timezone TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (market_id) REFERENCES markets(id)
);

CREATE TABLE IF NOT EXISTS asset_categories (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS institutions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    institution_type TEXT NOT NULL,
    market_id TEXT,
    base_currency_id TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_institutions_name_type UNIQUE (name, institution_type),
    FOREIGN KEY (market_id) REFERENCES markets(id),
    FOREIGN KEY (base_currency_id) REFERENCES currencies(id)
);

CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    institution_id TEXT,
    account_name TEXT NOT NULL,
    account_number TEXT,
    asset_category_id TEXT NOT NULL,
    base_currency_id TEXT,
    market_id TEXT,
    notes TEXT,
    external_ref TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_accounts_user_external_ref UNIQUE (user_id, external_ref),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (institution_id) REFERENCES institutions(id),
    FOREIGN KEY (asset_category_id) REFERENCES asset_categories(id),
    FOREIGN KEY (base_currency_id) REFERENCES currencies(id),
    FOREIGN KEY (market_id) REFERENCES markets(id)
);

CREATE TABLE IF NOT EXISTS instruments (
    id TEXT PRIMARY KEY,
    owner_user_id TEXT,
    asset_category_id TEXT NOT NULL,
    market_id TEXT,
    exchange_id TEXT,
    ticker TEXT NOT NULL,
    name TEXT NOT NULL,
    isin TEXT,
    currency_id TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    metadata_json TEXT,
    external_ref TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (asset_category_id) REFERENCES asset_categories(id),
    FOREIGN KEY (market_id) REFERENCES markets(id),
    FOREIGN KEY (exchange_id) REFERENCES exchanges(id),
    FOREIGN KEY (currency_id) REFERENCES currencies(id)
);

CREATE INDEX IF NOT EXISTS idx_instruments_ticker ON instruments(ticker);
CREATE INDEX IF NOT EXISTS idx_instruments_owner_user_id ON instruments(owner_user_id);

CREATE TABLE IF NOT EXISTS instrument_aliases (
    id TEXT PRIMARY KEY,
    instrument_id TEXT NOT NULL,
    provider_name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_instrument_aliases UNIQUE (instrument_id, provider_name, symbol),
    FOREIGN KEY (instrument_id) REFERENCES instruments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transaction_types (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    direction TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    instrument_id TEXT,
    transaction_type_id TEXT NOT NULL,
    trade_date TEXT,
    settlement_date TEXT,
    payment_date TEXT,
    ex_date TEXT,
    units DECIMAL(24,10),
    price_per_unit DECIMAL(24,10),
    gross_amount DECIMAL(24,10),
    gross_currency_id TEXT,
    exchange_rate_to_account DECIMAL(24,10),
    exchange_rate_to_base DECIMAL(24,10),
    notes TEXT,
    source_type TEXT NOT NULL,
    source_ref TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (instrument_id) REFERENCES instruments(id),
    FOREIGN KEY (transaction_type_id) REFERENCES transaction_types(id),
    FOREIGN KEY (gross_currency_id) REFERENCES currencies(id)
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_instrument_id ON transactions(instrument_id);

CREATE TABLE IF NOT EXISTS transaction_charges (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    charge_type TEXT NOT NULL,
    amount DECIMAL(24,10) NOT NULL,
    currency_id TEXT,
    is_inclusive INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (currency_id) REFERENCES currencies(id)
);

CREATE TABLE IF NOT EXISTS cash_flows (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL UNIQUE,
    cash_flow_type TEXT NOT NULL,
    gross_amount DECIMAL(24,10),
    gross_currency_id TEXT,
    tax_amount DECIMAL(24,10) DEFAULT 0,
    tax_currency_id TEXT,
    net_amount DECIMAL(24,10),
    net_currency_id TEXT,
    units_entitled DECIMAL(24,10),
    amount_per_unit DECIMAL(24,10),
    tax_already_deducted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (gross_currency_id) REFERENCES currencies(id),
    FOREIGN KEY (tax_currency_id) REFERENCES currencies(id),
    FOREIGN KEY (net_currency_id) REFERENCES currencies(id)
);

CREATE TABLE IF NOT EXISTS holdings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    instrument_id TEXT NOT NULL,
    units_held DECIMAL(24,10) NOT NULL DEFAULT 0,
    avg_cost_per_unit DECIMAL(24,10) NOT NULL DEFAULT 0,
    invested_amount DECIMAL(24,10) NOT NULL DEFAULT 0,
    invested_currency_id TEXT,
    realized_pnl DECIMAL(24,10) NOT NULL DEFAULT 0,
    dividends_received DECIMAL(24,10) NOT NULL DEFAULT 0,
    market_value DECIMAL(24,10) NOT NULL DEFAULT 0,
    market_value_currency_id TEXT,
    last_recomputed_at TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_holdings_account_instrument UNIQUE (account_id, instrument_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (instrument_id) REFERENCES instruments(id) ON DELETE CASCADE,
    FOREIGN KEY (invested_currency_id) REFERENCES currencies(id),
    FOREIGN KEY (market_value_currency_id) REFERENCES currencies(id)
);

CREATE TABLE IF NOT EXISTS market_prices (
    id TEXT PRIMARY KEY,
    instrument_id TEXT NOT NULL,
    price_date TEXT NOT NULL,
    open_price DECIMAL(24,10),
    high_price DECIMAL(24,10),
    low_price DECIMAL(24,10),
    close_price DECIMAL(24,10) NOT NULL,
    adjusted_close_price DECIMAL(24,10),
    currency_id TEXT,
    volume DECIMAL(24,10),
    source_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_market_prices UNIQUE (instrument_id, price_date, source_name),
    FOREIGN KEY (instrument_id) REFERENCES instruments(id) ON DELETE CASCADE,
    FOREIGN KEY (currency_id) REFERENCES currencies(id)
);

CREATE TABLE IF NOT EXISTS fx_rates (
    id TEXT PRIMARY KEY,
    base_currency_id TEXT NOT NULL,
    quote_currency_id TEXT NOT NULL,
    rate_date TEXT NOT NULL,
    rate DECIMAL(24,10) NOT NULL,
    source_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_fx_rates UNIQUE (base_currency_id, quote_currency_id, rate_date, source_name),
    FOREIGN KEY (base_currency_id) REFERENCES currencies(id),
    FOREIGN KEY (quote_currency_id) REFERENCES currencies(id)
);

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT,
    instrument_id TEXT,
    snapshot_date TEXT NOT NULL,
    market_value DECIMAL(24,10) NOT NULL,
    market_value_currency_id TEXT,
    invested_value DECIMAL(24,10),
    dividend_total DECIMAL(24,10),
    unrealized_gain_loss DECIMAL(24,10),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (instrument_id) REFERENCES instruments(id) ON DELETE CASCADE,
    FOREIGN KEY (market_value_currency_id) REFERENCES currencies(id)
);

CREATE TABLE IF NOT EXISTS instrument_yearly_summaries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT,
    instrument_id TEXT NOT NULL,
    summary_year INTEGER NOT NULL,
    total_buy_amount DECIMAL(24,10) NOT NULL DEFAULT 0,
    total_sell_amount DECIMAL(24,10) NOT NULL DEFAULT 0,
    total_dividend_amount DECIMAL(24,10) NOT NULL DEFAULT 0,
    realized_gain_loss DECIMAL(24,10) NOT NULL DEFAULT 0,
    currency_id TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_instrument_yearly_summaries UNIQUE (user_id, account_id, instrument_id, summary_year),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (instrument_id) REFERENCES instruments(id) ON DELETE CASCADE,
    FOREIGN KEY (currency_id) REFERENCES currencies(id)
);

CREATE TABLE IF NOT EXISTS user_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    key_version INTEGER NOT NULL DEFAULT 1,
    wrapped_key TEXT NOT NULL,
    wrapping_algorithm TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    rotated_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS imports (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_identifier TEXT NOT NULL,
    status TEXT NOT NULL,
    imported_at TEXT,
    notes TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS import_rows (
    id TEXT PRIMARY KEY,
    import_id TEXT NOT NULL,
    raw_payload_json TEXT NOT NULL,
    parsed_status TEXT NOT NULL,
    error_message TEXT,
    linked_transaction_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (import_id) REFERENCES imports(id) ON DELETE CASCADE,
    FOREIGN KEY (linked_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS bank_balance_snapshots (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT,
    snapshot_date TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    balance DECIMAL(24,10) NOT NULL,
    currency_id TEXT,
    change_text TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (currency_id) REFERENCES currencies(id)
);

CREATE TABLE IF NOT EXISTS lottery_entries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    draw_name TEXT NOT NULL,
    tickets INTEGER NOT NULL DEFAULT 0,
    committed_amount DECIMAL(24,10) NOT NULL DEFAULT 0,
    committed_currency_id TEXT,
    estimated_payout TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (committed_currency_id) REFERENCES currencies(id)
);

CREATE TABLE IF NOT EXISTS mutual_fund_monthly_snapshots (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT,
    instrument_id TEXT,
    snapshot_date TEXT NOT NULL,
    nav DECIMAL(24,10) NOT NULL DEFAULT 0,
    currency_id TEXT,
    exposure TEXT,
    change_text TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (instrument_id) REFERENCES instruments(id) ON DELETE CASCADE,
    FOREIGN KEY (currency_id) REFERENCES currencies(id)
);

CREATE TABLE IF NOT EXISTS bond_coupon_schedules (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT,
    instrument_id TEXT,
    coupon_date TEXT NOT NULL,
    amount DECIMAL(24,10) NOT NULL DEFAULT 0,
    currency_id TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (instrument_id) REFERENCES instruments(id) ON DELETE CASCADE,
    FOREIGN KEY (currency_id) REFERENCES currencies(id)
);

CREATE TABLE IF NOT EXISTS option_contract_details (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT,
    instrument_id TEXT,
    contract_type TEXT,
    strike_price DECIMAL(24,10),
    expiry_date TEXT,
    underlying_symbol TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (instrument_id) REFERENCES instruments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS expense_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expense_frequency TEXT NOT NULL,
    name TEXT NOT NULL,
    amount DECIMAL(24,10) NOT NULL DEFAULT 0,
    currency_id TEXT,
    renewal_text TEXT,
    runway_text TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (currency_id) REFERENCES currencies(id)
);

CREATE TABLE IF NOT EXISTS app_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
