"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
import { O, aurora } from "@/lib/design/orbit";

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shareOpen, setShareOpen] = useState(false);
  // Compute the share URL on demand from the current origin. The component
  // is client-only ("use client") and only renders inside a Dialog that
  // mounts after hydration, so window is always defined when this runs.
  const profileUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/${username}`;
  }, [username]);

  // Render a real, scannable QR onto the canvas. The previous fake hash
  // pattern looked QR-shaped but didn't decode in any scanner.
  useEffect(() => {
    if (!open || !profileUrl || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, profileUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 240,
      color: {
        dark: "#0c0a17",
        light: "#ffffff",
      },
    }).catch((err) => {
      console.error("QR render failed:", err);
    });
  }, [open, profileUrl]);

  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `${username}-orbit-qr.png`;
    link.href = url;
    link.click();
    toast.success("QR code downloaded");
  }, [username]);

  if (!profileUrl) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="p-0 gap-0 border-0 bg-transparent shadow-none max-w-none w-auto"
          showCloseButton={false}
        >
          <div
            style={{
              background: O.bg,
              border: `1px solid ${O.hair2}`,
              borderRadius: 20,
              padding: 22,
              width: "min(92vw, 360px)",
              fontFamily: O.sans,
            }}
          >
            <DialogHeader className="p-0">
              <DialogTitle
                style={{
                  textAlign: "center",
                  fontSize: 14,
                  fontWeight: 600,
                  color: O.ink,
                }}
              >
                QR Code
              </DialogTitle>
            </DialogHeader>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 14,
                marginTop: 14,
              }}
            >
              <p
                style={{
                  fontSize: 12,
                  color: O.ink3,
                  textAlign: "center",
                }}
              >
                Scan to visit @{username}&apos;s profile
              </p>

              <div
                style={{
                  background: "white",
                  borderRadius: 18,
                  padding: 14,
                  border: `1px solid ${O.hair2}`,
                }}
              >
                <canvas
                  ref={canvasRef}
                  style={{ display: "block", borderRadius: 6 }}
                />
              </div>

              <p
                style={{
                  fontSize: 11,
                  color: O.ink3,
                  fontFamily: O.mono,
                  letterSpacing: "0.04em",
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {profileUrl}
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 16,
              }}
            >
              <button
                type="button"
                onClick={handleDownload}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: 99,
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${O.hair2}`,
                  color: O.ink,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  fontFamily: "inherit",
                }}
              >
                <Download style={{ width: 14, height: 14 }} />
                Download
              </button>
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: 99,
                  background: aurora,
                  border: "1px solid rgba(255,255,255,0.18)",
                  color: "white",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  fontFamily: "inherit",
                  boxShadow: `0 6px 20px -8px ${O.a2}`,
                }}
              >
                <Share2 style={{ width: 14, height: 14 }} />
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
        <div
          style={{
            background: O.bg,
            border: `1px solid ${O.hair2}`,
            borderRadius: 20,
            padding: 18,
            width: "min(92vw, 420px)",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            fontFamily: O.sans,
          }}
        >
          <DialogHeader className="p-0">
            <DialogTitle style={{ fontSize: 15, fontWeight: 600, color: O.ink }}>
              Share {displayName || `@${username}`}
            </DialogTitle>
          </DialogHeader>

          <button
            type="button"
            onClick={handleCopy}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              borderRadius: 14,
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${O.hair2}`,
              color: O.ink,
              fontSize: 13.5,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
              textAlign: "left",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: aurora,
                display: "grid",
                placeItems: "center",
                color: "white",
                flexShrink: 0,
              }}
            >
              {copied ? (
                <Check style={{ width: 16, height: 16 }} />
              ) : (
                <Copy style={{ width: 16, height: 16 }} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>
                {copied ? "Link copied" : "Copy link"}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: O.ink3,
                  fontFamily: O.mono,
                  marginTop: 2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {profileUrl}
              </div>
            </div>
          </button>

          {!showConversations ? (
            <button
              type="button"
              onClick={() => setShowConversations(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                borderRadius: 14,
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${O.hair2}`,
                color: O.ink,
                fontSize: 13.5,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.06)",
                  display: "grid",
                  placeItems: "center",
                  color: O.ink,
                  flexShrink: 0,
                }}
              >
                <Send style={{ width: 16, height: 16 }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>Send to a chat</div>
                <div style={{ fontSize: 11.5, color: O.ink3, marginTop: 2 }}>
                  Pass it on with a message
                </div>
              </div>
            </button>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add a message (optional)…"
                rows={2}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${O.hair2}`,
                  color: O.ink,
                  fontSize: 13,
                  fontFamily: "inherit",
                  resize: "none",
                  outline: "none",
                }}
              />
              <div
                style={{
                  maxHeight: 260,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                {isLoading ? (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      padding: 20,
                    }}
                  >
                    <Loader2
                      className="animate-spin"
                      style={{ width: 16, height: 16, color: O.ink3 }}
                    />
                  </div>
                ) : !conversations || conversations.length === 0 ? (
                  <div
                    style={{
                      fontSize: 12.5,
                      color: O.ink3,
                      textAlign: "center",
                      padding: 16,
                    }}
                  >
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
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 10px",
                          borderRadius: 12,
                          background: "transparent",
                          border: "none",
                          color: O.ink,
                          fontSize: 13.5,
                          cursor: sent || sending ? "default" : "pointer",
                          opacity: sent || sending ? 0.6 : 1,
                          fontFamily: "inherit",
                          textAlign: "left",
                          width: "100%",
                        }}
                      >
                        <UserAvatar
                          src={c.other_member?.avatar_url ?? null}
                          fallback={c.other_member?.display_name || "?"}
                          size="sm"
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {c.other_member?.display_name ?? "Chat"}
                          </div>
                          <div
                            style={{
                              fontSize: 11.5,
                              color: O.ink3,
                            }}
                          >
                            @{c.other_member?.username ?? "user"}
                          </div>
                        </div>
                        <div style={{ flexShrink: 0 }}>
                          {sending ? (
                            <Loader2
                              className="animate-spin"
                              style={{ width: 14, height: 14, color: O.ink3 }}
                            />
                          ) : sent ? (
                            <Check
                              style={{ width: 14, height: 14, color: O.a2 }}
                            />
                          ) : (
                            <Send
                              style={{ width: 14, height: 14, color: O.ink3 }}
                            />
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
