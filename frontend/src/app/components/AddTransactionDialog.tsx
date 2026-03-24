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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Checkbox } from "./ui/checkbox";

interface AddTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddTransactionDialog({ open, onOpenChange }: AddTransactionDialogProps) {
  const [transactionType, setTransactionType] = useState<"buy" | "sell" | "dividend">("buy");

  // Buy/Sell fields
  const [date, setDate] = useState("");
  const [ticker, setTicker] = useState("");
  const [units, setUnits] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [feeUSD, setFeeUSD] = useState("");
  const [feeTHB, setFeeTHB] = useState("");
  const [exchangeRate, setExchangeRate] = useState("");
  const [totalUSD, setTotalUSD] = useState("");
  const [notes, setNotes] = useState("");

  // Dividend fields
  const [xdDate, setXdDate] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [dividendPerUnit, setDividendPerUnit] = useState("");
  const [unitsHeld, setUnitsHeld] = useState("");
  const [taxDeducted, setTaxDeducted] = useState(false);

  // Calculations for Buy/Sell
  const subtotal = units && pricePerUnit ? parseFloat(units) * parseFloat(pricePerUnit) : 0;
  const realUSD = subtotal + (parseFloat(feeUSD) || 0);
  const realTHB = realUSD * (parseFloat(exchangeRate) || 0);
  const feePercent = subtotal > 0 ? ((parseFloat(feeUSD) || 0) / subtotal) * 100 : 0;
  const pricePerUnitNet = units ? realUSD / parseFloat(units) : 0;

  // Calculations for Dividend
  const totalDividend =
    dividendPerUnit && unitsHeld ? parseFloat(dividendPerUnit) * parseFloat(unitsHeld) : 0;
  const tax = taxDeducted ? 0 : totalDividend * 0.3; // 30% tax if not deducted
  const netReceived = totalDividend - tax;
  const dividendYield = pricePerUnit && dividendPerUnit 
    ? (parseFloat(dividendPerUnit) / parseFloat(pricePerUnit)) * 100 
    : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle transaction submission
    console.log({ transactionType, date, ticker, units, pricePerUnit, feeUSD, notes });
    onOpenChange(false);
    // Reset form
    resetForm();
  };

  const resetForm = () => {
    setDate("");
    setTicker("");
    setUnits("");
    setPricePerUnit("");
    setFeeUSD("");
    setFeeTHB("");
    setExchangeRate("");
    setTotalUSD("");
    setNotes("");
    setXdDate("");
    setPaymentDate("");
    setDividendPerUnit("");
    setUnitsHeld("");
    setTaxDeducted(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
          <DialogDescription>Record a stock transaction or dividend payment</DialogDescription>
        </DialogHeader>

        <Tabs value={transactionType} onValueChange={(v) => setTransactionType(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="buy">Buy</TabsTrigger>
            <TabsTrigger value="sell">Sell</TabsTrigger>
            <TabsTrigger value="dividend">Dividend</TabsTrigger>
          </TabsList>

          {/* BUY/SELL TAB */}
          <TabsContent value="buy" className="space-y-4 mt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ticker">Ticker</Label>
                  <Input
                    id="ticker"
                    placeholder="e.g. AAPL"
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="units">Units</Label>
                  <Input
                    id="units"
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={units}
                    onChange={(e) => setUnits(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price-per-unit">Price per Unit</Label>
                  <Input
                    id="price-per-unit"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={pricePerUnit}
                    onChange={(e) => setPricePerUnit(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fee-usd">Net USD Fee</Label>
                  <Input
                    id="fee-usd"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={feeUSD}
                    onChange={(e) => setFeeUSD(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fee-thb">Net THB Fee</Label>
                  <Input
                    id="fee-thb"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={feeTHB}
                    onChange={(e) => setFeeTHB(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="exchange-rate">Exchange Rate</Label>
                  <Input
                    id="exchange-rate"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="total-usd">USD Total</Label>
                  <Input
                    id="total-usd"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={totalUSD}
                    onChange={(e) => setTotalUSD(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  placeholder="Optional notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Auto-calculated values */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-2">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Auto-calculated</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium text-gray-900">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Fee %:</span>
                    <span className="font-medium text-gray-900">{feePercent.toFixed(3)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Real USD:</span>
                    <span className="font-medium text-gray-900">${realUSD.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Real THB:</span>
                    <span className="font-medium text-gray-900">฿{realTHB.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between col-span-2">
                    <span className="text-gray-600">Price/Unit Net:</span>
                    <span className="font-medium text-gray-900">${pricePerUnitNet.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add Buy Transaction</Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="sell" className="space-y-4 mt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Same form as Buy, just different submit button */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sell-date">Date</Label>
                  <Input
                    id="sell-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sell-ticker">Ticker</Label>
                  <Input
                    id="sell-ticker"
                    placeholder="e.g. AAPL"
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sell-units">Units</Label>
                  <Input
                    id="sell-units"
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={units}
                    onChange={(e) => setUnits(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sell-price">Price per Unit</Label>
                  <Input
                    id="sell-price"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={pricePerUnit}
                    onChange={(e) => setPricePerUnit(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sell-fee-usd">Net USD Fee</Label>
                  <Input
                    id="sell-fee-usd"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={feeUSD}
                    onChange={(e) => setFeeUSD(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sell-exchange">Exchange Rate</Label>
                  <Input
                    id="sell-exchange"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sell-notes">Notes</Label>
                <Input
                  id="sell-notes"
                  placeholder="Optional notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-2">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Auto-calculated</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium text-gray-900">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Real USD:</span>
                    <span className="font-medium text-gray-900">${realUSD.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add Sell Transaction</Button>
              </div>
            </form>
          </TabsContent>

          {/* DIVIDEND TAB */}
          <TabsContent value="dividend" className="space-y-4 mt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="xd-date">XD Date</Label>
                  <Input
                    id="xd-date"
                    type="date"
                    value={xdDate}
                    onChange={(e) => setXdDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment-date">Payment Date</Label>
                  <Input
                    id="payment-date"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="div-ticker">Ticker</Label>
                <Input
                  id="div-ticker"
                  placeholder="e.g. AAPL"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dividend-per-unit">Dividend per Unit</Label>
                  <Input
                    id="dividend-per-unit"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={dividendPerUnit}
                    onChange={(e) => setDividendPerUnit(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="units-held">Units Held</Label>
                  <Input
                    id="units-held"
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={unitsHeld}
                    onChange={(e) => setUnitsHeld(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="tax-deducted"
                  checked={taxDeducted}
                  onCheckedChange={(checked) => setTaxDeducted(checked as boolean)}
                />
                <Label
                  htmlFor="tax-deducted"
                  className="text-sm font-normal cursor-pointer"
                >
                  Tax already deducted
                </Label>
              </div>

              {/* Auto-calculated values */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-2">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Auto-calculated</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Dividend:</span>
                    <span className="font-medium text-gray-900">${totalDividend.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tax (30%):</span>
                    <span className="font-medium text-gray-900">${tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Net Received:</span>
                    <span className="font-medium text-green-600">${netReceived.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Dividend Yield:</span>
                    <span className="font-medium text-gray-900">{dividendYield.toFixed(2)}%</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add Dividend</Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
