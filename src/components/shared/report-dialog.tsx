"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/hooks/use-auth";
import { createReport } from "@/lib/queries/admin";

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  entityId: string;
  reportedUserId?: string;
}

const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment" },
  { value: "hate_speech", label: "Hate Speech" },
  { value: "violence", label: "Violence" },
  { value: "nudity", label: "Nudity" },
  { value: "other", label: "Other" },
];

export function ReportDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  reportedUserId,
}: ReportDialogProps) {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");

  const reportMutation = useMutation({
    mutationFn: () => {
      if (!user) throw new Error("Not authenticated");
      return createReport(
        user.id,
        entityType,
        entityId,
        reason,
        description || undefined,
        reportedUserId
      );
    },
    onSuccess: () => {
      setReason("");
      setDescription("");
      onOpenChange(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    reportMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-destructive" />
            Report {entityType}
          </DialogTitle>
          <DialogDescription>
            Help us understand what&apos;s wrong. We&apos;ll review this report
            and take action if needed.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Reason selection */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                Reason
              </label>
              <div className="grid grid-cols-2 gap-2">
                {REPORT_REASONS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setReason(r.value)}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ring-1 ${
                      reason === r.value
                        ? "bg-primary text-primary-foreground ring-primary"
                        : "bg-muted/50 text-muted-foreground ring-foreground/10 hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                Additional details (optional)
              </label>
              <Textarea
                value={description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setDescription(e.target.value)
                }
                placeholder="Provide more context about this report..."
                rows={3}
              />
            </div>

            {reportMutation.isError && (
              <p className="text-sm text-destructive">
                Failed to submit report. Please try again.
              </p>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!reason || reportMutation.isPending}
            >
              {reportMutation.isPending ? "Submitting..." : "Submit Report"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
