Design a professional, data-rich Stocks portfolio page for a financial asset tracking web app.

Style:
- Inspired by Google Finance but more advanced and detailed
- Clean, minimal, data-first UI
- Avoid spreadsheet-style layouts
- Use cards, tabs, and structured tables
- Neutral palette with green/red for gains/losses

Layout Structure:

Top Section:
- Page title: "Stocks"
- Tabs:
  - Overview
  - Transactions
  - Per Stock

- Filters:
  - Market toggle: US / Thai
  - Account filter (optional)

--------------------------------------------------

1. OVERVIEW TAB (default)

Top:
- Portfolio value
- Total gain/loss (absolute + %)
- Small performance chart (line chart with time filters)

Main Table (Google Finance inspired):
Columns:
- Ticker
- Company Name
- Total Volume
- Average Cost (AVCO)
- Current Price
- Total Value
- Gain/Loss (value + %)
- Dividend (yearly)

- Rows clickable → opens Stock Detail view

--------------------------------------------------

2. PER STOCK TAB (summary table)

- Table listing all stocks owned

Columns:
- Ticker
- Total Volume
- Average Cost
- Total Value (USD)
- Total Value (THB)
- Total Dividends (USD / THB)
- Yearly summary (buy / sell / dividends)

- Include expandable row:
  → shows yearly breakdown per ticker

--------------------------------------------------

3. TRANSACTIONS TAB (core system)

- This replaces Excel sheet

Top:
- Button: "+ Add Transaction"

Transaction Table:
Columns:
- Date
- Type (Buy / Sell / Dividend)
- Ticker
- Units
- Price per unit
- Fees (USD / THB)
- Total USD
- Total THB
- Exchange rate
- Notes

Color coding:
- Buy = neutral/blue
- Sell = orange
- Dividend = green

--------------------------------------------------

TRANSACTION INPUT (MODAL)

User selects:
- Type:
  → Buy / Sell / Dividend

-----------------------------------

If BUY or SELL:
Inputs:
- Date
- Ticker
- Units
- Price per unit
- Net USD fee (manual input)
- Net THB fee (manual input)
- Exchange rate (manual input)
- USD total (manual input)

Auto-calculated:
- % fee
- Real USD = units × price + fee
- Real THB = USD × exchange rate
- Price/unit net

-----------------------------------

If DIVIDEND:
Inputs:
- XD Date
- Payment date
- Ticker
- Dividend per unit
- Units held

Checkbox:
- "Tax already deducted"

Auto-calculated:
- Total dividend
- Tax
- Net received
- Dividend yield %

--------------------------------------------------

4. STOCK DETAIL PAGE (important)

When clicking a ticker:

Top:
- Ticker + company name
- Current price
- Total holdings
- Gain/loss

Main:
- TradingView-style chart (line + candle toggle)

Tabs inside:
- Transactions
- Dividends
- Performance

Transactions:
- Timeline list (not spreadsheet)

Dividends:
- Clean dividend history list

Performance:
- Metrics:
  - Total invested
  - Total returns
  - Yield

--------------------------------------------------

UX NOTES:
- Avoid horizontal scrolling
- Use expandable sections instead of wide tables
- Use grouping instead of large datasets
- Keep data readable and structured

Tone:
- Professional trading tool
- Clean, analytical, efficient
- Feels like a serious portfolio system