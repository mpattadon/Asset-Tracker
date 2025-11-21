export const summaryCards = [
  { label: 'Net Worth', value: 'THB 14.8M', delta: '+4.3% MoM' },
  { label: 'Invested', value: 'THB 10.6M', delta: '+3.2% YTD' },
  { label: 'Cash & Savings', value: 'THB 2.1M', delta: 'Stable' },
  { label: 'Alternatives', value: 'THB 2.1M', delta: '+2.0% MoM' },
]

export const allocation = [
  { area: 'Equities', percent: 54, color: '#3B82F6' },
  { area: 'Fixed Income', percent: 18, color: '#F59E0B' },
  { area: 'Gold', percent: 12, color: '#EAB308' },
  { area: 'Cash', percent: 10, color: '#22D3EE' },
  { area: 'Lottery', percent: 6, color: '#10B981' },
]

export const stockBreakdown = {
  thai: [
    { label: 'SET Tech', value: 32, color: '#3B82F6' },
    { label: 'Energy', value: 26, color: '#F59E0B' },
    { label: 'Healthcare', value: 18, color: '#10B981' },
    { label: 'Banks', value: 24, color: '#06B6D4' },
  ],
  us: [
    { label: 'Big Tech', value: 45, color: '#6366F1' },
    { label: 'Industrials', value: 20, color: '#F97316' },
    { label: 'Healthcare', value: 15, color: '#06B6D4' },
    { label: 'ETFs', value: 20, color: '#84CC16' },
  ],
}

export const stockPerformance = {
  thai: { change: '+6.4% YTD', series: [92, 95, 93, 102, 108, 111, 118] },
  us: { change: '+12.8% YTD', series: [110, 112, 116, 121, 124, 130, 138] },
}

