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

interface AddBankAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddBankAccountDialog({ open, onOpenChange }: AddBankAccountDialogProps) {
  const [bankName, setBankName] = useState("");
  const [accountType, setAccountType] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [compoundFrequency, setCompoundFrequency] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log({ bankName, accountType, accountNumber, interestRate, compoundFrequency });
    onOpenChange(false);
    // Reset form
    setBankName("");
    setAccountType("");
    setAccountNumber("");
    setInterestRate("");
    setCompoundFrequency("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Bank Account</DialogTitle>
          <DialogDescription>Add a new bank account to track</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="bank-name">Bank Name</Label>
            <Input
              id="bank-name"
              placeholder="e.g. Bangkok Bank, SCB"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-type">Account Type</Label>
            <Select value={accountType} onValueChange={setAccountType}>
              <SelectTrigger id="account-type">
                <SelectValue placeholder="Select account type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="savings">Savings Account</SelectItem>
                <SelectItem value="checking">Checking Account</SelectItem>
                <SelectItem value="fixed">Fixed Deposit</SelectItem>
                <SelectItem value="current">Current Account</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-number">Account Number</Label>
            <Input
              id="account-number"
              placeholder="e.g. 123-456-7890"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="interest-rate">Interest Rate (%)</Label>
            <Input
              id="interest-rate"
              type="number"
              step="0.01"
              placeholder="e.g. 1.25"
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="compound-frequency">Compounded</Label>
            <Select value={compoundFrequency} onValueChange={setCompoundFrequency}>
              <SelectTrigger id="compound-frequency">
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="annually">Annually</SelectItem>
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
            <Button type="submit">Add Account</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
