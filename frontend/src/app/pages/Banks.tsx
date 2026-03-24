import { useState } from "react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Plus, ChevronDown, ChevronUp } from "lucide-react";
import { AddMarketDialog } from "../components/AddMarketDialog";
import { AddBankAccountDialog } from "../components/AddBankAccountDialog";
import { AddTransactionBankDialog } from "../components/AddTransactionBankDialog";
import { AddFixedDepositDialog } from "../components/AddFixedDepositDialog";
import { PageContainer, PageHeader, SummaryCard, SummaryGrid, DataCard } from "../components/layout/index";

// Sample bank data by country
const banksByCountry = {
  thailand: {
    accounts: [
      {
        id: "th-1",
        bankName: "Bangkok Bank",
        accountType: "Savings",
        accountNumber: "****3456",
        balance: 312500,
        interestRate: 1.5,
        compounded: "Monthly",
        transactions: [
          { date: "2026-03-20", name: "Salary Deposit", amount: 50000, type: "add" },
          { date: "2026-03-18", name: "Rent Payment", amount: -15000, type: "deduct" },
          { date: "2026-03-15", name: "Utilities", amount: -2500, type: "deduct" },
          { date: "2026-03-10", name: "Freelance Income", amount: 8000, type: "add" },
          { date: "2026-03-05", name: "Grocery", amount: -3200, type: "deduct" },
        ],
      },
      {
        id: "th-2",
        bankName: "Bangkok Bank",
        accountType: "Fixed Deposit",
        accountNumber: "****7890",
        balance: 500000,
        interestRate: 2.5,
        compounded: "Monthly",
        transactions: [],
      },
      {
        id: "th-3",
        bankName: "Kasikorn Bank",
        accountType: "Savings",
        accountNumber: "****1234",
        balance: 185000,
        interestRate: 1.25,
        compounded: "Daily",
        transactions: [
          { date: "2026-03-22", name: "Investment Return", amount: 12000, type: "add" },
          { date: "2026-03-19", name: "Insurance", amount: -5000, type: "deduct" },
          { date: "2026-03-12", name: "Online Shopping", amount: -8500, type: "deduct" },
        ],
      },
    ],
    fixedDeposits: [
      {
        id: "fd-th-1",
        bankName: "Bangkok Bank",
        amount: 500000,
        interestRate: 2.5,
        duration: 12,
        startDate: "2026-01-15",
        maturityDate: "2027-01-15",
        maturityAmount: 512500,
      },
      {
        id: "fd-th-2",
        bankName: "Kasikorn Bank",
        amount: 300000,
        interestRate: 2.75,
        duration: 24,
        startDate: "2025-12-01",
        maturityDate: "2027-12-01",
        maturityAmount: 316500,
      },
    ],
  },
  us: {
    accounts: [
      {
        id: "us-1",
        bankName: "Chase Bank",
        accountType: "Checking",
        accountNumber: "****1234",
        balance: 15420.5,
        interestRate: 0.01,
        compounded: "Monthly",
        transactions: [
          { date: "2026-03-21", name: "Direct Deposit", amount: 5000, type: "add" },
          { date: "2026-03-19", name: "Mortgage", amount: -2500, type: "deduct" },
          { date: "2026-03-15", name: "Car Payment", amount: -450, type: "deduct" },
        ],
      },
      {
        id: "us-2",
        bankName: "Chase Bank",
        accountType: "Savings",
        accountNumber: "****5678",
        balance: 25000.0,
        interestRate: 4.5,
        compounded: "Monthly",
        transactions: [
          { date: "2026-03-20", name: "Transfer from Checking", amount: 1000, type: "add" },
        ],
      },
    ],
    fixedDeposits: [
      {
        id: "fd-us-1",
        bankName: "Chase Bank",
        amount: 50000,
        interestRate: 5.0,
        duration: 12,
        startDate: "2026-02-01",
        maturityDate: "2027-02-01",
        maturityAmount: 52500,
      },
    ],
  },
};

