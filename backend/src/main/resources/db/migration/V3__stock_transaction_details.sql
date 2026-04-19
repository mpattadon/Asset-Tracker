CREATE TABLE IF NOT EXISTS stock_transaction_details (
    transaction_id TEXT PRIMARY KEY,
    fee_net_usd DECIMAL(24,10) NOT NULL DEFAULT 0,
    fee_net_thb DECIMAL(24,10) NOT NULL DEFAULT 0,
    fx_actual_rate DECIMAL(24,10),
    fx_dime_rate DECIMAL(24,10),
    withholding_tax_rate DECIMAL(24,10),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
);
