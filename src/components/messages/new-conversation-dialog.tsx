"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Edit3, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ModalShell, Field, Input } from "@/components/orbit/forms";
import { UserAvatar } from "@/components/shared/user-avatar";
import { O, auroraSoft } from "@/lib/design/orbit";
import { useAuth } from "@/lib/hooks/use-auth";
import { searchUsers, type ProfileSummary } from "@/lib/queries/social";
import { getOrCreateDMConversation } from "@/lib/queries/messages";

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewConversationDialog({
  open,
  onOpenChange,
}: NewConversationDialogProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProfileSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [navigating, setNavigating] = useState<string | null>(null);

  const handleSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query);
      if (query.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        const results = await searchUsers(query, 10);
        setSearchResults(results.filter((r) => r.id !== user?.id));
      } catch {
        toast.error("Failed to search users");
      } finally {
        setSearching(false);
      }
    },
    [user?.id]
  );

  const handleSelectUser = async (profile: ProfileSummary) => {
    if (!user) return;
    setNavigating(profile.id);
    try {
      const conversationId = await getOrCreateDMConversation(user.id, profile.id);
      onOpenChange(false);
      reset();
      router.push(`/messages/${conversationId}`);
    } catch (e) {
      const msg = (e as { message?: string } | undefined)?.message;
      console.error("getOrCreateDMConversation failed", e);
      toast.error(msg ? `Failed: ${msg}` : "Failed to start conversation");
    } finally {
      setNavigating(null);
    }
  };

  const reset = () => {
    setSearchQuery("");
    setSearchResults([]);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        onOpenChange(val);
        if (!val) reset();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 border-0 bg-transparent shadow-none max-w-none w-auto ring-0"
        style={{ boxShadow: "none" }}
      >
        <ModalShell
          title="New conversation"
          subtitle="Search someone to start talking to."
          icon={<Edit3 style={{ width: 17, height: 17 }} strokeWidth={1.8} />}
          accent={O.a2}
          primaryLabel="Start"
          canSubmit={false}
          onClose={() => onOpenChange(false)}
          onSecondary={() => onOpenChange(false)}
          secondaryLabel="Close"
        >
          <Field label="To">
            <Input
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by name or @handle…"
              prefix="🔎"
              autoFocus
            />
          </Field>

          {searching && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "14px 16px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.025)",
                border: `1px solid ${O.hair2}`,
                marginBottom: 18,
              }}
            >
              <Loader2
                style={{ width: 14, height: 14, color: O.ink3 }}
                className="animate-spin"
              />
              <span style={{ fontSize: 12, color: O.ink3 }}>Searching…</span>
            </div>
          )}

          {searchQuery.trim().length === 0 && (
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.025)",
                border: `1px solid ${O.hair2}`,
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 18,
              }}
            >
              <AlertCircle
                style={{ width: 14, height: 14, color: O.ink3 }}
                strokeWidth={1.6}
              />
              <span style={{ fontSize: 12, color: O.ink3 }}>
                Type at least 2 characters to search
              </span>
            </div>
          )}

          {searchResults.length > 0 && (
            <>
              <div
                style={{
                  marginBottom: 10,
                  fontSize: 11,
                  color: O.ink3,
                  fontFamily: O.mono,
                  letterSpacing: "0.12em",
                  fontWeight: 600,
                }}
              >
                RESULTS
              </div>
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectUser(p)}
                  disabled={navigating === p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 10px",
                    borderRadius: 12,
                    cursor: "pointer",
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    color: O.ink,
                    textAlign: "left",
                    opacity: navigating === p.id ? 0.5 : 1,
                    fontFamily: "inherit",
                  }}
                >
                  <UserAvatar
                    src={p.avatar_url}
                    fallback={p.display_name}
                    size="md"
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {p.display_name}
                    </div>
                    <div style={{ fontSize: 11.5, color: O.ink3 }}>
                      @{p.username}
                    </div>
                  </div>
                  <span
                    style={{
                      padding: "6px 12px",
                      borderRadius: 99,
                      background: auroraSoft,
                      border: `1px solid color-mix(in oklab, ${O.a2} 27%, transparent)`,
                      color: O.ink,
                      fontSize: 11.5,
                      fontWeight: 500,
                    }}
                  >
                    {navigating === p.id ? "…" : "Message"}
                  </span>
                </button>
              ))}
            </>
          )}

          {searchQuery.trim().length >= 2 && !searching && searchResults.length === 0 && (
            <p
              style={{
                textAlign: "center",
                fontSize: 12,
                color: O.ink3,
                padding: "24px 0",
              }}
            >
              No users found
            </p>
          )}
        </ModalShell>
      </DialogContent>
    </Dialog>
  );
}
