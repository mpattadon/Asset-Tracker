import { useState } from "react";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { TrendingUp, TrendingDown, Plus } from "lucide-react";
import { TradingViewChart } from "../components/charts/TradingViewChart";
import { AddMarketDialog } from "../components/AddMarketDialog";
import { LogGoldPurchaseDialog } from "../components/LogGoldPurchaseDialog";
import { PageContainer, PageHeader, SummaryCard, SummaryGrid, DataCard } from "../components/layout/index";
import { useAuth } from "../auth";

const goldHoldings = [
  {
    type: "Physical Gold Bar",
    weight: "100g",
    purity: "99.99%",
    purchasePrice: 6250,
    currentPrice: 6580,
    quantity: 3,
  },
  {
    type: "Gold Coins (Krugerrand)",
    weight: "1oz",
    purity: "91.67%",
    purchasePrice: 1950,
    currentPrice: 2080,
    quantity: 10,
  },
  {
    type: "Gold ETF (GLD)",
    weight: "N/A",
    purity: "N/A",
    purchasePrice: 185.50,
    currentPrice: 192.40,
    quantity: 50,
  },
  {
    type: "Digital Gold",
    weight: "50g",
    purity: "99.99%",
    purchasePrice: 3100,
    currentPrice: 3290,
    quantity: 2,
  },
];

const priceHistory = [
  { time: "2026-01-01", value: 2010 },
  { time: "2026-02-01", value: 2040 },
  { time: "2026-03-01", value: 2025 },
  { time: "2026-04-01", value: 2065 },
  { time: "2026-05-01", value: 2090 },
  { time: "2026-06-01", value: 2120 },
];

export function Gold() {
  const { authState } = useAuth();
  const [market, setMarket] = useState("thai");
  const [addMarketOpen, setAddMarketOpen] = useState(false);
  const [logPurchaseOpen, setLogPurchaseOpen] = useState(false);

  const totalValue = goldHoldings.reduce(
    (sum, item) => sum + item.currentPrice * item.quantity,
    0
  );
  const totalInvested = goldHoldings.reduce(
    (sum, item) => sum + item.purchasePrice * item.quantity,
    0
  );
  const totalReturn = ((totalValue - totalInvested) / totalInvested) * 100;

  const symbol = market === "thai" ? "฿" : "$";

  return (
    <PageContainer>
      <PageHeader title="Gold">
        <Select value={market} onValueChange={setMarket}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="thai">Thai Market</SelectItem>
            <SelectItem value="us">US Market</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => setAddMarketOpen(true)} className="gap-2" disabled={!authState?.authenticated}>
          <Plus className="w-4 h-4" />
          {authState?.authenticated ? "Add Market" : "Login to Add"}
        </Button>
        <Button size="sm" onClick={() => setLogPurchaseOpen(true)} className="gap-2" disabled={!authState?.authenticated}>
          <Plus className="w-4 h-4" />
          {authState?.authenticated ? "Log Purchase" : "Login to Add"}
        </Button>
      </PageHeader>

      {/* Summary Cards */}
      <SummaryGrid columns={3}>
        <SummaryCard label="Total Gold Value" value={`${symbol}${totalValue.toLocaleString()}`} />
        <SummaryCard label="Total Invested" value={`${symbol}${totalInvested.toLocaleString()}`} />
        <SummaryCard
          label="Total Return"
          value={`${totalReturn.toFixed(2)}%`}
          icon={
            totalReturn > 0 ? (
              <TrendingUp className="w-5 h-5 text-green-600" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-600" />
            )
          }
        />
      </SummaryGrid>

      {/* Gold Price Chart */}
      <DataCard title="Gold Price Trend (per oz)">
        <div className="p-4 sm:p-8">
          <TradingViewChart
            height={250}
            mode="line"
            lineData={priceHistory}
            currency={market === "thai" ? "THB" : "USD"}
            accentColor="#f59e0b"
          />
        </div>
      </DataCard>

      {/* Gold Holdings Table */}
      <DataCard title="Gold Holdings">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-medium text-gray-600">Type</TableHead>
                <TableHead className="font-medium text-gray-600">Weight</TableHead>
                <TableHead className="font-medium text-gray-600">Purity</TableHead>
                <TableHead className="font-medium text-gray-600 text-right">
                  Purchase Price
                </TableHead>
                <TableHead className="font-medium text-gray-600 text-right">
                  Current Price
                </TableHead>
                <TableHead className="font-medium text-gray-600 text-right">Quantity</TableHead>
                <TableHead className="font-medium text-gray-600 text-right">
                  Total Value
                </TableHead>
                <TableHead className="font-medium text-gray-600 text-right">Gain/Loss</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {goldHoldings.map((item, index) => {
                const totalInvested = item.purchasePrice * item.quantity;
                const totalCurrent = item.currentPrice * item.quantity;
                const gainLoss = ((totalCurrent - totalInvested) / totalInvested) * 100;

                return (
                  <TableRow key={index} className="hover:bg-gray-50">
                    <TableCell className="font-medium text-gray-900">{item.type}</TableCell>
                    <TableCell className="text-gray-600">{item.weight}</TableCell>
                    <TableCell className="text-gray-600">{item.purity}</TableCell>
                    <TableCell className="text-right text-gray-900">
                      {symbol}{item.purchasePrice.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-gray-900">
                      {symbol}{item.currentPrice.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-gray-900">{item.quantity}</TableCell>
                    <TableCell className="text-right text-gray-900">
                      {symbol}{totalCurrent.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {gainLoss > 0 ? (
                          <TrendingUp className="w-4 h-4 text-green-600" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-600" />
                        )}
                        <span
                          className={`font-medium ${
                            gainLoss > 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {gainLoss > 0 ? "+" : ""}
                          {gainLoss.toFixed(2)}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </DataCard>

      {/* Add Market Dialog */}
      <AddMarketDialog open={addMarketOpen} onOpenChange={setAddMarketOpen} />

      {/* Log Gold Purchase Dialog */}
      <LogGoldPurchaseDialog open={logPurchaseOpen} onOpenChange={setLogPurchaseOpen} />
    </PageContainer>
  );
}
