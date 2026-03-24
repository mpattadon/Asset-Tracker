import { useState } from "react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { ChevronDown, ChevronUp, Plus, TrendingUp, TrendingDown } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { AddPurchaseDialog } from "../components/AddPurchaseDialog";
import { LogMonthlyDataDialog } from "../components/LogMonthlyDataDialog";
import { PageContainer, PageHeader, SummaryCard, SummaryGrid, DataCard } from "../components/layout/index";

// Sample data structure
const fundsData = [
  {
    bank: "SCB",
    accounts: [
      {
        accountNumber: "XXX-X-XXXXX-X",
        notes: "SCBAM",
        funds: [
          {
            name: "SCB-GMCORE(A)",
            riskLevel: "Low",
            category: "Equity",
            totalInvested: 50000,
            currentValue: 54200,
            dividends: 1200,
            monthlyData: [
              { month: "Jan 2026", invested: 50000, marketValue: 51500, dividends: 200 },
              { month: "Feb 2026", invested: 50000, marketValue: 52800, dividends: 400 },
              { month: "Mar 2026", invested: 50000, marketValue: 54200, dividends: 600 },
            ],
            chartData: [
              { value: 51500 },
              { value: 52800 },
              { value: 54200 },
            ],
          },
          {
            name: "SCB-EQUITY",
            riskLevel: "High",
            category: "Equity",
            totalInvested: 30000,
            currentValue: 32400,
            dividends: 800,
            monthlyData: [
              { month: "Jan 2026", invested: 30000, marketValue: 30900, dividends: 200 },
              { month: "Feb 2026", invested: 30000, marketValue: 31800, dividends: 400 },
              { month: "Mar 2026", invested: 30000, marketValue: 32400, dividends: 200 },
            ],
            chartData: [
              { value: 30900 },
              { value: 31800 },
              { value: 32400 },
            ],
          },
        ],
      },
      {
        accountNumber: "XXX-X-XXXXX-Y",
        notes: "Link account",
        funds: [
          {
            name: "SCB-DIVIDEND",
            riskLevel: "Medium",
            category: "Mixed",
            totalInvested: 40000,
            currentValue: 41500,
            dividends: 2100,
            monthlyData: [
              { month: "Jan 2026", invested: 40000, marketValue: 40500, dividends: 700 },
              { month: "Feb 2026", invested: 40000, marketValue: 41000, dividends: 700 },
              { month: "Mar 2026", invested: 40000, marketValue: 41500, dividends: 700 },
            ],
            chartData: [
              { value: 40500 },
              { value: 41000 },
              { value: 41500 },
            ],
          },
        ],
      },
    ],
  },
  {
    bank: "BBL",
    accounts: [
      {
        accountNumber: "XXX-X-XXXXX-Z",
        notes: "BBLAM",
        funds: [
          {
            name: "BBL-GROWTH",
            riskLevel: "High",
            category: "Equity",
            totalInvested: 25000,
            currentValue: 26800,
            dividends: 400,
            monthlyData: [
              { month: "Jan 2026", invested: 25000, marketValue: 25600, dividends: 100 },
              { month: "Feb 2026", invested: 25000, marketValue: 26200, dividends: 150 },
              { month: "Mar 2026", invested: 25000, marketValue: 26800, dividends: 150 },
            ],
            chartData: [
              { value: 25600 },
              { value: 26200 },
              { value: 26800 },
            ],
          },
        ],
      },
    ],
  },
];

interface FundCardProps {
  fund: any;
}

