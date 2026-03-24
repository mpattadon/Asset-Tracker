import { Card } from "../ui/card";
import { cn } from "../ui/utils";

interface DataCardProps {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function DataCard({ title, action, children, className, contentClassName }: DataCardProps) {
  return (
    <Card className={cn("bg-white border-gray-200 shadow-sm overflow-hidden", className)}>
      {title && (
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 flex items-center justify-between gap-4">
          <h3 className="text-base sm:text-lg font-normal text-gray-900">{title}</h3>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn(contentClassName)}>
        {children}
      </div>
    </Card>
  );
}
