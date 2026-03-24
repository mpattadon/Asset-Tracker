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

interface AddMarketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
}

export function AddMarketDialog({ 
  open, 
  onOpenChange,
  title = "Add Market",
  description = "Add a new market to track your assets"
}: AddMarketDialogProps) {
  const [marketName, setMarketName] = useState("");
  const [currency, setCurrency] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle market addition logic here
    console.log({ marketName, currency });
    onOpenChange(false);
    // Reset form
    setMarketName("");
    setCurrency("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="market-name">Market Name</Label>
            <Input
              id="market-name"
              placeholder="e.g. US, TH, JP, etc."
              value={marketName}
              onChange={(e) => setMarketName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger id="currency">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="THB">THB (฿)</SelectItem>
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="EUR">EUR (€)</SelectItem>
                <SelectItem value="GBP">GBP (£)</SelectItem>
                <SelectItem value="JPY">JPY (¥)</SelectItem>
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
            <Button type="submit">Add Market</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
