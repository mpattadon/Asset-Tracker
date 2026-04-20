import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../auth";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface ForgotPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ForgotPasswordDialog({ open, onOpenChange }: ForgotPasswordDialogProps) {
  const { loading, error, checkUsername, resetPassword } = useAuth();
  const [step, setStep] = useState<"username" | "password" | "done">("username");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!open) {
      setStep("username");
      setUsername("");
      setPassword("");
      setLocalError("");
    }
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError("");
    if (step === "username") {
      try {
        const result = await checkUsername({ username });
        if (!result.found) {
          setLocalError("Username not found.");
          return;
        }
        setStep("password");
      } catch (requestError) {
        setLocalError(
          requestError instanceof Error ? requestError.message : "Unable to verify username.",
        );
      }
      return;
    }

    if (step === "password") {
      try {
        await resetPassword({ username, password });
        setStep("done");
      } catch (requestError) {
        setLocalError(
          requestError instanceof Error ? requestError.message : "Unable to reset password.",
        );
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Forgot Password</DialogTitle>
          <DialogDescription>
            {step === "username"
              ? "Enter your username first. If it exists, you can set a new password."
              : step === "password"
              ? "Set a new password for this username."
              : "Password updated. You can log in with the new password now."}
          </DialogDescription>
        </DialogHeader>

        {step === "done" ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              Password reset completed for <span className="font-medium">{username}</span>.
            </div>
            <p className="text-xs text-gray-500">
              Email verification can be added later. For now this reset flow is username-based only.
            </p>
            <DialogFooter>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
            <div className="space-y-1.5">
              <Label htmlFor="forgot-username">Username</Label>
              <Input
                id="forgot-username"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                disabled={step !== "username"}
                required
              />
            </div>

            {step === "password" ? (
              <div className="space-y-1.5">
                <Label htmlFor="forgot-password">New Password</Label>
                <Input
                  id="forgot-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  required
                />
              </div>
            ) : null}

            {localError || error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {localError || error}
              </div>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading
                  ? "Please wait..."
                  : step === "username"
                  ? "Continue"
                  : "Reset Password"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
