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
        // min-h centers the block in the viewport instead of hugging the top
        // of its card; callers with tighter containers override via className.
        "flex min-h-[45vh] flex-col items-center justify-center px-6 py-10 text-center",
        className
      )}
    >
      {Icon && (
        <div className="mb-6 flex h-18 w-18 items-center justify-center rounded-xl border border-border bg-surface">
          <Icon className="h-7 w-7 text-muted-foreground" strokeWidth={1.8} />
        </div>
      )}
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mt-2 max-w-xs leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
