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
import { Badge } from "../components/ui/badge";
import { TrendingUp, TrendingDown, Plus } from "lucide-react";
import { AddMarketDialog } from "../components/AddMarketDialog";
import { PageContainer, PageHeader, SummaryCard, SummaryGrid, DataCard } from "../components/layout/index";

const optionsContracts = [
  {
    underlying: "AAPL",
    type: "Call",
    strike: 180,
    expiry: "2026-06-19",
    contracts: 5,
    premium: 8.5,
    currentPrice: 10.2,
    status: "Open",
  },
  {
    underlying: "TSLA",
    type: "Put",
    strike: 250,
    expiry: "2026-05-15",
    contracts: 3,
    premium: 12.0,
    currentPrice: 15.8,
    status: "Open",
  },
  {
    underlying: "MSFT",
    type: "Call",
    strike: 420,
    expiry: "2026-07-17",
    contracts: 10,
    premium: 15.3,
    currentPrice: 18.7,
    status: "Open",
  },
  {
    underlying: "NVDA",
    type: "Call",
    strike: 900,
    expiry: "2026-04-16",
    contracts: 2,
    premium: 42.5,
    currentPrice: 28.1,
    status: "Expired",
  },
  {
    underlying: "SPY",
    type: "Put",
    strike: 500,
    expiry: "2026-03-20",
    contracts: 8,
    premium: 6.8,
    currentPrice: 0,
    status: "Expired",
  },
];

export function Options() {
  const [market, setMarket] = useState("us");
  const [addMarketOpen, setAddMarketOpen] = useState(false);

  const openContracts = optionsContracts.filter((c) => c.status === "Open");
  const totalInvested = optionsContracts.reduce(
    (sum, contract) => sum + contract.premium * contract.contracts * 100,
    0
  );
  const currentValue = openContracts.reduce(
    (sum, contract) => sum + contract.currentPrice * contract.contracts * 100,
    0
  );
  const unrealizedPL = currentValue - totalInvested;

  return (
    <PageContainer>
      <PageHeader title="Options">
        <Select value={market} onValueChange={setMarket}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="us">US Market</SelectItem>
            <SelectItem value="thai">Thai Market</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => setAddMarketOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Market
        </Button>
      </PageHeader>

      {/* Summary Cards */}
      <SummaryGrid columns={4}>
        <SummaryCard label="Open Contracts" value={openContracts.length} />
        <SummaryCard label="Total Invested" value={`$${totalInvested.toLocaleString()}`} />
        <SummaryCard label="Current Value" value={`$${currentValue.toLocaleString()}`} />
        <SummaryCard
          label="Unrealized P/L"
          value={`${unrealizedPL >= 0 ? "+" : ""}$${unrealizedPL.toLocaleString()}`}
          icon={
            unrealizedPL >= 0 ? (
              <TrendingUp className="w-5 h-5 text-green-600" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-600" />
            )
          }
        />
      </SummaryGrid>

      {/* Options Contracts Table */}
      <DataCard title="Options Contracts">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-medium text-gray-600">Underlying</TableHead>
                <TableHead className="font-medium text-gray-600">Type</TableHead>
                <TableHead className="font-medium text-gray-600 text-right">Strike</TableHead>
                <TableHead className="font-medium text-gray-600">Expiry</TableHead>
                <TableHead className="font-medium text-gray-600 text-right">
                  Contracts
                </TableHead>
                <TableHead className="font-medium text-gray-600 text-right">
                  Avg Premium
                </TableHead>
                <TableHead className="font-medium text-gray-600 text-right">
                  Current Price
                </TableHead>
                <TableHead className="font-medium text-gray-600 text-right">P/L</TableHead>
                <TableHead className="font-medium text-gray-600">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {optionsContracts.map((option, index) => {
                const pl = (option.currentPrice - option.premium) * option.contracts * 100;
                const plPercent =
                  ((option.currentPrice - option.premium) / option.premium) * 100;

                return (
                  <TableRow key={index} className="hover:bg-gray-50">
                    <TableCell className="font-medium text-gray-900">
                      {option.underlying}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          option.type === "Call"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-red-50 text-red-700 border-red-200"
                        }
                      >
                        {option.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-gray-900">
                      ${option.strike}
                    </TableCell>
                    <TableCell className="text-gray-600">{option.expiry}</TableCell>
                    <TableCell className="text-right text-gray-900">
                      {option.contracts}
                    </TableCell>
                    <TableCell className="text-right text-gray-900">
                      ${option.premium.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-gray-900">
                      ${option.currentPrice.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span
                          className={`font-medium ${
                            pl >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {pl >= 0 ? "+" : ""}${pl.toFixed(0)}
                        </span>
                        <span
                          className={`text-xs ${
                            pl >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          ({plPercent >= 0 ? "+" : ""}
                          {plPercent.toFixed(1)}%)
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={option.status === "Open" ? "default" : "outline"}
                        className={
                          option.status === "Open"
                            ? "bg-blue-100 text-blue-700 hover:bg-blue-100"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-100"
                        }
                      >
                        {option.status}
                      </Badge>
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
    </PageContainer>
  );
}
