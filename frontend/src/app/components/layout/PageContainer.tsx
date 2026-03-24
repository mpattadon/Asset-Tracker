import { cn } from "../ui/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn("space-y-4 sm:space-y-6 p-4 sm:p-6", className)}>
      {children}
    </div>
  );
}
