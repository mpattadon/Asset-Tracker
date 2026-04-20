import { Outlet } from "react-router";
import { AccountSidebar } from "./AccountSidebar";
import { TabNavigation } from "./TabNavigation";

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-[1700px] px-4 py-4 sm:px-6 sm:py-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            <div className="rounded-2xl border border-gray-200 bg-white px-6 py-5 shadow-sm">
              <p className="text-sm uppercase tracking-[0.18em] text-gray-500">Asset Tracker</p>
              <h1 className="mt-2 text-2xl font-normal text-gray-900">Multi-market cockpit</h1>
              <p className="mt-2 text-sm text-gray-500">
                Browse first, then login only when you want to record or change portfolio data.
              </p>
            </div>
            <TabNavigation />
            <main className="mt-4 sm:mt-6">
              <Outlet />
            </main>
          </div>
          <AccountSidebar />
        </div>
      </div>
    </div>
  );
}
