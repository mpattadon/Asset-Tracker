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
import { DeleteDoubleConfirmPanel } from "./DeleteDoubleConfirmPanel";
import {
  createMutualFundSale,
  deleteMutualFundSale,
  MutualFundSaleView,
  updateMutualFundSale,
} from "../api";

interface SellMutualFundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void | Promise<void>;
  initialContext?: {
    accountId: string;
    bankName: string;
    accountNumber: string;
    currency: string;
    fundName: string;
  } | null;
  initialSale?: (MutualFundSaleView & {
    accountId: string;
    bankName: string;
    accountNumber: string;
    currency: string;
  }) | null;
}

export function SellMutualFundDialog({
  open,
  onOpenChange,
  onCreated,
  initialContext,
  initialSale,
}: SellMutualFundDialogProps) {
  const [unitsSold, setUnitsSold] = useState("");
  const [salePricePerUnit, setSalePricePerUnit] = useState("");
  const [saleDate, setSaleDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteStage, setConfirmDeleteStage] = useState<0 | 1 | 2>(0);
  const [error, setError] = useState("");

  const reset = () => {
    setUnitsSold("");
    setSalePricePerUnit("");
    setSaleDate("");
    setConfirmDeleteStage(0);
    setError("");
  };

  useEffect(() => {
    if (open && initialSale) {
      setUnitsSold(String(initialSale.unitsSold));
      setSalePricePerUnit(String(initialSale.salePricePerUnit));
      setSaleDate(initialSale.saleDate);
      setConfirmDeleteStage(0);
      setError("");
    } else if (open) {
      reset();
    }
  }, [initialSale, open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const context = initialSale ?? initialContext;
    if (!context) {
      setError("Select a fund before recording a sale.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const payload = {
        accountId: context.accountId,
        fundName: context.fundName,
        unitsSold: Number.parseFloat(unitsSold),
        salePricePerUnit: Number.parseFloat(salePricePerUnit),
        saleDate,
      };
      if (initialSale) {
        await updateMutualFundSale(initialSale.id, payload);
      } else {
        await createMutualFundSale(payload);
      }
      onOpenChange(false);
      reset();
      await onCreated?.();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to record sale.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!initialSale) {
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await deleteMutualFundSale(initialSale.id);
      onOpenChange(false);
      reset();
      await onCreated?.();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to delete sale.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          reset();
        }
      }}
    >
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Sell Mutual Fund</DialogTitle>
          <DialogDescription>
            Record a FIFO-based sale for the selected fund. Realized gain/loss will use the earliest open lots first.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            <p className="font-medium text-gray-900">{(initialSale ?? initialContext)?.fundName ?? "No fund selected"}</p>
            {initialSale ?? initialContext ? (
              <p className="mt-1">
                {(initialSale ?? initialContext)?.bankName} · {(initialSale ?? initialContext)?.accountNumber} · {(initialSale ?? initialContext)?.currency}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mf-sell-units">Units Sold</Label>
              <Input
                id="mf-sell-units"
                type="number"
                step="0.0001"
                placeholder="0.0000"
                value={unitsSold}
                onChange={(event) => setUnitsSold(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mf-sell-price">
                Sale Price per Unit{(initialSale ?? initialContext) ? ` (${(initialSale ?? initialContext)?.currency})` : ""}
              </Label>
              <Input
                id="mf-sell-price"
                type="number"
                step="0.0001"
                placeholder="0.0000"
                value={salePricePerUnit}
                onChange={(event) => setSalePricePerUnit(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mf-sell-date">Date Sold</Label>
            <Input
              id="mf-sell-date"
              type="date"
              value={saleDate}
              onChange={(event) => setSaleDate(event.target.value)}
              required
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          {initialSale ? (
            <DeleteDoubleConfirmPanel
              stage={confirmDeleteStage}
              submitting={submitting}
              firstTitle="Delete this sale permanently?"
              firstMessage="This removes the sell ledger row and its realized gain/loss record."
              keepLabel="Keep Sale"
              onKeep={() => setConfirmDeleteStage(0)}
              onContinue={() => setConfirmDeleteStage(2)}
              onBack={() => setConfirmDeleteStage(1)}
              onDelete={handleDelete}
            />
          ) : null}

          <div className="flex justify-end gap-3 pt-4">
            {initialSale ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setConfirmDeleteStage(1)}
                disabled={submitting}
              >
                Delete Sale
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !(initialSale ?? initialContext)}>
              {submitting ? "Saving..." : initialSale ? "Save Changes" : "Record Sale"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
