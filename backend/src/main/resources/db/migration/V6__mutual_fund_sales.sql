CREATE TABLE IF NOT EXISTS mutual_fund_sale_entries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    fund_name TEXT NOT NULL,
    fund_key TEXT NOT NULL,
    sale_date TEXT NOT NULL,
    units_sold DECIMAL(24,10) NOT NULL,
    sale_price_per_unit DECIMAL(24,10) NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES mutual_fund_accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mutual_fund_sale_entries_account
    ON mutual_fund_sale_entries(user_id, account_id, fund_key, sale_date);
