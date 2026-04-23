"use client";

import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  icon: LucideIcon;
  value: number | string;
  label: string;
  className?: string;
}

export function StatsCard({ icon: Icon, value, label, className }: StatsCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-card/50 p-5 ring-1 ring-foreground/10 backdrop-blur-sm",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{label}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
    </div>
  );
}
