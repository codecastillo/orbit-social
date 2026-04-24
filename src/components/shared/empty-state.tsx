import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-4 text-center",
        className
      )}
    >
      {Icon && (
        <div className="h-16 w-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-5">
          <Icon className="h-7 w-7 text-muted-foreground/40" />
        </div>
      )}
      <h3 className="text-base font-semibold text-muted-foreground">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground/60 mt-1.5 max-w-xs">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
