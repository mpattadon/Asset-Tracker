INSERT INTO currencies (id, code, name, symbol, decimal_places)
SELECT '00000000-0000-0000-0000-000000000001', 'USD', 'US Dollar', '$', 2
WHERE NOT EXISTS (SELECT 1 FROM currencies WHERE code = 'USD');

INSERT INTO currencies (id, code, name, symbol, decimal_places)
SELECT '00000000-0000-0000-0000-000000000002', 'THB', 'Thai Baht', 'THB', 2
WHERE NOT EXISTS (SELECT 1 FROM currencies WHERE code = 'THB');

INSERT INTO currencies (id, code, name, symbol, decimal_places)
SELECT '00000000-0000-0000-0000-000000000003', 'EUR', 'Euro', '€', 2
WHERE NOT EXISTS (SELECT 1 FROM currencies WHERE code = 'EUR');

INSERT INTO currencies (id, code, name, symbol, decimal_places)
SELECT '00000000-0000-0000-0000-000000000004', 'GBP', 'British Pound', '£', 2
WHERE NOT EXISTS (SELECT 1 FROM currencies WHERE code = 'GBP');

INSERT INTO currencies (id, code, name, symbol, decimal_places)
SELECT '00000000-0000-0000-0000-000000000005', 'JPY', 'Japanese Yen', '¥', 0
WHERE NOT EXISTS (SELECT 1 FROM currencies WHERE code = 'JPY');

INSERT INTO currencies (id, code, name, symbol, decimal_places)
SELECT '00000000-0000-0000-0000-000000000006', 'TWD', 'New Taiwan Dollar', 'NT$', 2
WHERE NOT EXISTS (SELECT 1 FROM currencies WHERE code = 'TWD');

INSERT INTO markets (id, code, name, default_currency_id, timezone)
SELECT '00000000-0000-0000-0000-000000000101', 'US', 'United States', '00000000-0000-0000-0000-000000000001', 'America/New_York'
WHERE NOT EXISTS (SELECT 1 FROM markets WHERE code = 'US');

INSERT INTO markets (id, code, name, default_currency_id, timezone)
SELECT '00000000-0000-0000-0000-000000000102', 'TH', 'Thailand', '00000000-0000-0000-0000-000000000002', 'Asia/Bangkok'
WHERE NOT EXISTS (SELECT 1 FROM markets WHERE code = 'TH');

INSERT INTO markets (id, code, name, default_currency_id, timezone)
SELECT '00000000-0000-0000-0000-000000000103', 'TW', 'Taiwan', '00000000-0000-0000-0000-000000000006', 'Asia/Taipei'
WHERE NOT EXISTS (SELECT 1 FROM markets WHERE code = 'TW');

INSERT INTO markets (id, code, name, default_currency_id, timezone)
SELECT '00000000-0000-0000-0000-000000000104', 'UK', 'United Kingdom', '00000000-0000-0000-0000-000000000004', 'Europe/London'
WHERE NOT EXISTS (SELECT 1 FROM markets WHERE code = 'UK');

INSERT INTO exchanges (id, market_id, code, name, mic_code, timezone)
SELECT '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101', 'NASDAQ', 'NASDAQ', 'XNAS', 'America/New_York'
WHERE NOT EXISTS (SELECT 1 FROM exchanges WHERE code = 'NASDAQ');

INSERT INTO exchanges (id, market_id, code, name, mic_code, timezone)
SELECT '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000101', 'NYSE', 'New York Stock Exchange', 'XNYS', 'America/New_York'
WHERE NOT EXISTS (SELECT 1 FROM exchanges WHERE code = 'NYSE');

INSERT INTO exchanges (id, market_id, code, name, mic_code, timezone)
SELECT '00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000102', 'SET', 'Stock Exchange of Thailand', 'XBKK', 'Asia/Bangkok'
WHERE NOT EXISTS (SELECT 1 FROM exchanges WHERE code = 'SET');

INSERT INTO exchanges (id, market_id, code, name, mic_code, timezone)
SELECT '00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000103', 'TWSE', 'Taiwan Stock Exchange', 'XTAI', 'Asia/Taipei'
WHERE NOT EXISTS (SELECT 1 FROM exchanges WHERE code = 'TWSE');

INSERT INTO exchanges (id, market_id, code, name, mic_code, timezone)
SELECT '00000000-0000-0000-0000-000000000205', '00000000-0000-0000-0000-000000000104', 'LSE', 'London Stock Exchange', 'XLON', 'Europe/London'
WHERE NOT EXISTS (SELECT 1 FROM exchanges WHERE code = 'LSE');

