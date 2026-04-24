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
        "flex flex-col items-center justify-center py-20 px-6 text-center",
        className
      )}
    >
      {Icon && (
        <div className="relative h-18 w-18 rounded-2xl flex items-center justify-center mb-6">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/10 via-white/[0.04] to-primary/5" />
          <Icon className="relative h-8 w-8 text-muted-foreground/50" />
        </div>
      )}
      <h3 className="text-lg font-bold text-foreground/80">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground/60 mt-2 max-w-xs leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
