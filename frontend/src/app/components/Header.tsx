import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { useAuth } from "../auth";
import { getShareStatus, ShareStatus, startShare, stopShare } from "../api";

interface HeaderProps {
  language?: string;
  onLanguageChange?: (language: string) => void;
}

export function Header({ language = "en", onLanguageChange }: HeaderProps) {
  const { authState, loading, logoutCurrentUser } = useAuth();
  const [shareStatus, setShareStatus] = useState<ShareStatus | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const activeIdentity =
    authState?.displayName || authState?.email || authState?.externalUserId || "Local account";

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

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <h1 className="text-2xl font-normal text-gray-900">Multi-market cockpit</h1>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-gray-500">App Hosting</p>
                <p className="mt-1 text-sm text-gray-900">
                  {shareStatus?.shareEnabled
                    ? `LAN sharing is active at ${shareStatus.shareUrl ?? "unknown URL"}`
                    : shareStatus?.privateUrl
                      ? `Private host ready at ${shareStatus.privateUrl}`
                      : "Private host not available in this runtime"}
                </p>
                {!shareStatus?.frontendAvailable ? (
                  <p className="mt-1 text-xs text-amber-700">
                    Build the frontend to serve the packaged app host.
                  </p>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void toggleShare("start")}
                  disabled={shareBusy || shareStatus?.shareEnabled}
                >
                  {shareBusy && !shareStatus?.shareEnabled ? "Starting..." : "Start Sharing"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void toggleShare("stop")}
                  disabled={shareBusy || !shareStatus?.shareEnabled}
                >
                  {shareBusy && shareStatus?.shareEnabled ? "Stopping..." : "Stop Sharing"}
                </Button>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-xs uppercase tracking-[0.16em] text-gray-500">Signed in as</p>
            <p className="mt-1 text-sm text-gray-900">{activeIdentity}</p>
          </div>
          <Select value={language} onValueChange={onLanguageChange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="th">ไทย</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => void logoutCurrentUser()} disabled={loading}>
            {loading ? "Signing out..." : "Logout"}
          </Button>
        </div>
      </div>
    </div>
  );
}
