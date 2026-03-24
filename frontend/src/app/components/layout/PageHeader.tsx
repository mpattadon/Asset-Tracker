import { cn } from "../ui/utils";

interface PageHeaderProps {
  title: string;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, children, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4", className)}>
      <h2 className="text-xl sm:text-2xl font-normal text-gray-900">{title}</h2>
      {children && (
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {children}
        </div>
      )}
    </div>
  );
}
