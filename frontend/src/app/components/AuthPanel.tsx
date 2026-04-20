import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function AuthPanel() {
  const { authState, loading, error, register, login } = useAuth();
  const [mode, setMode] = useState<"login" | "register">(authState?.setupRequired ? "register" : "login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");

  const setupRequired = authState?.setupRequired ?? true;
  const effectiveMode = setupRequired ? "register" : mode;
  const title = useMemo(
    () => (effectiveMode === "register" ? "Create local account" : "Login to interact"),
    [effectiveMode],
  );

  useEffect(() => {
    setMode(authState?.setupRequired ? "register" : "login");
  }, [authState?.setupRequired]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (effectiveMode === "register") {
      await register({
        username,
        password,
        email: email || undefined,
      });
      return;
    }
    await login({ username, password });
  }

  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-gray-500">Account Access</p>
          <h3 className="mt-1 text-lg font-medium text-gray-900">{title}</h3>
          <p className="mt-1 text-sm text-gray-500">
            You can browse while signed out. Login is only required to add or change data.
          </p>
        </div>
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
              Create
            </Button>
          </div>
        ) : null}
      </div>

      <form className="space-y-3" onSubmit={(event) => void handleSubmit(event)}>
        <div className="space-y-1.5">
          <Label htmlFor="sidebar-username">Username</Label>
          <Input
            id="sidebar-username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="yourname"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sidebar-password">Password</Label>
          <Input
            id="sidebar-password"
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
            <Label htmlFor="sidebar-email">Email</Label>
            <Input
              id="sidebar-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Optional"
            />
          </div>
        ) : null}
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        <Button className="w-full" type="submit" disabled={loading}>
          {loading ? "Please wait..." : effectiveMode === "register" ? "Create account" : "Login"}
        </Button>
      </form>
    </div>
  );
}
