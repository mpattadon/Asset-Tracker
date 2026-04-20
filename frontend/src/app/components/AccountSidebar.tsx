import { useEffect, useMemo, useState } from "react";
import { CircleUserRound, Globe2, Settings2, Wallet } from "lucide-react";
import { useAuth } from "../auth";
import { usePreferences } from "../preferences";
import { getShareStatus, ShareStatus, startShare, stopShare } from "../api";
import { AccountAccessDialog } from "./AccountAccessDialog";
import { ForgotPasswordDialog } from "./ForgotPasswordDialog";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

function previewLabel(preferredCurrency: string) {
  return `THB / ${preferredCurrency}`;
}

export function AccountSidebar() {
  const { authState, loading, logoutCurrentUser } = useAuth();
  const { language, setLanguage, preferredCurrency, setPreferredCurrency, thbRate, loadingRate } = usePreferences();
  const [shareStatus, setShareStatus] = useState<ShareStatus | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [accessMode, setAccessMode] = useState<"login" | "register">("login");
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);

  const activeIdentity = useMemo(
    () =>
      authState?.displayName ||
      authState?.email ||
      authState?.externalUserId ||
      "Guest browsing",
    [authState],
  );

  useEffect(() => {
    let cancelled = false;
    async function loadStatus() {
      try {
        const status = await getShareStatus();
        if (!cancelled) {
          setShareStatus(status);
        }
      } catch {
        if (!cancelled) {
          setShareStatus(null);
        }
      }
    }
    void loadStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleShare(nextState: "start" | "stop") {
    setShareBusy(true);
    try {
      const status = nextState === "start" ? await startShare() : await stopShare();
      setShareStatus(status);
    } finally {
      setShareBusy(false);
    }
  }

  const previewValue = loadingRate
    ? "Loading..."
    : thbRate?.inverseRate != null
    ? thbRate.inverseRate.toFixed(2)
    : "Unavailable";

  return (
    <aside className="space-y-4 xl:sticky xl:top-6">
      <Card className="border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-700">
            <CircleUserRound className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.16em] text-gray-500">Account</p>
            <p className="truncate text-base font-medium text-gray-900">{activeIdentity}</p>
            <p className="text-sm text-gray-500">
              {authState?.authenticated ? "Local profile active" : "Browse mode"}
            </p>
          </div>
        </div>

        {authState?.authenticated ? (
          <Button
            variant="outline"
            size="sm"
            className="mt-4 w-full"
            onClick={() => void logoutCurrentUser()}
            disabled={loading}
          >
            {loading ? "Signing out..." : "Logout"}
          </Button>
        ) : (
          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                setAccessMode("login");
                setAccessDialogOpen(true);
              }}
            >
              Login
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={() => {
                setAccessMode("register");
                setAccessDialogOpen(true);
              }}
            >
              Create Account
            </Button>
          </div>
        )}
      </Card>

      <Card className="border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-gray-500" />
          <h3 className="text-base font-medium text-gray-900">Settings</h3>
        </div>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
              <Globe2 className="h-4 w-4 text-gray-500" />
              Site language
            </label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="th">ไทย</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
              <Wallet className="h-4 w-4 text-gray-500" />
              Preferred currency
            </label>
            <Select value={preferredCurrency} onValueChange={(value) => setPreferredCurrency(value as "THB" | "USD" | "EUR" | "GBP" | "JPY")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="THB">THB</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
                <SelectItem value="JPY">JPY</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              {previewLabel(preferredCurrency)}: <span className="font-medium text-gray-700">{previewValue}</span>
            </p>
          </div>
        </div>
      </Card>

      <Card className="border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-xs uppercase tracking-[0.16em] text-gray-500">App Hosting</p>
        <p className="mt-2 text-sm text-gray-900">
          {shareStatus?.shareEnabled
            ? `LAN sharing is active at ${shareStatus.shareUrl ?? "unknown URL"}`
            : shareStatus?.privateUrl
            ? `Private host ready at ${shareStatus.privateUrl}`
            : "Private host not available in this runtime"}
        </p>
        {!shareStatus?.frontendAvailable ? (
          <p className="mt-2 text-xs text-amber-700">
            Build the frontend to serve the packaged app host.
          </p>
        ) : null}
        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void toggleShare("start")}
            disabled={shareBusy || shareStatus?.shareEnabled || !authState?.authenticated}
          >
            {shareBusy && !shareStatus?.shareEnabled ? "Starting..." : "Start Sharing"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void toggleShare("stop")}
            disabled={shareBusy || !shareStatus?.shareEnabled || !authState?.authenticated}
          >
            {shareBusy && shareStatus?.shareEnabled ? "Stopping..." : "Stop Sharing"}
          </Button>
        </div>
      </Card>
      <AccountAccessDialog
        open={accessDialogOpen}
        onOpenChange={setAccessDialogOpen}
        initialMode={accessMode}
        onForgotPassword={() => {
          setAccessDialogOpen(false);
          setForgotPasswordOpen(true);
        }}
      />
      <ForgotPasswordDialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen} />
    </aside>
  );
}