function FundCard({ fund }: FundCardProps) {
  const [expanded, setExpanded] = useState(false);
  const gainLoss = fund.currentValue - fund.totalInvested;
  const gainLossPercent = (gainLoss / fund.totalInvested) * 100;
  const isPositive = gainLoss >= 0;

  return (
    <Card className="bg-white border-gray-200 shadow-sm">
      <div className="p-5">
        {/* Top Row */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <h4 className="text-base font-medium text-gray-900">{fund.name}</h4>
            <Badge
              variant="outline"
              className={
                fund.riskLevel === "Low"
                  ? "bg-green-50 text-green-700 border-green-200"
                  : fund.riskLevel === "Medium"
                  ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                  : "bg-red-50 text-red-700 border-red-200"
              }
            >
              {fund.riskLevel}
            </Badge>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {fund.category}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="gap-1"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Hide
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Details
              </>
            )}
          </Button>
        </div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Total Invested</p>
            <p className="text-base font-medium text-gray-900">
              ${fund.totalInvested.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Current Value</p>
            <p className="text-base font-medium text-gray-900">
              ${fund.currentValue.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Gain/Loss</p>
            <div className="flex items-center gap-1">
              <p className={`text-base font-medium ${isPositive ? "text-green-600" : "text-red-600"}`}>
                {isPositive ? "+" : ""}${gainLoss.toLocaleString()}
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
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Total Dividends</p>
            <p className="text-base font-medium text-gray-900">
              ${fund.dividends.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Mini Chart */}
        <div className="h-16 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={fund.chartData}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={isPositive ? "#10b981" : "#ef4444"}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Expandable Monthly Data */}
      {expanded && (
        <div className="border-t border-gray-200 p-5 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <h5 className="text-sm font-medium text-gray-900">Monthly Data</h5>
            <Button variant="outline" size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Add Monthly Entry
            </Button>
          </div>
          <div className="space-y-2">
            {fund.monthlyData.map((entry: any, index: number) => {
              const monthGainLoss = entry.marketValue - entry.invested;
              const monthIsPositive = monthGainLoss >= 0;
              
              return (
                <div
                  key={index}
                  className="bg-white rounded-lg p-4 border border-gray-200"
                >
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Month</p>
                      <p className="text-sm font-medium text-gray-900">{entry.month}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Invested</p>
                      <p className="text-sm text-gray-900">${entry.invested.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Market Value</p>
                      <p className="text-sm text-gray-900">${entry.marketValue.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Gain/Loss</p>
                      <p
                        className={`text-sm font-medium ${
                          monthIsPositive ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {monthIsPositive ? "+" : ""}${monthGainLoss.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Dividends</p>
                      <p className="text-sm text-gray-900">${entry.dividends.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

export function MutualFunds() {
  const [selectedBank, setSelectedBank] = useState<string>("all");
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [addPurchaseOpen, setAddPurchaseOpen] = useState(false);
  const [logMonthlyOpen, setLogMonthlyOpen] = useState(false);

  // Calculate totals
  const totalInvested = fundsData.reduce(
    (sum, bank) =>
      sum +
      bank.accounts.reduce(
        (accSum, account) =>
          accSum + account.funds.reduce((fundSum, fund) => fundSum + fund.totalInvested, 0),
        0
      ),
    0
  );

  const totalCurrent = fundsData.reduce(
    (sum, bank) =>
      sum +
      bank.accounts.reduce(
        (accSum, account) =>
          accSum + account.funds.reduce((fundSum, fund) => fundSum + fund.currentValue, 0),
        0
      ),
    0
  );

  const totalGainLoss = totalCurrent - totalInvested;
  const isPositive = totalGainLoss >= 0;

  return (
    <PageContainer>
      {/* Header Section */}
      <div className="space-y-3 sm:space-y-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-normal text-gray-900 mb-2">Mutual Funds</h2>
          <p className="text-sm text-gray-500">
            Track your mutual fund investments across accounts and banks
          </p>
        </div>

        {/* Action Buttons and Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Button onClick={() => setAddPurchaseOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Purchase
            </Button>
            <Button variant="outline" onClick={() => setLogMonthlyOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Log Monthly Data
            </Button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Select value={selectedBank} onValueChange={setSelectedBank}>
              <SelectTrigger className="w-[140px] sm:w-[150px]">
                <SelectValue placeholder="All Banks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Banks</SelectItem>
                <SelectItem value="scb">SCB</SelectItem>
                <SelectItem value="bbl">BBL</SelectItem>
                <SelectItem value="ttb">TTB</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger className="w-[140px] sm:w-[150px]">
                <SelectValue placeholder="All Accounts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                <SelectItem value="1">Account 1</SelectItem>
                <SelectItem value="2">Account 2</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryGrid>
        <SummaryCard>
          <p className="text-sm text-gray-500 mb-1">Total Invested</p>
          <p className="text-2xl font-normal text-gray-900">${totalInvested.toLocaleString()}</p>
        </SummaryCard>
        <SummaryCard>
          <p className="text-sm text-gray-500 mb-1">Current Value</p>
          <p className="text-2xl font-normal text-gray-900">${totalCurrent.toLocaleString()}</p>
        </SummaryCard>
        <SummaryCard>
          <p className="text-sm text-gray-500 mb-1">Total Gain/Loss</p>
          <div className="flex items-center gap-2">
            <p className={`text-2xl font-normal ${isPositive ? "text-green-600" : "text-red-600"}`}>
              {isPositive ? "+" : ""}${totalGainLoss.toLocaleString()}
            </p>
            {isPositive ? (
              <TrendingUp className="w-5 h-5 text-green-600" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-600" />
            )}
          </div>
        </SummaryCard>
      </SummaryGrid>

      {/* Hierarchical Fund Display */}
      {fundsData.map((bankData) => (
        <div key={bankData.bank} className="space-y-4">
          {/* Bank Header */}
          <div className="flex items-center gap-3">
            <div className="h-px bg-gray-200 flex-1" />
            <h3 className="text-lg font-medium text-gray-900">{bankData.bank}</h3>
            <div className="h-px bg-gray-200 flex-1" />
          </div>

          {/* Accounts */}
          {bankData.accounts.map((account, accountIndex) => (
            <div key={accountIndex} className="space-y-3">
              {/* Account Header */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Account: {account.accountNumber}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{account.notes}</p>
                  </div>
                </div>
              </div>

              {/* Funds */}
              <div className="space-y-3 ml-4">
                {account.funds.map((fund, fundIndex) => (
                  <FundCard key={fundIndex} fund={fund} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

      <AddPurchaseDialog open={addPurchaseOpen} onOpenChange={setAddPurchaseOpen} />
      <LogMonthlyDataDialog open={logMonthlyOpen} onOpenChange={setLogMonthlyOpen} />
    </PageContainer>
  );
}
