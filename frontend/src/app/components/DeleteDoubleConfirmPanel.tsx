import { Button } from "./ui/button";

interface DeleteDoubleConfirmPanelProps {
  stage: 0 | 1 | 2;
  submitting?: boolean;
  firstTitle: string;
  firstMessage: string;
  secondTitle?: string;
  secondMessage?: string;
  keepLabel: string;
  continueLabel?: string;
  backLabel?: string;
  finalDeleteLabel?: string;
  onKeep: () => void;
  onContinue: () => void;
  onBack: () => void;
  onDelete: () => void;
}

export function DeleteDoubleConfirmPanel({
  stage,
  submitting = false,
  firstTitle,
  firstMessage,
  secondTitle = "Are you really sure?",
  secondMessage = "The deleted row is non-recoverable and you probably should keep a record of what you deleted.",
  keepLabel,
  continueLabel = "Confirm Delete",
  backLabel = "Go Back",
  finalDeleteLabel = "Delete Permanently",
  onKeep,
  onContinue,
  onBack,
  onDelete,
}: DeleteDoubleConfirmPanelProps) {
  if (stage === 0) {
    return null;
  }

  if (stage === 1) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <p className="font-medium">{firstTitle}</p>
        <p className="mt-1">{firstMessage}</p>
        <div className="mt-3 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onKeep} disabled={submitting}>
            {keepLabel}
          </Button>
          <Button type="button" variant="destructive" onClick={onContinue} disabled={submitting}>
            {continueLabel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-red-300 bg-red-100 p-4 text-sm text-red-800">
      <p className="font-medium">{secondTitle}</p>
      <p className="mt-1">{secondMessage}</p>
      <div className="mt-3 flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onBack} disabled={submitting}>
          {backLabel}
        </Button>
        <Button type="button" variant="destructive" onClick={onDelete} disabled={submitting}>
          {finalDeleteLabel}
        </Button>
      </div>
    </div>
  );
}
