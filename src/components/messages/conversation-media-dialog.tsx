"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowLeft, Images, Loader2, Play } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ModalShell } from "@/components/orbit/forms";
import { Button } from "@/components/ui/button";
import { isAudioMessage } from "@/lib/utils/audio";
import { getConversationMedia, type Message } from "@/lib/queries/messages";

const PAGE_SIZE = 30;

interface ConversationMediaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
}

/** Real photos and videos only; voice notes share media_url but not this UI. */
function isGalleryMedia(message: Message): boolean {
  return !!message.media_url && !isAudioMessage(null, message.media_url);
}

export function ConversationMediaDialog({
  open,
  onOpenChange,
  conversationId,
}: ConversationMediaDialogProps) {
  const [items, setItems] = useState<Message[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [viewing, setViewing] = useState<Message | null>(null);

  // Reset to a fresh loading grid on every open. Adjusted during render per
  // the React "adjusting state when a prop changes" pattern.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setLoading(true);
      setItems([]);
      setViewing(null);
    }
  }

  useEffect(() => {
    if (!open || !conversationId) return;
    let cancelled = false;
    getConversationMedia(conversationId, undefined, PAGE_SIZE)
      .then((page) => {
        if (cancelled) return;
        setItems(page.filter(isGalleryMedia));
        setCursor(page.length > 0 ? page[page.length - 1].created_at : null);
        setHasMore(page.length === PAGE_SIZE);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, conversationId]);

  const loadMore = async () => {
    if (loading || !cursor) return;
    setLoading(true);
    try {
      const page = await getConversationMedia(
        conversationId,
        cursor,
        PAGE_SIZE
      );
      setItems((prev) => [...prev, ...page.filter(isGalleryMedia)]);
      setCursor(page.length > 0 ? page[page.length - 1].created_at : null);
      setHasMore(page.length === PAGE_SIZE);
    } catch {
      // Leave what already loaded; the button stays for a retry.
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 border-0 bg-transparent shadow-none max-w-none w-auto ring-0"
      >
        <DialogTitle className="sr-only">Conversation media</DialogTitle>
        <ModalShell
          title="Media"
          subtitle="Photos and videos shared in this conversation."
          icon={<Images className="h-[17px] w-[17px]" strokeWidth={1.8} />}
          width={560}
          canSubmit={false}
          onClose={() => onOpenChange(false)}
          onSecondary={() => onOpenChange(false)}
          secondaryLabel="Close"
        >
          {viewing ? (
            <div>
              <button
                onClick={() => setViewing(null)}
                className="mb-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to grid
              </button>
              {viewing.media_type === "video" ? (
                <video
                  src={viewing.media_url!}
                  controls
                  autoPlay
                  className="h-[60vh] w-full rounded-xl bg-black object-contain"
                />
              ) : (
                // Full-size view keeps natural dimensions, so plain img beats
                // next/image's fixed-fill layout here.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={viewing.media_url!}
                  alt="Shared media"
                  className="h-[60vh] w-full rounded-xl object-contain"
                />
              )}
            </div>
          ) : (
            <>
              {items.length === 0 && !loading && (
                <p className="py-10 text-center text-xs text-muted-foreground">
                  No media shared yet
                </p>
              )}

              <div className="grid max-h-[55vh] grid-cols-3 gap-2 overflow-y-auto">
                {items.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setViewing(m)}
                    className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted/30 transition-opacity hover:opacity-80"
                    aria-label={
                      m.media_type === "video" ? "Play video" : "View image"
                    }
                  >
                    {m.media_type === "video" ? (
                      <>
                        <video
                          src={m.media_url!}
                          preload="metadata"
                          muted
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50">
                            <Play className="h-4 w-4 text-white" fill="white" />
                          </span>
                        </span>
                      </>
                    ) : (
                      <Image
                        src={m.media_url!}
                        alt="Shared media"
                        fill
                        sizes="170px"
                        className="object-cover"
                      />
                    )}
                  </button>
                ))}
              </div>

              {loading && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}

              {hasMore && !loading && (
                <div className="mt-3 flex justify-center">
                  <Button variant="outline" size="sm" onClick={loadMore}>
                    Load more
                  </Button>
                </div>
              )}
            </>
          )}
        </ModalShell>
      </DialogContent>
    </Dialog>
  );
}