export const stockMarkets = {
  thai: {
    title: 'Thai Stock',
    currency: 'THB',
    value: 608670,
    dayChange: -3910.01,
    dayChangePct: -0.64,
    totalChange: -489510,
    totalChangePct: -44.57,
    series: [640000, 645000, 638500, 652000, 648000, 642500, 636000, 625000, 620500, 618000, 614000, 608670],
    series: [640000, 645000, 638500, 652000, 648000, 642500, 636000, 625000, 620500, 618000, 614000, 608670],
    candlesticks: [
      { time: 'Oct 27', open: 640000, high: 646000, low: 635000, close: 645000 },
      { time: 'Oct 30', open: 645000, high: 652000, low: 641000, close: 648000 },
      { time: 'Nov 01', open: 648000, high: 654000, low: 642500, close: 652000 },
      { time: 'Nov 03', open: 652000, high: 654500, low: 646500, close: 648000 },
      { time: 'Nov 06', open: 648000, high: 649500, low: 641000, close: 642500 },
      { time: 'Nov 09', open: 642500, high: 644000, low: 633000, close: 636000 },
      { time: 'Nov 12', open: 636000, high: 637000, low: 624500, close: 625000 },
      { time: 'Nov 15', open: 625000, high: 627000, low: 618000, close: 620500 },
      { time: 'Nov 17', open: 620500, high: 622000, low: 614000, close: 618000 },
      { time: 'Nov 20', open: 618000, high: 619000, low: 607500, close: 608670 },
    ],
    holdings: [
      { symbol: 'DOD', name: 'DOD Biotech PCL', price: 1.65, quantity: 26000, dayGain: -780, dayGainPct: -1.79, value: 42900 },
      { symbol: 'OR', name: 'PTT Oil and Retail Business PCL', price: 13.2, quantity: 24000, dayGain: -2400.01, dayGainPct: -0.75, value: 316800 },
    ],
  },
  us: {
    title: 'US Stock',
    currency: 'USD',
    value: 124500,
    dayChange: 820,
    dayChangePct: 0.66,
    totalChange: 18450,
    totalChangePct: 17.4,
    series: [112000, 114500, 113000, 116200, 118000, 119500, 120800, 121100, 122400, 123200, 124500],
    candlesticks: [
      { time: 'Oct 27', open: 112000, high: 115500, low: 111500, close: 114500 },
      { time: 'Oct 30', open: 114500, high: 115000, low: 112000, close: 113000 },
      { time: 'Nov 01', open: 113000, high: 117000, low: 113000, close: 116200 },
      { time: 'Nov 03', open: 116200, high: 118500, low: 115500, close: 118000 },
      { time: 'Nov 06', open: 118000, high: 120000, low: 117500, close: 119500 },
      { time: 'Nov 09', open: 119500, high: 121000, low: 119000, close: 120800 },
      { time: 'Nov 12', open: 120800, high: 121800, low: 120200, close: 121100 },
      { time: 'Nov 15', open: 121100, high: 122900, low: 121000, close: 122400 },
      { time: 'Nov 17', open: 122400, high: 123500, low: 122000, close: 123200 },
      { time: 'Nov 20', open: 123200, high: 125000, low: 123000, close: 124500 },
    ],
    holdings: [
      { symbol: 'AAPL', name: 'Apple Inc.', price: 189.75, quantity: 180, dayGain: 540, dayGainPct: 0.9, value: 34155 },
      { symbol: 'MSFT', name: 'Microsoft Corp.', price: 412.3, quantity: 110, dayGain: 330, dayGainPct: 0.81, value: 45353 },
      { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', price: 475.1, quantity: 60, dayGain: -50, dayGainPct: -0.09, value: 28506 },
    ],
  },
}

export const bondHoldings = [
  { name: 'Thai Govt 2030', yield: '3.4%', amount: 'THB 1,200,000', duration: '6.2 yrs' },
  { name: 'Debenture - Telco', yield: '4.8%', amount: 'THB 600,000', duration: '3.0 yrs' },
  { name: 'Infrastructure Bond', yield: '5.2%', amount: 'THB 450,000', duration: '8.0 yrs' },
]

export const goldPositions = [
  { type: 'Physical Bars', weight: '310g', value: 'THB 750,000', change: '+2.1% MoM' },
  { type: 'Gold ETF', weight: '9 oz', value: 'THB 520,000', change: '+1.4% MoM' },
]

export const mutualFunds = [
  { name: 'Global Growth Fund', exposure: '70% equity / 30% bonds', nav: 'THB 820,000', change: '+8.2% YTD' },
  { name: 'Asia Dividend', exposure: 'Regional equities', nav: 'THB 610,000', change: '+4.6% YTD' },
  { name: 'Sustainable Balanced', exposure: '60/40 multi-asset', nav: 'THB 430,000', change: '+3.1% YTD' },
]

export const bankData = {
  thai: {
    total: 'THB 2.1M',
    accounts: [
      { bank: 'Bangkok Bank', balance: 'THB 820,000', change: '+18k this month' },
      { bank: 'Kasikorn', balance: 'THB 540,000', change: '+6k this month' },
      { bank: 'SCB Savings', balance: 'THB 390,000', change: '+4k this month' },
    ],
    series: [60, 63, 62, 66, 70, 72, 75],
  },
  uk: {
    total: '£41,600',
    accounts: [
      { bank: 'Monzo', balance: '£18,400', change: '+£320 this month' },
      { bank: 'HSBC UK', balance: '£12,800', change: '+£180 this month' },
      { bank: 'Nationwide', balance: '£10,400', change: '+£90 this month' },
    ],
    series: [38, 39, 40, 41, 40, 41.2, 41.6],
  },
}

export const lotteryEntries = [
  { draw: 'Dec 1', tickets: 8, committed: 'THB 16,000', estPayout: 'THB 120,000 high tier' },
  { draw: 'Dec 16', tickets: 6, committed: 'THB 12,000', estPayout: 'THB 45,000 mid tier' },
]

export const expenseSummary = {
  monthly: [
    { name: 'Housing & Utilities', amount: 'THB 38,000', renewal: 'Monthly autopay' },
    { name: 'Insurance', amount: 'THB 12,500', renewal: 'Monthly debit' },
    { name: 'Subscriptions', amount: 'THB 3,200', renewal: 'Renew 5th' },
  ],
  yearly: [
    { name: 'Property Tax', amount: 'THB 18,000', renewal: 'Mar 2025' },
    { name: 'Car Insurance', amount: 'THB 24,000', renewal: 'Aug 2025' },
    { name: 'Domain & Cloud', amount: 'THB 6,400', renewal: 'Jan 2026' },
  ],
  runway: '11.2 months',
}
