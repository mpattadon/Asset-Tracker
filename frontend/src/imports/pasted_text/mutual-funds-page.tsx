Design a clean, minimal Mutual Funds tracking page for a financial asset dashboard web app.

Style:
- Inspired by Google Finance (clean, data-first UI)
- Minimal, structured, professional
- Neutral colors with subtle blue accents
- Avoid clutter and wide spreadsheet-style layouts
- Use cards and grouped sections instead of large tables

Layout:

Top Section:
- Page title: "Mutual Funds"
- Subtitle: "Track your mutual fund investments across accounts and banks"
- Action buttons:
  - "Add Purchase"
  - "Log Monthly Data"
- Optional filter controls:
  - Bank filter
  - Account filter

Main Content Structure:
- Funds are grouped hierarchically:
  Bank → Account → Funds

Each Bank:
- Display as a section header (e.g. SCB, BBL, TTB)

Each Account:
- Display as a sub-section card:
  - Account number
  - Notes (e.g. SCBAM, Link account)

Each Fund (core component):
- Display as a card with:

Top Row:
- Fund name (e.g. SCB-GMCORE(A))
- Risk level badge (e.g. Low / Medium / High)
- Optional tag: Fund type or category

Middle Section:
- Summary metrics:
  - Total invested value
  - Current market value
  - Total gain/loss (auto-calculated)
  - Total dividends received

- Show gain/loss with color:
  - Green for profit
  - Red for loss

Bottom Section:
- Mini time-series chart (line chart)
  - Market value over time

Expandable Section (important):
- Each fund card can expand to show monthly logs

Monthly Data View:
- Display as a clean table or list:
  - Month (e.g. Jan 2025)
  - Invested value
  - Market value
  - Gain/Loss (auto-calculated)
  - Dividends

- Include a button:
  - "+ Add Monthly Entry"

Purchase Flow (UI design only):
- Modal or side panel for adding a purchase:
  Inputs:
  - Fund name (dropdown or text)
  - Bank (dropdown)
  - Account number (dropdown)
  - Average cost per unit
  - Units purchased

- Auto-calculated:
  - Total cost = avg cost × units

- Display calculated total before submission

Monthly Logging Flow:
- Modal or inline input:
  Inputs:
  - Month
  - Market value
  - Dividends received

- Auto-calculated:
  - Gain/Loss = Market value - Total invested

UX Notes:
- Avoid horizontal scrolling tables
- Prioritize readability and grouping
- Cards should be modular and reusable
- Use consistent spacing (8px grid)
- Rounded corners, subtle borders, light shadows

Tone:
- Analytical, clean, professional
- Feels like a real investment tool, not a spreadsheet