export function Banks() {
  const [country, setCountry] = useState("thailand");
  const [addCountryOpen, setAddCountryOpen] = useState(false);
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [addTransactionOpen, setAddTransactionOpen] = useState(false);
  const [addDepositOpen, setAddDepositOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);
  const [showAllTransactions, setShowAllTransactions] = useState<Record<string, boolean>>({});

  const currentData = banksByCountry[country as keyof typeof banksByCountry];
  const totalBalance = currentData.accounts.reduce((sum, acc) => sum + acc.balance, 0);
  const totalFixed = currentData.fixedDeposits.reduce((sum, fd) => sum + fd.amount, 0);

  // Group accounts by bank
  const accountsByBank = currentData.accounts.reduce((acc, account) => {
    if (!acc[account.bankName]) {
      acc[account.bankName] = [];
    }
    acc[account.bankName].push(account);
    return acc;
  }, {} as Record<string, typeof currentData.accounts>);

  const symbol = country === "thailand" ? "฿" : "$";

  return (
    <PageContainer>
      <PageHeader title="Banks">
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="thailand">Thailand</SelectItem>
            <SelectItem value="us">United States</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => setAddCountryOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Country
        </Button>
        <Button size="sm" onClick={() => setAddAccountOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Account
        </Button>
      </PageHeader>

      {/* Summary Cards */}
      <SummaryGrid columns={3}>
        <SummaryCard label="Total Accounts" value={currentData.accounts.length} />
        <SummaryCard label="Total Balance" value={`${symbol}${totalBalance.toLocaleString()}`} />
        <SummaryCard label="Fixed Deposits" value={`${symbol}${totalFixed.toLocaleString()}`} />
      </SummaryGrid>

      {/* Bank Accounts Section */}
      <DataCard title="Bank Accounts">
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {Object.entries(accountsByBank).map(([bankName, accounts]) => (
            <div key={bankName} className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-medium text-gray-900">{bankName}</h4>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  {accounts.length} {accounts.length === 1 ? "Account" : "Accounts"}
                </Badge>
              </div>

              <div className="space-y-4">
                {accounts.map((account) => (
                  <Card key={account.id} className="border-gray-200">
                    <div 
                      className="p-4 cursor-pointer hover:bg-gray-50"
                      onClick={() => setExpandedAccount(expandedAccount === account.id ? null : account.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex items-center gap-2">
                            {expandedAccount === account.id ? (
                              <ChevronUp className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline">{account.accountType}</Badge>
                              <span className="text-sm text-gray-500">{account.accountNumber}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {account.interestRate}% interest • Compounded {account.compounded}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-medium text-gray-900">
                            {symbol}{account.balance.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {expandedAccount === account.id && account.transactions.length > 0 && (
                      <div className="border-t border-gray-200 p-4 bg-gray-50">
                        <div className="flex items-center justify-between mb-4">
                          <h5 className="text-sm font-medium text-gray-900">Recent Transactions</h5>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAccount(account.id);
                              setAddTransactionOpen(true);
                            }}
                            className="gap-2"
                          >
                            <Plus className="w-3 h-3" />
                            Add Transaction
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {account.transactions
                            .slice(0, showAllTransactions[account.id] ? undefined : 5)
                            .map((transaction, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
                            >
                              <div>
                                <p className="text-sm font-medium text-gray-900">{transaction.name}</p>
                                <p className="text-xs text-gray-500">{transaction.date}</p>
                              </div>
                              <div className="text-right">
                                <p className={`text-sm font-medium ${
                                  transaction.type === "add" ? "text-green-600" : "text-red-600"
                                }`}>
                                  {transaction.type === "add" ? "+" : "-"}{symbol}{Math.abs(transaction.amount).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                        {account.transactions.length > 5 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full mt-3"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowAllTransactions({
                                ...showAllTransactions,
                                [account.id]: !showAllTransactions[account.id],
                              });
                            }}
                          >
                            {showAllTransactions[account.id] ? "Show Less" : "Load More"}
                          </Button>
                        )}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DataCard>

      {/* Fixed Deposits Section */}
      <DataCard title="Fixed Deposits">
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {currentData.fixedDeposits.map((fd) => (
            <Card key={fd.id} className="border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <p className="text-base font-medium text-gray-900">{fd.bankName}</p>
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                      {fd.duration} months
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>{fd.interestRate}% p.a.</span>
                    <span>•</span>
                    <span>{fd.startDate}</span>
                    <span>→</span>
                    <span>{fd.maturityDate}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Principal</p>
                  <p className="text-lg font-medium text-gray-900">{symbol}{fd.amount.toLocaleString()}</p>
                  <p className="text-xs text-green-600 mt-1">
                    Maturity: {symbol}{fd.maturityAmount.toLocaleString()}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
        <div className="p-4 sm:p-6">
          <Button size="sm" onClick={() => setAddDepositOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Deposit
          </Button>
        </div>
      </DataCard>

      {/* Dialogs */}
      <AddMarketDialog 
        open={addCountryOpen} 
        onOpenChange={setAddCountryOpen}
        title="Add Country"
        description="Add a new country to track bank accounts"
      />
      <AddBankAccountDialog open={addAccountOpen} onOpenChange={setAddAccountOpen} />
      <AddTransactionBankDialog 
        open={addTransactionOpen} 
        onOpenChange={setAddTransactionOpen}
        accountName={selectedAccount || ""}
      />
      <AddFixedDepositDialog open={addDepositOpen} onOpenChange={setAddDepositOpen} />
    </PageContainer>
  );
}
