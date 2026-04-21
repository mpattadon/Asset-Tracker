CREATE TABLE IF NOT EXISTS mutual_fund_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    notes TEXT,
    currency_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (currency_id) REFERENCES currencies(id)
);

CREATE TABLE IF NOT EXISTS mutual_fund_purchase_entries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    fund_name TEXT NOT NULL,
    fund_key TEXT NOT NULL,
    risk_level INTEGER NOT NULL,
    purchase_date TEXT NOT NULL,
    average_cost_per_unit DECIMAL(24,10) NOT NULL,
    units_purchased DECIMAL(24,10) NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES mutual_fund_accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mutual_fund_monthly_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    fund_name TEXT NOT NULL,
    fund_key TEXT NOT NULL,
    month_key TEXT NOT NULL,
    log_date TEXT NOT NULL,
    price_per_unit DECIMAL(24,10) NOT NULL,
    dividend_received DECIMAL(24,10) NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES mutual_fund_accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mutual_fund_accounts_user
    ON mutual_fund_accounts(user_id, bank_name, account_number);

CREATE INDEX IF NOT EXISTS idx_mutual_fund_purchase_entries_account
    ON mutual_fund_purchase_entries(user_id, account_id, fund_key, purchase_date);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mutual_fund_monthly_logs_unique_month
    ON mutual_fund_monthly_logs(user_id, account_id, fund_key, month_key);
