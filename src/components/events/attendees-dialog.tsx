"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { VerifiedStar } from "@/components/orbit/verified-star";
import { getEventAttendees } from "@/lib/queries/events";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
}

export function AttendeesDialog({ open, onOpenChange, eventId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["event-attendees-full", eventId],
    queryFn: () => getEventAttendees(eventId, 200),
    enabled: open,
  });

  const going = (data ?? []).filter((a) => a.status === "going");
  const interested = (data ?? []).filter((a) => a.status === "interested");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border border-border bg-background">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="text-base tracking-[0.02em] text-foreground">
            Attendees
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[520px] divide-y divide-border overflow-y-auto">
          {isLoading ? (
            <div className="p-4 flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : going.length === 0 && interested.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-muted-foreground">
              No one has RSVP&apos;d yet.
            </div>
          ) : (
            <>
              {going.length > 0 && (
                <Section
                  label={`GOING · ${going.length}`}
                  items={going}
                  onClose={() => onOpenChange(false)}
                />
              )}
              {interested.length > 0 && (
                <Section
                  label={`INTERESTED · ${interested.length}`}
                  items={interested}
                  onClose={() => onOpenChange(false)}
                />
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  label,
  items,
  onClose,
}: {
  label: string;
  items: Array<{
    user_id: string;
    profiles: {
      username: string;
      display_name: string;
      avatar_url: string | null;
      is_verified: boolean;
    };
  }>;
  onClose: () => void;
}) {
  return (
    <div>
      <div className="px-5 pb-1.5 pt-2.5 font-mono text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      {items.map((p) => (
        <Link
          key={p.user_id}
          href={`/${p.profiles.username}`}
          onClick={onClose}
          className="flex items-center gap-3 px-5 py-3 no-underline transition-colors hover:bg-muted"
        >
          <UserAvatar
            src={p.profiles.avatar_url}
            fallback={p.profiles.display_name || p.profiles.username}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <span className="truncate">
                {p.profiles.display_name || p.profiles.username}
              </span>
              {p.profiles.is_verified && <VerifiedStar size={12} />}
            </div>
            <div className="text-xs text-muted-foreground">
              @{p.profiles.username}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
