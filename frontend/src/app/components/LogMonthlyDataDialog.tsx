import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface LogMonthlyDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LogMonthlyDataDialog({ open, onOpenChange }: LogMonthlyDataDialogProps) {
  const [fund, setFund] = useState("");
  const [month, setMonth] = useState("");
  const [marketValue, setMarketValue] = useState("");
  const [dividends, setDividends] = useState("");

  // Mock data - in real app, this would come from state/database
  const totalInvested = 50000;
  const gainLoss = marketValue
    ? (parseFloat(marketValue) - totalInvested).toFixed(2)
    : "0.00";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle monthly data logging here
    console.log({ fund, month, marketValue, dividends, gainLoss });
    onOpenChange(false);
    // Reset form
    setFund("");
    setMonth("");
    setMarketValue("");
    setDividends("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Log Monthly Data</DialogTitle>
          <DialogDescription>
            Record monthly market value and dividends for a fund
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="fund">Select Fund</Label>
            <Select value={fund} onValueChange={setFund}>
              <SelectTrigger id="fund">
                <SelectValue placeholder="Choose a fund" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scb-gmcore">SCB-GMCORE(A)</SelectItem>
                <SelectItem value="scb-equity">SCB-EQUITY</SelectItem>
                <SelectItem value="scb-dividend">SCB-DIVIDEND</SelectItem>
                <SelectItem value="bbl-growth">BBL-GROWTH</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="month">Month</Label>
            <Input
              id="month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="market-value">Market Value</Label>
            <Input
              id="market-value"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={marketValue}
              onChange={(e) => setMarketValue(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dividends">Dividends Received</Label>
            <Input
              id="dividends"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={dividends}
              onChange={(e) => setDividends(e.target.value)}
            />
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Invested</span>
              <span className="text-sm font-medium text-gray-900">
                ${totalInvested.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Gain/Loss</span>
              <span
                className={`text-sm font-medium ${
                  parseFloat(gainLoss) >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {parseFloat(gainLoss) >= 0 ? "+" : ""}${gainLoss}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Log Data</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
