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
  createMutualFundMonthlyLog,
  deleteMutualFundMonthlyLog,
  MutualFundAccount,
  MutualFundAccountDetailView,
  MutualFundMonthlyLogView,
  updateMutualFundMonthlyLog,
} from "../api";

interface LogMonthlyDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: MutualFundAccount[];
  accountDetails: MutualFundAccountDetailView[];
  onCreated?: () => void | Promise<void>;
  initialLog?: (MutualFundMonthlyLogView & {
    fundName: string;
    accountId: string;
    bankName: string;
  }) | null;
}

export function LogMonthlyDataDialog({
  open,
  onOpenChange,
  accounts,
  accountDetails,
  onCreated,
  initialLog,
}: LogMonthlyDataDialogProps) {
  const [selectedBank, setSelectedBank] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedFundName, setSelectedFundName] = useState("");
  const [logDate, setLogDate] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [dividendReceived, setDividendReceived] = useState("");
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

  const selectedAccountDetail = useMemo(
    () => accountDetails.find((account) => account.id === selectedAccountId) ?? null,
    [accountDetails, selectedAccountId],
  );

  const fundOptions = useMemo(
    () =>
      (selectedAccountDetail?.funds ?? [])
        .map((fund) => fund.fundName)
        .sort((left, right) => left.localeCompare(right)),
    [selectedAccountDetail],
  );

  useEffect(() => {
    if (selectedAccountId && !accountOptions.some((account) => account.id === selectedAccountId)) {
      setSelectedAccountId("");
      setSelectedFundName("");
    }
  }, [accountOptions, selectedAccountId]);

  useEffect(() => {
    if (selectedFundName && !fundOptions.includes(selectedFundName)) {
      setSelectedFundName("");
    }
  }, [fundOptions, selectedFundName]);

  const reset = () => {
    setSelectedBank("");
    setSelectedAccountId("");
    setSelectedFundName("");
    setLogDate("");
    setPricePerUnit("");
    setDividendReceived("");
    setConfirmDeleteStage(0);
    setError("");
  };

  useEffect(() => {
    if (open && initialLog) {
      setSelectedBank(initialLog.bankName);
      setSelectedAccountId(initialLog.accountId);
      setSelectedFundName(initialLog.fundName);
      setLogDate(initialLog.logDate);
      setPricePerUnit(String(initialLog.pricePerUnit));
      setDividendReceived(
        initialLog.dividendReceived ? String(initialLog.dividendReceived) : "",
      );
      setConfirmDeleteStage(0);
      setError("");
    } else if (open && !initialLog) {
      reset();
    }
  }, [initialLog, open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedAccountId || !selectedFundName) {
      setError("Select a bank, account, and fund first.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const payload = {
        accountId: selectedAccountId,
        fundName: selectedFundName,
        logDate,
        pricePerUnit: Number.parseFloat(pricePerUnit),
        dividendReceived: dividendReceived
          ? Number.parseFloat(dividendReceived)
          : null,
      };
      if (initialLog) {
        await updateMutualFundMonthlyLog(initialLog.id, payload);
      } else {
        await createMutualFundMonthlyLog(payload);
      }
      onOpenChange(false);
      reset();
      await onCreated?.();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Unable to log monthly data.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!initialLog) {
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await deleteMutualFundMonthlyLog(initialLog.id);
      onOpenChange(false);
      reset();
      await onCreated?.();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Unable to delete monthly log.",
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
          <DialogTitle>{initialLog ? "Edit Monthly Log" : "Log Monthly Data"}</DialogTitle>
          <DialogDescription>
            {initialLog
              ? "Update a dated monthly valuation entry for this mutual fund."
              : "Record a dated valuation update for a mutual fund. If the same fund is already logged for that month, the monthly price entry will be updated."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mf-log-bank">Bank</Label>
              <Select
                value={selectedBank}
                onValueChange={(value) => {
                  setSelectedBank(value);
                  setSelectedAccountId("");
                  setSelectedFundName("");
                }}
              >
                <SelectTrigger id="mf-log-bank">
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
              <Label htmlFor="mf-log-account">Account Number</Label>
              <Select
                value={selectedAccountId}
                onValueChange={(value) => {
                  setSelectedAccountId(value);
                  setSelectedFundName("");
                }}
              >
                <SelectTrigger id="mf-log-account">
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

          <div className="space-y-2">
            <Label htmlFor="mf-log-fund">Fund</Label>
            <Select value={selectedFundName} onValueChange={setSelectedFundName}>
              <SelectTrigger id="mf-log-fund">
                <SelectValue placeholder="Select fund" />
              </SelectTrigger>
              <SelectContent>
                {fundOptions.map((fundName) => (
                  <SelectItem key={fundName} value={fundName}>
                    {fundName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mf-log-date">Log Date</Label>
              <Input
                id="mf-log-date"
                type="date"
                value={logDate}
                onChange={(event) => setLogDate(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mf-log-price">
                Price per Unit{selectedAccount ? ` (${selectedAccount.currency})` : ""}
              </Label>
              <Input
                id="mf-log-price"
                type="number"
                step="0.0001"
                placeholder="0.0000"
                value={pricePerUnit}
                onChange={(event) => setPricePerUnit(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mf-log-dividend">
              Dividend Received{selectedAccount ? ` (${selectedAccount.currency})` : ""} (Optional)
            </Label>
            <Input
              id="mf-log-dividend"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={dividendReceived}
              onChange={(event) => setDividendReceived(event.target.value)}
            />
          </div>

          {selectedAccountDetail && !fundOptions.length ? (
            <p className="text-sm text-gray-500">
              This account does not have any purchased funds to log yet.
            </p>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          {initialLog ? (
            <DeleteDoubleConfirmPanel
              stage={confirmDeleteStage}
              submitting={submitting}
              firstTitle="Delete this monthly log permanently?"
              firstMessage="This removes the logged valuation and dividend entry for that month."
              keepLabel="Keep Log"
              onKeep={() => setConfirmDeleteStage(0)}
              onContinue={() => setConfirmDeleteStage(2)}
              onBack={() => setConfirmDeleteStage(1)}
              onDelete={handleDelete}
            />
          ) : null}

          <div className="flex justify-end gap-3 pt-4">
            {initialLog ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setConfirmDeleteStage(1)}
                disabled={submitting}
              >
                Delete Log
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : initialLog ? "Save Changes" : "Log Monthly Data"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
