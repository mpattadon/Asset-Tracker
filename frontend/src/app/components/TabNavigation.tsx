import { Link, useLocation } from "react-router";
import { cn } from "./ui/utils";

const tabs = [
  { label: "Total Assets", path: "/" },
  { label: "Stocks", path: "/stocks" },
  { label: "Bonds & Debentures", path: "/bonds" },
  { label: "Gold", path: "/gold" },
  { label: "Mutual Funds", path: "/mutual-funds" },
  { label: "Banks", path: "/banks" },
  { label: "Government Lottery", path: "/lottery" },
  { label: "Options", path: "/options" },
  { label: "YFinance Lab", path: "/market-data-lab" },
];

export function TabNavigation() {
  const location = useLocation();

  return (
    <div className="mt-6 bg-white rounded-xl border border-gray-200 p-2 shadow-sm overflow-x-auto">
      <div className="flex gap-2 min-w-max">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