INSERT INTO asset_categories (id, code, name)
SELECT '00000000-0000-0000-0000-000000000301', 'STOCK', 'Stock'
WHERE NOT EXISTS (SELECT 1 FROM asset_categories WHERE code = 'STOCK');

INSERT INTO asset_categories (id, code, name)
SELECT '00000000-0000-0000-0000-000000000302', 'MUTUAL_FUND', 'Mutual Fund'
WHERE NOT EXISTS (SELECT 1 FROM asset_categories WHERE code = 'MUTUAL_FUND');

INSERT INTO asset_categories (id, code, name)
SELECT '00000000-0000-0000-0000-000000000303', 'BOND', 'Bond'
WHERE NOT EXISTS (SELECT 1 FROM asset_categories WHERE code = 'BOND');

INSERT INTO asset_categories (id, code, name)
SELECT '00000000-0000-0000-0000-000000000304', 'GOLD', 'Gold'
WHERE NOT EXISTS (SELECT 1 FROM asset_categories WHERE code = 'GOLD');

INSERT INTO asset_categories (id, code, name)
SELECT '00000000-0000-0000-0000-000000000305', 'BANK_ACCOUNT', 'Bank Account'
WHERE NOT EXISTS (SELECT 1 FROM asset_categories WHERE code = 'BANK_ACCOUNT');

INSERT INTO asset_categories (id, code, name)
SELECT '00000000-0000-0000-0000-000000000306', 'LOTTERY', 'Lottery'
WHERE NOT EXISTS (SELECT 1 FROM asset_categories WHERE code = 'LOTTERY');

INSERT INTO asset_categories (id, code, name)
SELECT '00000000-0000-0000-0000-000000000307', 'OPTION', 'Option'
WHERE NOT EXISTS (SELECT 1 FROM asset_categories WHERE code = 'OPTION');

INSERT INTO asset_categories (id, code, name)
SELECT '00000000-0000-0000-0000-000000000308', 'EXPENSE', 'Expense'
WHERE NOT EXISTS (SELECT 1 FROM asset_categories WHERE code = 'EXPENSE');

INSERT INTO transaction_types (id, code, name, direction)
SELECT '00000000-0000-0000-0000-000000000401', 'BUY', 'Buy', 'OUTFLOW'
WHERE NOT EXISTS (SELECT 1 FROM transaction_types WHERE code = 'BUY');

INSERT INTO transaction_types (id, code, name, direction)
SELECT '00000000-0000-0000-0000-000000000402', 'SELL', 'Sell', 'INFLOW'
WHERE NOT EXISTS (SELECT 1 FROM transaction_types WHERE code = 'SELL');

INSERT INTO transaction_types (id, code, name, direction)
SELECT '00000000-0000-0000-0000-000000000403', 'DIVIDEND', 'Dividend', 'INFLOW'
WHERE NOT EXISTS (SELECT 1 FROM transaction_types WHERE code = 'DIVIDEND');

INSERT INTO transaction_types (id, code, name, direction)
SELECT '00000000-0000-0000-0000-000000000404', 'CASH_DEPOSIT', 'Cash Deposit', 'INFLOW'
WHERE NOT EXISTS (SELECT 1 FROM transaction_types WHERE code = 'CASH_DEPOSIT');

INSERT INTO transaction_types (id, code, name, direction)
SELECT '00000000-0000-0000-0000-000000000405', 'CASH_WITHDRAWAL', 'Cash Withdrawal', 'OUTFLOW'
WHERE NOT EXISTS (SELECT 1 FROM transaction_types WHERE code = 'CASH_WITHDRAWAL');

INSERT INTO transaction_types (id, code, name, direction)
SELECT '00000000-0000-0000-0000-000000000406', 'FEE', 'Fee', 'OUTFLOW'
WHERE NOT EXISTS (SELECT 1 FROM transaction_types WHERE code = 'FEE');

INSERT INTO transaction_types (id, code, name, direction)
SELECT '00000000-0000-0000-0000-000000000407', 'TAX', 'Tax', 'OUTFLOW'
WHERE NOT EXISTS (SELECT 1 FROM transaction_types WHERE code = 'TAX');

INSERT INTO transaction_types (id, code, name, direction)
SELECT '00000000-0000-0000-0000-000000000408', 'ADJUSTMENT', 'Adjustment', 'NEUTRAL'
WHERE NOT EXISTS (SELECT 1 FROM transaction_types WHERE code = 'ADJUSTMENT');

INSERT INTO transaction_types (id, code, name, direction)
SELECT '00000000-0000-0000-0000-000000000409', 'SNAPSHOT', 'Snapshot', 'NEUTRAL'
WHERE NOT EXISTS (SELECT 1 FROM transaction_types WHERE code = 'SNAPSHOT');
