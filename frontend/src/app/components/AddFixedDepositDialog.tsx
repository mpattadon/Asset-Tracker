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

interface AddFixedDepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddFixedDepositDialog({ open, onOpenChange }: AddFixedDepositDialogProps) {
  const [amount, setAmount] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [duration, setDuration] = useState("");
  const [maturityDate, setMaturityDate] = useState("");
  const [startDate, setStartDate] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log({ amount, interestRate, duration, maturityDate, startDate });
    onOpenChange(false);
    // Reset form
    setAmount("");
    setInterestRate("");
    setDuration("");
    setMaturityDate("");
    setStartDate("");
  };

  // Calculate maturity amount
  const maturityAmount = amount && interestRate && duration
    ? parseFloat(amount) * (1 + (parseFloat(interestRate) / 100) * (parseFloat(duration) / 12))
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Fixed Deposit</DialogTitle>
          <DialogDescription>Create a new fixed deposit entry</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="start-date">Start Date</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Deposit Amount (฿)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="interest-rate">Interest Rate (% per annum)</Label>
            <Input
              id="interest-rate"
              type="number"
              step="0.01"
              placeholder="e.g. 2.5"
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">Duration (months)</Label>
            <Input
              id="duration"
              type="number"
              placeholder="e.g. 12"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maturity-date">Maturity Date</Label>
            <Input
              id="maturity-date"
              type="date"
              value={maturityDate}
              onChange={(e) => setMaturityDate(e.target.value)}
              required
            />
          </div>

          {maturityAmount > 0 && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-2">
              <h4 className="text-sm font-medium text-gray-900">Estimated Maturity</h4>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Principal:</span>
                <span className="font-medium text-gray-900">฿{parseFloat(amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Interest:</span>
                <span className="font-medium text-green-600">
                  ฿{(maturityAmount - parseFloat(amount)).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                <span className="text-gray-600">Maturity Amount:</span>
                <span className="font-medium text-gray-900">฿{maturityAmount.toLocaleString()}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Add Fixed Deposit</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
