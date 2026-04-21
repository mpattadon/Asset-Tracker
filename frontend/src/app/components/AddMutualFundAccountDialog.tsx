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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  createMutualFundAccount,
  deleteMutualFundAccount,
  MutualFundAccount,
  updateMutualFundAccount,
} from "../api";

interface AddMutualFundAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void | Promise<void>;
  initialAccount?: MutualFundAccount | null;
}

export function AddMutualFundAccountDialog({
  open,
  onOpenChange,
  onCreated,
  initialAccount,
}: AddMutualFundAccountDialogProps) {
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [currency, setCurrency] = useState("THB");
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteStage, setConfirmDeleteStage] = useState<0 | 1 | 2>(0);
  const [error, setError] = useState("");

  const reset = () => {
    setBankName("");
    setAccountNumber("");
    setNotes("");
    setCurrency("THB");
    setConfirmDeleteStage(0);
    setError("");
  };

  useEffect(() => {
    if (open && initialAccount) {
      setBankName(initialAccount.bankName);
      setAccountNumber(initialAccount.accountNumber);
      setNotes(initialAccount.notes ?? "");
      setCurrency(initialAccount.currency);
      setConfirmDeleteStage(0);
      setError("");
    } else if (open && !initialAccount) {
      reset();
    }
  }, [initialAccount, open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        bankName,
        accountNumber,
        notes,
        currency,
      };
      if (initialAccount) {
        await updateMutualFundAccount(initialAccount.id, payload);
      } else {
        await createMutualFundAccount(payload);
      }
      onOpenChange(false);
      reset();
      await onCreated?.();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Unable to create account.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!initialAccount) {
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await deleteMutualFundAccount(initialAccount.id);
      onOpenChange(false);
      reset();
      await onCreated?.();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Unable to delete account.",
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
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{initialAccount ? "Edit Mutual Fund Account" : "Add Mutual Fund Account"}</DialogTitle>
          <DialogDescription>
            {initialAccount
              ? "Update the bank account information used by this mutual fund ledger."
              : "Create an account workspace for mutual fund purchases and monthly price logs."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mf-bank-name">Bank Name</Label>
            <Input
              id="mf-bank-name"
              placeholder="e.g. SCB, BBL"
              value={bankName}
              onChange={(event) => setBankName(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mf-account-number">Account Number</Label>
            <Input
              id="mf-account-number"
              placeholder="e.g. 123-4-56789-0"
              value={accountNumber}
              onChange={(event) => setAccountNumber(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mf-notes">Notes</Label>
            <Input
              id="mf-notes"
              placeholder="Optional label or note"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mf-currency">Account Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger id="mf-currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["THB", "USD", "EUR", "GBP", "SGD", "JPY", "TWD"].map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          {initialAccount ? (
            <DeleteDoubleConfirmPanel
              stage={confirmDeleteStage}
              submitting={submitting}
              firstTitle="Delete this account permanently?"
              firstMessage="This will also delete all purchases, monthly logs, and sales stored under the account."
              keepLabel="Keep Account"
              onKeep={() => setConfirmDeleteStage(0)}
              onContinue={() => setConfirmDeleteStage(2)}
              onBack={() => setConfirmDeleteStage(1)}
              onDelete={handleDelete}
            />
          ) : null}

          <div className="flex justify-end gap-3 pt-4">
            {initialAccount ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setConfirmDeleteStage(1)}
                disabled={submitting}
              >
                Delete Account
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : initialAccount ? "Save Changes" : "Add Account"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
