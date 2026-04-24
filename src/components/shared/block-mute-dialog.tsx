"use client";

import { useState } from "react";
import { ShieldBan, VolumeX, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { blockUser, muteUser } from "@/lib/queries/social";

type ActionType = "block" | "mute";

interface BlockMuteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionType: ActionType;
  currentUserId: string;
  targetUserId: string;
  targetUsername: string;
  onSuccess?: () => void;
}

const DURATION_OPTIONS = [
  { label: "1 hour", value: 1 },
  { label: "24 hours", value: 24 },
  { label: "7 days", value: 168 },
  { label: "30 days", value: 720 },
  { label: "Permanent", value: 0 },
] as const;

export function BlockMuteDialog({
  open,
  onOpenChange,
  actionType,
  currentUserId,
  targetUserId,
  targetUsername,
  onSuccess,
}: BlockMuteDialogProps) {
  const [selectedDuration, setSelectedDuration] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isBlock = actionType === "block";
  const Icon = isBlock ? ShieldBan : VolumeX;
  const actionLabel = isBlock ? "Block" : "Mute";

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const expiresAt =
        selectedDuration > 0
          ? new Date(Date.now() + selectedDuration * 60 * 60 * 1000).toISOString()
          : undefined;

      if (isBlock) {
        await blockUser(currentUserId, targetUserId, expiresAt);
      } else {
        await muteUser(currentUserId, targetUserId, expiresAt);
      }

      toast.success(
        `${isBlock ? "Blocked" : "Muted"} @${targetUsername}${
          selectedDuration > 0
            ? ` for ${DURATION_OPTIONS.find((d) => d.value === selectedDuration)?.label}`
            : ""
        }`
      );
      onOpenChange(false);
      onSuccess?.();
    } catch {
      toast.error(`Failed to ${actionLabel.toLowerCase()} user`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-destructive" />
            {actionLabel} @{targetUsername}
          </DialogTitle>
          <DialogDescription>
            {isBlock
              ? "This user won't be able to see your posts, follow you, or message you."
              : "You won't see posts or notifications from this user."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
            <Clock className="h-4 w-4 text-zinc-500" />
            Duration
          </label>
          <div className="grid grid-cols-1 gap-2">
            {DURATION_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelectedDuration(option.value)}
                className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm font-medium transition-colors ring-1 ${
                  selectedDuration === option.value
                    ? "bg-primary/10 text-primary ring-primary/50"
                    : "bg-white/[0.03] text-zinc-400 ring-white/[0.08] hover:bg-white/[0.06] hover:text-zinc-200"
                }`}
              >
                <span>{option.label}</span>
                {selectedDuration === option.value && (
                  <div className="h-2 w-2 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            variant="destructive"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
