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

interface LogGoldPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LogGoldPurchaseDialog({ open, onOpenChange }: LogGoldPurchaseDialogProps) {
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle purchase logging logic here
    console.log({ date, amount, price });
    onOpenChange(false);
    // Reset form
    setDate("");
    setAmount("");
    setPrice("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Log Gold Purchase</DialogTitle>
          <DialogDescription>Record a new gold purchase transaction</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="purchase-date">Purchase Date</Label>
            <Input
              id="purchase-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (grams or units)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="e.g. 100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">Price per Unit (฿)</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>

          {amount && price && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Cost:</span>
                <span className="font-medium text-gray-900">
                  ฿{(parseFloat(amount) * parseFloat(price)).toLocaleString()}
                </span>
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
            <Button type="submit">Log Purchase</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
