import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Portfolio?</DialogTitle>
          <DialogDescription>
            {`Are you sure you want to remove ${portfolioName}? Once deleted, it is non recoverable and all transactions stored inside that portfolio will be removed.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={() => void onConfirm()} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete Portfolio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
