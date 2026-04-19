import { FormEvent, useMemo, useState } from "react";
import { useAuth } from "../auth";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function AuthScreen() {
  const { authState, loading, error, register, login } = useAuth();
  const [mode, setMode] = useState<"login" | "register">(authState?.setupRequired ? "register" : "login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");

  const setupRequired = authState?.setupRequired ?? true;
  const effectiveMode = setupRequired ? "register" : mode;
  const title = useMemo(
    () => (effectiveMode === "register" ? "Create local account" : "Login"),
    [effectiveMode],
  );

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
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 lg:flex-row">
        <Card className="flex-1 border-gray-200 bg-white p-8 shadow-sm">
          <p className="text-sm uppercase tracking-[0.2em] text-gray-500">Asset Tracker</p>
          <h1 className="mt-3 text-3xl font-normal text-gray-900">Local-first portfolio workspace</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-gray-600">
            Accounts and portfolio data stay in the local SQLite workspace. Each local user gets
            isolated data, and the app can optionally expose the same frontend over the LAN after login.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Storage</p>
              <p className="mt-2 text-sm text-gray-900">SQLite database as the single source of truth</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Accounts</p>
              <p className="mt-2 text-sm text-gray-900">Username/password login with separate local profiles</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Hosting</p>
              <p className="mt-2 text-sm text-gray-900">Private local app first, optional LAN sharing later</p>
            </div>
          </div>
        </Card>

        <Card className="w-full border-gray-200 bg-white p-8 shadow-sm lg:max-w-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                {setupRequired ? "First-time setup required" : "Local account access"}
              </p>
              <h2 className="mt-1 text-2xl font-normal text-gray-900">{title}</h2>
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

          <form className="mt-8 space-y-4" onSubmit={(event) => void handleSubmit(event)}>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="yourname"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={effectiveMode === "register" ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                required
              />
            </div>

            {effectiveMode === "register" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </>
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
        </Card>
      </div>
    </div>
  );
}
