import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { DeleteDoubleConfirmPanel } from "./DeleteDoubleConfirmPanel";

interface DeletePortfolioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portfolioName: string;
  onConfirm: () => Promise<void> | void;
  deleting?: boolean;
}

export function DeletePortfolioDialog({
  open,
  onOpenChange,
  portfolioName,
  onConfirm,
  deleting = false,
}: DeletePortfolioDialogProps) {
  const [confirmDeleteStage, setConfirmDeleteStage] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    if (!open) {
      setConfirmDeleteStage(0);
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          setConfirmDeleteStage(0);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Portfolio?</DialogTitle>
          <DialogDescription>
            {`Are you sure you want to remove ${portfolioName}? Once deleted, it is non recoverable and all transactions stored inside that portfolio will be removed.`}
          </DialogDescription>
        </DialogHeader>
        <DeleteDoubleConfirmPanel
          stage={confirmDeleteStage}
          submitting={deleting}
          firstTitle="Delete this portfolio permanently?"
          firstMessage={`This will remove ${portfolioName} and all transactions stored inside it.`}
          keepLabel="Keep Portfolio"
          onKeep={() => setConfirmDeleteStage(0)}
          onContinue={() => setConfirmDeleteStage(2)}
          onBack={() => setConfirmDeleteStage(1)}
          onDelete={() => void onConfirm()}
        />
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => setConfirmDeleteStage(1)}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete Portfolio"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
