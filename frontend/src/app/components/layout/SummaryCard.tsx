import { Card } from "../ui/card";
import { cn } from "../ui/utils";

interface SummaryCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function SummaryCard({ label, value, icon, trend, className }: SummaryCardProps) {
  return (
    <Card className={cn("p-4 sm:p-6 bg-white border-gray-200 shadow-sm", className)}>
      <p className="text-xs sm:text-sm text-gray-500 mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <p className="text-lg sm:text-2xl font-normal text-gray-900 break-all">{value}</p>
        {icon && <div className="flex-shrink-0">{icon}</div>}
      </div>
    </Card>
  );
}

interface SummaryGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

export function SummaryGrid({ children, columns = 3, className }: SummaryGridProps) {
  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={cn("grid gap-3 sm:gap-4 lg:gap-6", gridCols[columns], className)}>
      {children}
    </div>
  );
}
