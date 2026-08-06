"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { formatTimeAgo } from "@/lib/utils/format";
import {
  decideVerificationRequest,
  getVerificationRequests,
} from "@/lib/queries/admin";

const TABS = ["pending", "approved", "rejected"] as const;

/**
 * The verification queue.
 *
 * A reviewer needs the case, the links, and enough about the account to judge
 * it, all on one screen. Rejecting asks for a reason because promise 3 says
 * every decision comes with one, and the requester is shown exactly what is
 * typed here.
 */
export default function AdminVerificationPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]>("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data: requests, isLoading } = useQuery({
    queryKey: ["admin-verification", tab],
    queryFn: () => getVerificationRequests(tab),
  });

  const decide = useMutation({
    mutationFn: ({
      id,
      approve,
      note,
    }: {
      id: string;
      approve: boolean;
      note?: string;
    }) => decideVerificationRequest(id, approve, note),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-verification"] });
      toast.success(variables.approve ? "Verified" : "Request declined");
    },
    onError: () => toast.error("Couldn't record that decision"),
  });

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <h1 className="text-2xl font-bold">Verification</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Free, never sold. A badge says an account is who it claims to be and
        buys no extra reach.
      </p>

      <div className="mt-5 flex gap-1 rounded-2xl border border-border bg-surface p-1.5">
        {TABS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium capitalize transition-colors ${
              tab === value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))
        ) : !requests || requests.length === 0 ? (
          <EmptyState
            icon={BadgeCheck}
            title={`No ${tab} requests`}
            description="Requests appear here as people send them."
          />
        ) : (
          requests.map((request) => (
            <div
              key={request.id}
              className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
            >
              <div className="flex items-center gap-3">
                <UserAvatar
                  src={request.profiles?.avatar_url}
                  fallback={request.profiles?.display_name ?? "?"}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/${request.profiles?.username}`}
                    target="_blank"
                    className="text-sm font-semibold hover:underline"
                  >
                    {request.profiles?.display_name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    @{request.profiles?.username} ·{" "}
                    {request.profiles?.follower_count ?? 0} followers · joined{" "}
                    {request.profiles
                      ? new Date(request.profiles.created_at).getFullYear()
                      : "?"}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium capitalize">
                  {request.category.replace("_", " ")}
                </span>
              </div>

              <p className="mt-3 whitespace-pre-wrap text-sm">
                {request.statement}
              </p>

              {request.evidence.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {request.evidence.map((link) => (
                    <li key={link}>
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              )}

              {request.decision_note && (
                <p className="mt-3 rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
                  {request.decision_note}
                </p>
              )}

              {request.status === "pending" && (
                <div className="mt-4 space-y-2">
                  <input
                    value={notes[request.id] ?? ""}
                    onChange={(e) =>
                      setNotes((prev) => ({
                        ...prev,
                        [request.id]: e.target.value,
                      }))
                    }
                    placeholder="Reason, shown to them if declined"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={decide.isPending}
                      onClick={() =>
                        decide.mutate({
                          id: request.id,
                          approve: true,
                          note: notes[request.id],
                        })
                      }
                    >
                      <BadgeCheck className="h-3.5 w-3.5" />
                      Verify
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={decide.isPending || !notes[request.id]?.trim()}
                      title={
                        notes[request.id]?.trim()
                          ? undefined
                          : "A decline needs a reason"
                      }
                      onClick={() =>
                        decide.mutate({
                          id: request.id,
                          approve: false,
                          note: notes[request.id],
                        })
                      }
                    >
                      <X className="h-3.5 w-3.5" />
                      Decline
                    </Button>
                  </div>
                </div>
              )}

              <p className="mt-3 text-xs text-text-faint">
                Sent {formatTimeAgo(request.created_at)}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
