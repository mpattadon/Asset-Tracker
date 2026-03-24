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

interface AddPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddPurchaseDialog({ open, onOpenChange }: AddPurchaseDialogProps) {
  const [fundName, setFundName] = useState("");
  const [bank, setBank] = useState("");
  const [account, setAccount] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [units, setUnits] = useState("");

  const totalCost = avgCost && units ? (parseFloat(avgCost) * parseFloat(units)).toFixed(2) : "0.00";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle purchase addition logic here
    console.log({ fundName, bank, account, avgCost, units, totalCost });
    onOpenChange(false);
    // Reset form
    setFundName("");
    setBank("");
    setAccount("");
    setAvgCost("");
    setUnits("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Purchase</DialogTitle>
          <DialogDescription>
            Record a new mutual fund purchase
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="fund-name">Fund Name</Label>
            <Input
              id="fund-name"
              placeholder="e.g. SCB-GMCORE(A)"
              value={fundName}
              onChange={(e) => setFundName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bank">Bank</Label>
              <Select value={bank} onValueChange={setBank}>
                <SelectTrigger id="bank">
                  <SelectValue placeholder="Select bank" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scb">SCB</SelectItem>
                  <SelectItem value="bbl">BBL</SelectItem>
                  <SelectItem value="ttb">TTB</SelectItem>
                  <SelectItem value="kbank">KBANK</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="account">Account Number</Label>
              <Input
                id="account"
                placeholder="XXX-X-XXXXX-X"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="avg-cost">Average Cost per Unit</Label>
              <Input
                id="avg-cost"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={avgCost}
                onChange={(e) => setAvgCost(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="units">Units Purchased</Label>
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
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Cost</span>
              <span className="text-lg font-medium text-gray-900">${totalCost}</span>
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
            <Button type="submit">Add Purchase</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
