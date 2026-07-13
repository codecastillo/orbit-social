"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Download, Share2, Copy, Check, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  getConversations,
  sendMessage,
  type ConversationWithPreview,
} from "@/lib/queries/messages";

interface QRCodeDialogProps {
  username: string;
  displayName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QRCodeDialog({
  username,
  displayName,
  open,
  onOpenChange,
}: QRCodeDialogProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  // Compute the share URL on demand from the current origin. The component
  // is client-only ("use client") and only renders inside a Dialog that
  // mounts after hydration, so window is always defined when this runs.
  const profileUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/${username}`;
  }, [username]);

  // Generate a real, scannable QR as a PNG data URL. Using toCanvas with a
  // ref had a race where the canvas wasn't mounted in time inside the
  // Dialog, so the box came up blank. toDataURL avoids the ref entirely.
  useEffect(() => {
    let cancelled = false;
    if (!open || !profileUrl) {
      setQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(profileUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 480,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error("QR render failed:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [open, profileUrl]);

  const handleDownload = useCallback(() => {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.download = `${username}-orbit-qr.png`;
    link.href = qrDataUrl;
    link.click();
    toast.success("QR code downloaded");
  }, [qrDataUrl, username]);

  if (!profileUrl) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="p-0 gap-0 border-0 bg-transparent shadow-none max-w-none w-auto"
          showCloseButton={false}
        >
          <div className="w-[min(92vw,360px)] rounded-2xl border border-border bg-surface-elevated p-5">
            <DialogHeader className="p-0">
              <DialogTitle className="text-center text-sm font-semibold text-foreground">
                QR Code
              </DialogTitle>
            </DialogHeader>

            <div className="mt-3.5 flex flex-col items-center gap-3.5">
              <p className="text-center text-xs text-muted-foreground">
                Scan to visit @{username}&apos;s profile
              </p>

              <div className="grid h-[268px] w-[268px] place-items-center rounded-2xl border border-border bg-white p-3.5">
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrDataUrl}
                    alt={`QR code for @${username}`}
                    width={240}
                    height={240}
                    className="block rounded-md"
                  />
                ) : (
                  <Loader2 className="h-5 w-5 animate-spin text-black" />
                )}
              </div>

              <p className="max-w-full truncate font-mono text-[11px] tracking-[0.04em] text-muted-foreground">
                {profileUrl}
              </p>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[13px] font-semibold text-foreground transition-colors hover:bg-surface/80"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </button>
              <button
                type="button"
                onClick={() => {
                  // Close the QR dialog before opening Share so we never
                  // stack two centered dialogs (which read as "off-center"
                  // because their widths differ).
                  onOpenChange(false);
                  setShareOpen(true);
                }}
                className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 py-2.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Share2 className="h-3.5 w-3.5" />
                Share
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ProfileShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        profileUrl={profileUrl}
        displayName={displayName}
        username={username}
      />
    </>
  );
}

// ── Custom in-app share modal ────────────────────────────────────────
// Mirrors the post ShareDialog: copy link + send to a chat with an
// optional message. Replaces the previous navigator.share fallback.

function ProfileShareDialog({
  open,
  onOpenChange,
  profileUrl,
  displayName,
  username,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileUrl: string;
  displayName: string;
  username: string;
}) {
  const { user } = useAuth();
  const [showConversations, setShowConversations] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: () => getConversations(user!.id),
    enabled: !!user?.id && showConversations,
    staleTime: 1000 * 60 * 2,
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleSendTo = async (c: ConversationWithPreview) => {
    if (!user || sendingTo) return;
    setSendingTo(c.id);
    try {
      const body = message.trim()
        ? `${message.trim()}\n${profileUrl}`
        : profileUrl;
      await sendMessage(c.id, user.id, body);
      setSentTo((prev) => new Set(prev).add(c.id));
      toast.success(`Sent to ${c.other_member?.display_name ?? "chat"}`);
    } catch {
      toast.error("Failed to send");
    } finally {
      setSendingTo(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 border-0 bg-transparent shadow-none max-w-none w-auto"
        showCloseButton={false}
      >
        <div className="flex w-[min(92vw,420px)] flex-col gap-3.5 rounded-2xl border border-border bg-surface-elevated p-4">
          <DialogHeader className="p-0">
            <DialogTitle className="text-[15px] font-semibold text-foreground">
              Share {displayName || `@${username}`}
            </DialogTitle>
          </DialogHeader>

          <button
            type="button"
            onClick={handleCopy}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface px-3.5 py-3 text-left text-[13.5px] font-medium text-foreground transition-colors hover:bg-surface/80"
          >
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">
                {copied ? "Link copied" : "Copy link"}
              </div>
              <div className="mt-0.5 truncate font-mono text-[11.5px] text-muted-foreground">
                {profileUrl}
              </div>
            </div>
          </button>

          {!showConversations ? (
            <button
              type="button"
              onClick={() => setShowConversations(true)}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface px-3.5 py-3 text-left text-[13.5px] font-medium text-foreground transition-colors hover:bg-surface/80"
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-foreground">
                <Send className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="font-semibold">Send to a chat</div>
                <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                  Pass it on with a message
                </div>
              </div>
            </button>
          ) : (
            <div className="flex flex-col gap-2.5">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add a message (optional)…"
                rows={2}
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-[13px] text-foreground outline-none"
              />
              <div className="flex max-h-[260px] flex-col gap-1 overflow-y-auto">
                {isLoading ? (
                  <div className="flex justify-center p-5">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : !conversations || conversations.length === 0 ? (
                  <div className="p-4 text-center text-[12.5px] text-muted-foreground">
                    No conversations yet
                  </div>
                ) : (
                  conversations.map((c) => {
                    const sent = sentTo.has(c.id);
                    const sending = sendingTo === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSendTo(c)}
                        disabled={sent || sending}
                        className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] text-foreground transition-colors hover:bg-surface disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent"
                      >
                        <UserAvatar
                          src={c.other_member?.avatar_url ?? null}
                          fallback={c.other_member?.display_name || "?"}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold">
                            {c.other_member?.display_name ?? "Chat"}
                          </div>
                          <div className="text-[11.5px] text-muted-foreground">
                            @{c.other_member?.username ?? "user"}
                          </div>
                        </div>
                        <div className="shrink-0">
                          {sending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                          ) : sent ? (
                            <Check className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <Send className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
