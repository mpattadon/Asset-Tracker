import { useEffect, useMemo, useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  createMutualFundPurchase,
  deleteMutualFundPurchase,
  MutualFundAccount,
  MutualFundPurchaseView,
  updateMutualFundPurchase,
} from "../api";

interface AddPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: MutualFundAccount[];
  onCreated?: () => void | Promise<void>;
  initialPurchase?: (MutualFundPurchaseView & {
    fundName: string;
    accountId: string;
    bankName: string;
  }) | null;
}

export function AddPurchaseDialog({
  open,
  onOpenChange,
  accounts,
  onCreated,
  initialPurchase,
}: AddPurchaseDialogProps) {
  const [fundName, setFundName] = useState("");
  const [selectedBank, setSelectedBank] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [riskLevel, setRiskLevel] = useState("1");
  const [averageCostPerUnit, setAverageCostPerUnit] = useState("");
  const [unitsPurchased, setUnitsPurchased] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteStage, setConfirmDeleteStage] = useState<0 | 1 | 2>(0);
  const [error, setError] = useState("");

  const banks = useMemo(
    () => Array.from(new Set(accounts.map((account) => account.bankName))).sort(),
    [accounts],
  );

  const accountOptions = useMemo(
    () =>
      accounts.filter((account) => !selectedBank || account.bankName === selectedBank),
    [accounts, selectedBank],
  );

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId],
  );

  const totalCost =
    averageCostPerUnit && unitsPurchased
      ? Number.parseFloat(averageCostPerUnit) * Number.parseFloat(unitsPurchased)
      : 0;

  const reset = () => {
    setFundName("");
    setSelectedBank("");
    setSelectedAccountId("");
    setRiskLevel("1");
    setAverageCostPerUnit("");
    setUnitsPurchased("");
    setPurchaseDate("");
    setConfirmDeleteStage(0);
    setError("");
  };

  useEffect(() => {
    if (open && initialPurchase) {
      setFundName(initialPurchase.fundName);
      setSelectedBank(initialPurchase.bankName);
      setSelectedAccountId(initialPurchase.accountId);
      setRiskLevel(String(initialPurchase.riskLevel));
      setAverageCostPerUnit(String(initialPurchase.averageCostPerUnit));
      setUnitsPurchased(String(initialPurchase.unitsPurchased));
      setPurchaseDate(initialPurchase.purchaseDate);
      setConfirmDeleteStage(0);
      setError("");
    } else if (open && !initialPurchase) {
      reset();
    }
  }, [initialPurchase, open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedAccountId) {
      setError("Select an account first.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        accountId: selectedAccountId,
        fundName,
        riskLevel: Number.parseInt(riskLevel, 10),
        averageCostPerUnit: Number.parseFloat(averageCostPerUnit),
        unitsPurchased: Number.parseFloat(unitsPurchased),
        purchaseDate,
      };
      if (initialPurchase) {
        await updateMutualFundPurchase(initialPurchase.id, payload);
      } else {
        await createMutualFundPurchase(payload);
      }
      onOpenChange(false);
      reset();
      await onCreated?.();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Unable to save purchase.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!initialPurchase) {
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await deleteMutualFundPurchase(initialPurchase.id);
      onOpenChange(false);
      reset();
      await onCreated?.();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Unable to delete purchase.",
      );
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
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{initialPurchase ? "Edit Purchase" : "Add Purchase"}</DialogTitle>
          <DialogDescription>
            {initialPurchase
              ? "Update an existing mutual fund purchase ledger entry."
              : "Record a mutual fund purchase in the selected bank account ledger."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mf-purchase-fund-name">Fund Name</Label>
            <Input
              id="mf-purchase-fund-name"
              placeholder="e.g. SCB-GMCORE(A)"
              value={fundName}
              onChange={(event) => setFundName(event.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mf-purchase-bank">Bank</Label>
              <Select
                value={selectedBank}
                onValueChange={(value) => {
                  setSelectedBank(value);
                  setSelectedAccountId("");
                }}
              >
                <SelectTrigger id="mf-purchase-bank">
                  <SelectValue placeholder="Select bank" />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((bank) => (
                    <SelectItem key={bank} value={bank}>
                      {bank}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mf-purchase-account">Account Number</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger id="mf-purchase-account">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accountOptions.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.accountNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mf-purchase-risk">Risk Level</Label>
              <Input
                id="mf-purchase-risk"
                type="number"
                min="1"
                step="1"
                value={riskLevel}
                onChange={(event) => setRiskLevel(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mf-purchase-date">Purchase Date</Label>
              <Input
                id="mf-purchase-date"
                type="date"
                value={purchaseDate}
                onChange={(event) => setPurchaseDate(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mf-average-cost">Average Cost per Unit</Label>
              <Input
                id="mf-average-cost"
                type="number"
                step="0.0001"
                placeholder="0.0000"
                value={averageCostPerUnit}
                onChange={(event) => setAverageCostPerUnit(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mf-units-purchased">Units Purchased</Label>
              <Input
                id="mf-units-purchased"
                type="number"
                step="0.0001"
                placeholder="0.0000"
                value={unitsPurchased}
                onChange={(event) => setUnitsPurchased(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Cost</p>
                {selectedAccount ? (
                  <p className="text-xs text-gray-500">{selectedAccount.currency}</p>
                ) : null}
              </div>
              <span className="text-lg font-medium text-gray-900">
                {totalCost.toLocaleString("en-US", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          {initialPurchase ? (
            <DeleteDoubleConfirmPanel
              stage={confirmDeleteStage}
              submitting={submitting}
              firstTitle="Delete this purchase permanently?"
              firstMessage="This removes the ledger entry and may be blocked if later sales depend on it."
              keepLabel="Keep Purchase"
              onKeep={() => setConfirmDeleteStage(0)}
              onContinue={() => setConfirmDeleteStage(2)}
              onBack={() => setConfirmDeleteStage(1)}
              onDelete={handleDelete}
            />
          ) : null}

          <div className="flex justify-end gap-3 pt-4">
            {initialPurchase ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setConfirmDeleteStage(1)}
                disabled={submitting}
              >
                Delete Purchase
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : initialPurchase ? "Save Changes" : "Add Purchase"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
