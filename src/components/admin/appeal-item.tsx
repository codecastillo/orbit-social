"use client";

import { Scale, CheckCircle, XCircle } from "lucide-react";
import { formatTimeAgo } from "@/lib/utils/format";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import type { AppealWithContext } from "@/lib/queries/admin";

interface AppealItemProps {
  appeal: AppealWithContext;
  onResolve: (appealId: string, resolution: "upheld" | "reversed") => void;
  isResolving?: boolean;
}

export function AppealItem({ appeal, onResolve, isResolving }: AppealItemProps) {
  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex items-center gap-3">
        <Scale className="h-4 w-4 shrink-0 text-yellow-500" />
        <UserAvatar
          src={appeal.appellant?.avatar_url}
          fallback={appeal.appellant?.display_name ?? "?"}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {appeal.appellant?.display_name}
          </p>
          <p className="text-xs text-muted-foreground">
            @{appeal.appellant?.username}
          </p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatTimeAgo(appeal.created_at)}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {appeal.report && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Actioned Report
            </p>
            <p className="mt-1 text-sm">
              {appeal.report.reason}
              <span className="text-muted-foreground">
                {" "}
                ({appeal.report.entity_type})
              </span>
            </p>
            {appeal.report.action_taken && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Action taken: {appeal.report.action_taken}
              </p>
            )}
          </div>
        )}
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Appeal Message
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{appeal.message}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={isResolving}
          onClick={() => onResolve(appeal.id, "upheld")}
        >
          <CheckCircle className="h-3.5 w-3.5" />
          Uphold
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={isResolving}
          onClick={() => onResolve(appeal.id, "reversed")}
        >
          <XCircle className="h-3.5 w-3.5" />
          Reverse
        </Button>
      </div>
    </div>
  );
}
