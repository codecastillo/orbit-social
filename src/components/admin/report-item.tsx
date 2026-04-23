"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTimeAgo } from "@/lib/utils/format";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ReportWithProfiles } from "@/lib/queries/admin";

interface ReportItemProps {
  report: ReportWithProfiles;
  onUpdateStatus: (
    reportId: string,
    status: "reviewed" | "actioned" | "dismissed",
    actionTaken?: string
  ) => void;
  isUpdating?: boolean;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500",
  reviewed: "bg-blue-500/10 text-blue-500",
  actioned: "bg-green-500/10 text-green-500",
  dismissed: "bg-muted text-muted-foreground",
};

export function ReportItem({
  report,
  onUpdateStatus,
  isUpdating,
}: ReportItemProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      {/* Header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/30"
      >
        <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-500" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {report.reporter?.display_name ?? "Unknown"}
            </span>
            <span className="text-xs text-muted-foreground">
              reported {report.entity_type}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {report.reason}
          </p>
        </div>

        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
            statusColors[report.status]
          )}
        >
          {report.status}
        </span>

        <span className="shrink-0 text-xs text-muted-foreground">
          {formatTimeAgo(report.created_at)}
        </span>

        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-foreground/5 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Reporter */}
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Reporter
              </p>
              <div className="flex items-center gap-2">
                <UserAvatar
                  src={report.reporter?.avatar_url}
                  fallback={report.reporter?.display_name ?? "?"}
                  size="sm"
                />
                <div>
                  <p className="text-sm font-medium">
                    {report.reporter?.display_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    @{report.reporter?.username}
                  </p>
                </div>
              </div>
            </div>

            {/* Reported user */}
            {report.reported_user && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Reported User
                </p>
                <div className="flex items-center gap-2">
                  <UserAvatar
                    src={report.reported_user.avatar_url}
                    fallback={report.reported_user.display_name}
                    size="sm"
                  />
                  <div>
                    <p className="text-sm font-medium">
                      {report.reported_user.display_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      @{report.reported_user.username}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="mt-4 space-y-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Reason
              </p>
              <p className="mt-1 text-sm">{report.reason}</p>
            </div>
            {report.description && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Description
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {report.description}
                </p>
              </div>
            )}
            {report.action_taken && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Action Taken
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {report.action_taken}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          {report.status === "pending" && (
            <div className="mt-4 flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isUpdating}
                onClick={() => onUpdateStatus(report.id, "reviewed")}
              >
                <Eye className="h-3.5 w-3.5" />
                Review
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={isUpdating}
                onClick={() =>
                  onUpdateStatus(report.id, "actioned", "Content removed")
                }
              >
                <CheckCircle className="h-3.5 w-3.5" />
                Action
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={isUpdating}
                onClick={() => onUpdateStatus(report.id, "dismissed")}
              >
                <XCircle className="h-3.5 w-3.5" />
                Dismiss
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
