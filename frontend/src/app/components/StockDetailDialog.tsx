import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Card } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Badge } from "./ui/badge";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StockDetailDialogProps {
  ticker: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Mock data for the selected stock
const stockData = {
  AAPL: {
    company: "Apple Inc.",
    currentPrice: 178.25,
    holdings: 250,
    avgCost: 165.50,
    chartData: [
      { date: "Jan", price: 165 },
      { date: "Feb", price: 168 },
      { date: "Mar", price: 172 },
      { date: "Apr", price: 175 },
      { date: "May", price: 176 },
      { date: "Jun", price: 178.25 },
    ],
    transactions: [
      { date: "2026-03-15", type: "Buy", units: 100, price: 170.50, total: 17050 },
      { date: "2026-01-10", type: "Buy", units: 150, price: 162.30, total: 24345 },
    ],
    dividends: [
      { date: "2026-02-15", amount: 0.92, units: 250, total: 230 },
      { date: "2025-11-15", amount: 0.90, units: 250, total: 225 },
      { date: "2025-08-15", amount: 0.90, units: 150, total: 135 },
    ],
  },
};

export function StockDetailDialog({ ticker, open, onOpenChange }: StockDetailDialogProps) {
  const [chartType, setChartType] = useState<"line" | "candle">("line");
  
  const stock = stockData[ticker as keyof typeof stockData] || stockData.AAPL;
  const totalValue = stock.currentPrice * stock.holdings;
  const totalCost = stock.avgCost * stock.holdings;
  const gainLoss = totalValue - totalCost;
  const gainLossPercent = (gainLoss / totalCost) * 100;
  const isPositive = gainLoss >= 0;

  const totalInvested = stock.transactions.reduce((sum, t) => sum + t.total, 0);
  const totalDividends = stock.dividends.reduce((sum, d) => sum + d.total, 0);
  const totalReturns = gainLoss + totalDividends;
  const yieldPercent = (totalDividends / totalInvested) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-2xl">{ticker}</span>
            <span className="text-lg font-normal text-gray-500">{stock.company}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-white border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Current Price</p>
              <p className="text-lg font-medium text-gray-900">${stock.currentPrice}</p>
            </Card>
            <Card className="p-4 bg-white border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Total Holdings</p>
              <p className="text-lg font-medium text-gray-900">{stock.holdings} units</p>
            </Card>
            <Card className="p-4 bg-white border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Total Value</p>
              <p className="text-lg font-medium text-gray-900">${totalValue.toLocaleString()}</p>
            </Card>
            <Card className="p-4 bg-white border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Gain/Loss</p>
              <div className="flex items-center gap-1">
                <p className={`text-lg font-medium ${isPositive ? "text-green-600" : "text-red-600"}`}>
                  {isPositive ? "+" : ""}${gainLoss.toFixed(0)}
                </p>
                {isPositive ? (
                  <TrendingUp className="w-4 h-4 text-green-600" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-600" />
                )}
              </div>
              <p className={`text-xs ${isPositive ? "text-green-600" : "text-red-600"}`}>
                {isPositive ? "+" : ""}{gainLossPercent.toFixed(2)}%
              </p>
            </Card>
          </div>

          {/* Chart */}
          <Card className="p-6 bg-white border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-medium text-gray-900">Price Chart</h3>
              <div className="flex gap-2">
                <Badge
                  variant={chartType === "line" ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setChartType("line")}
                >
                  Line
                </Badge>
                <Badge
                  variant={chartType === "candle" ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setChartType("candle")}
                >
                  Candle
                </Badge>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={stock.chartData}>
                <XAxis
                  dataKey="date"
                  stroke="#9ca3af"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#9ca3af"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [`$${value}`, "Price"]}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="transactions">
            <TabsList>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="dividends">Dividends</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
            </TabsList>

            {/* Transactions Tab */}
            <TabsContent value="transactions" className="mt-4 space-y-3">
              {stock.transactions.map((transaction, index) => (
                <Card key={index} className="p-4 bg-white border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Badge
                        variant="outline"
                        className={
                          transaction.type === "Buy"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-orange-50 text-orange-700 border-orange-200"
                        }
                      >
                        {transaction.type}
                      </Badge>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{transaction.date}</p>
                        <p className="text-xs text-gray-500">
                          {transaction.units} units @ ${transaction.price}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        ${transaction.total.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </TabsContent>

            {/* Dividends Tab */}
            <TabsContent value="dividends" className="mt-4 space-y-3">
              {stock.dividends.map((dividend, index) => (
                <Card key={index} className="p-4 bg-white border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Badge
                        variant="outline"
                        className="bg-green-50 text-green-700 border-green-200"
                      >
                        Dividend
                      </Badge>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{dividend.date}</p>
                        <p className="text-xs text-gray-500">
                          ${dividend.amount} per unit × {dividend.units} units
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-green-600">
                        +${dividend.total.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </TabsContent>

            {/* Performance Tab */}
            <TabsContent value="performance" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-6 bg-white border-gray-200">
                  <p className="text-sm text-gray-500 mb-1">Total Invested</p>
                  <p className="text-2xl font-medium text-gray-900">
                    ${totalInvested.toLocaleString()}
                  </p>
                </Card>
                <Card className="p-6 bg-white border-gray-200">
                  <p className="text-sm text-gray-500 mb-1">Total Returns</p>
                  <p
                    className={`text-2xl font-medium ${
                      totalReturns >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {totalReturns >= 0 ? "+" : ""}${totalReturns.toFixed(0)}
                  </p>
                </Card>
                <Card className="p-6 bg-white border-gray-200">
                  <p className="text-sm text-gray-500 mb-1">Total Dividends</p>
                  <p className="text-2xl font-medium text-green-600">
                    ${totalDividends.toLocaleString()}
                  </p>
                </Card>
                <Card className="p-6 bg-white border-gray-200">
                  <p className="text-sm text-gray-500 mb-1">Dividend Yield</p>
                  <p className="text-2xl font-medium text-gray-900">{yieldPercent.toFixed(2)}%</p>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
