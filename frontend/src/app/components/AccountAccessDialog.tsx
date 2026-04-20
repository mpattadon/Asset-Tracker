import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
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

interface AccountAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode: "login" | "register";
  onForgotPassword: () => void;
}

export function AccountAccessDialog({
  open,
  onOpenChange,
  initialMode,
  onForgotPassword,
}: AccountAccessDialogProps) {
  const { authState, loading, error, register, login } = useAuth();
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  const setupRequired = authState?.setupRequired ?? true;
  const effectiveMode = setupRequired ? "register" : mode;
  const title = useMemo(
    () => (effectiveMode === "register" ? "Create Account" : "Login"),
    [effectiveMode],
  );

  useEffect(() => {
    if (open) {
      setMode(initialMode);
    }
  }, [initialMode, open]);

  useEffect(() => {
    if (!open) {
      setUsername("");
      setPassword("");
      setEmail("");
      setRememberMe(true);
    }
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (effectiveMode === "register") {
      await register({
        username,
        password,
        email: email || undefined,
        rememberMe,
      });
      onOpenChange(false);
      return;
    }
    await login({
      username,
      password,
      rememberMe,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            You can browse while signed out. Login is only required before adding or changing data.
          </DialogDescription>
        </DialogHeader>

        {!setupRequired ? (
          <div className="flex gap-2">
            <Button
              type="button"
              variant={effectiveMode === "login" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("login")}
            >
              Login
            </Button>
            <Button
              type="button"
              variant={effectiveMode === "register" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("register")}
            >
              Create Account
            </Button>
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <div className="space-y-1.5">
            <Label htmlFor="auth-username">Username</Label>
            <Input
              id="auth-username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="yourname"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="auth-password">Password</Label>
            <Input
              id="auth-password"
              type="password"
              autoComplete={effectiveMode === "register" ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              required
            />
          </div>

          {effectiveMode === "register" ? (
            <div className="space-y-1.5">
              <Label htmlFor="auth-email">Email</Label>
              <Input
                id="auth-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Optional"
              />
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="auth-remember" className="cursor-pointer">
              <Checkbox
                id="auth-remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
              />
              Remember me
            </Label>

            {effectiveMode === "login" ? (
              <button
                type="button"
                className="text-sm font-medium text-blue-700 underline-offset-4 hover:underline"
                onClick={onForgotPassword}
              >
                Forgot password?
              </button>
            ) : null}
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Please wait..." : effectiveMode === "register" ? "Create Account" : "Login"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
