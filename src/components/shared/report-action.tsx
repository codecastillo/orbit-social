"use client";

import { useState } from "react";
import { Flag, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReportDialog } from "@/components/shared/report-dialog";
import { reportEntityLabel } from "@/lib/reports/entities";
import { useAuth } from "@/lib/hooks/use-auth";

/**
 * The button that opens a report dialog, for surfaces whose only overflow
 * action is reporting. Surfaces with an existing menu should add a report
 * item to it rather than stack a second button beside it.
 *
 * Renders nothing for your own content: there is nothing to report, and an
 * inert button invites the click anyway.
 */
export function ReportAction({
  entityType,
  entityId,
  reportedUserId,
  variant = "icon",
  className,
}: {
  entityType: string;
  entityId: string;
  /** Author of the reported thing. Omitted for content with no single author. */
  reportedUserId?: string;
  /** "icon" is an overflow button, "inline" a labelled row for menus. */
  variant?: "icon" | "inline";
  className?: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user || (reportedUserId && reportedUserId === user.id)) return null;

  const label = `Report this ${reportEntityLabel(entityType)}`;

  return (
    <>
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen(true);
        }}
        className={cn(
          variant === "icon"
            ? "inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            : "inline-flex items-center gap-2 text-sm text-destructive transition-colors hover:underline",
          className,
        )}
      >
        {variant === "icon" ? (
          <MoreHorizontal className="h-4 w-4" />
        ) : (
          <>
            <Flag className="h-4 w-4" />
            {label}
          </>
        )}
      </button>
      <ReportDialog
        open={open}
        onOpenChange={setOpen}
        entityType={entityType}
        entityId={entityId}
        reportedUserId={reportedUserId}
      />
    </>
  );
}
