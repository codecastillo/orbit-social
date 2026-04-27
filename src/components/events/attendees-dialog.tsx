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
import { O } from "@/lib/design/orbit";

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
      <DialogContent
        className="sm:max-w-md p-0 overflow-hidden border border-white/10"
        style={{ background: O.bg }}
      >
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-white/10">
          <DialogTitle
            style={{
              fontFamily: O.sans,
              color: O.ink,
              fontSize: 16,
              letterSpacing: "0.02em",
            }}
          >
            Attendees
          </DialogTitle>
        </DialogHeader>
        <div
          style={{ maxHeight: 520, overflowY: "auto" }}
          className="divide-y divide-white/5"
        >
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
            <div
              style={{
                color: O.ink3,
                padding: "32px 20px",
                textAlign: "center",
                fontSize: 13,
              }}
            >
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
      <div
        style={{
          padding: "10px 20px 6px",
          fontSize: 10,
          letterSpacing: "0.14em",
          color: O.ink3,
          fontFamily: O.mono,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      {items.map((p) => (
        <Link
          key={p.user_id}
          href={`/${p.profiles.username}`}
          onClick={onClose}
          style={{ textDecoration: "none" }}
          className="flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors"
        >
          <UserAvatar
            src={p.profiles.avatar_url}
            fallback={p.profiles.display_name || p.profiles.username}
            size="md"
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: O.ink,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {p.profiles.display_name || p.profiles.username}
              </span>
              {p.profiles.is_verified && <VerifiedStar size={12} />}
            </div>
            <div style={{ fontSize: 12, color: O.ink3 }}>
              @{p.profiles.username}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
