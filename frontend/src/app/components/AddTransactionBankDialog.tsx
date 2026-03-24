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

interface AddTransactionBankDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountName?: string;
}

export function AddTransactionBankDialog({ 
  open, 
  onOpenChange,
  accountName = "Account"
}: AddTransactionBankDialogProps) {
  const [transactionName, setTransactionName] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"add" | "deduct">("add");
  const [date, setDate] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log({ transactionName, amount, type, date });
    onOpenChange(false);
    // Reset form
    setTransactionName("");
    setAmount("");
    setType("add");
    setDate("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
          <DialogDescription>Log a transaction for {accountName}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
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
            <Label htmlFor="transaction-name">Transaction Name</Label>
            <Input
              id="transaction-name"
              placeholder="e.g. Salary, Rent, Utilities"
              value={transactionName}
              onChange={(e) => setTransactionName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (฿)</Label>
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
            <Label htmlFor="type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as "add" | "deduct")}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="add">Add (Credit)</SelectItem>
                <SelectItem value="deduct">Deduct (Debit)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Add Transaction</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
