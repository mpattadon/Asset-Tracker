import { useEffect, useState } from "react";
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

interface AddPortfolioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: { name: string; currency: string }) => Promise<void> | void;
  submitting?: boolean;
  error?: string;
}

const CURRENCIES = [
  { value: "USD", label: "USD" },
  { value: "THB", label: "THB" },
  { value: "EUR", label: "EUR" },
  { value: "GBP", label: "GBP" },
  { value: "JPY", label: "JPY" },
];

export function AddPortfolioDialog({
  open,
  onOpenChange,
  onSubmit,
  submitting = false,
  error = "",
}: AddPortfolioDialogProps) {
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");

  useEffect(() => {
    if (!open) {
      return;
    }
    setName("");
    setCurrency("USD");
  }, [open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }
    await onSubmit({
      name: name.trim(),
      currency,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Portfolio</DialogTitle>
          <DialogDescription>
            Create a stock portfolio with a display name and preferred base currency.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="portfolio-name">Portfolio Name</Label>
            <Input
              id="portfolio-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Growth Portfolio"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Preferred Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? "Creating..." : "Create Portfolio"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
