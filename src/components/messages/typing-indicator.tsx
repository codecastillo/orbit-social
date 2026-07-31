"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

// Broadcast at most every 2s while the input keeps changing, send a stop
// after 3s idle, and expire remote typers a beat later than the idle window
// so a dropped stop event can't leave the row stuck.
const TYPING_THROTTLE_MS = 2000;
const TYPING_IDLE_MS = 3000;
const TYPING_EXPIRE_MS = 4500;

interface TypingPayload {
  userId: string;
  name: string;
  typing: boolean;
}

/**
 * Ephemeral typing state over a dedicated `typing-{conversationId}` broadcast
 * channel, mirroring the per-conversation channel pattern in use-messages.
 * The mobile client subscribes to the same topic, so events cross platforms.
 */
export function useTypingChannel(
  conversationId: string,
  selfId: string,
  selfName: string
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastSentRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expireTimersRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>()
  );
  const [typers, setTypers] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!conversationId || !selfId) return;

    const supabase = createClient();
    const expireTimers = expireTimersRef.current;
    const channel = supabase
      .channel(`typing-${conversationId}`)
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const { userId, name, typing } = payload as TypingPayload;
        if (userId === selfId) return;

        setTypers((prev) => {
          const next = new Map(prev);
          if (typing) next.set(userId, name);
          else next.delete(userId);
          return next;
        });

        const existing = expireTimers.get(userId);
        if (existing) clearTimeout(existing);
        if (typing) {
          expireTimers.set(
            userId,
            setTimeout(() => {
              expireTimers.delete(userId);
              setTypers((prev) => {
                const next = new Map(prev);
                next.delete(userId);
                return next;
              });
            }, TYPING_EXPIRE_MS)
          );
        } else {
          expireTimers.delete(userId);
        }
      })
      .subscribe();
    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      for (const timer of expireTimers.values()) clearTimeout(timer);
      expireTimers.clear();
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      setTypers(new Map());
      supabase.removeChannel(channel);
    };
  }, [conversationId, selfId]);

  const send = useCallback(
    (typing: boolean) => {
      channelRef.current?.send({
        type: "broadcast",
        event: "typing",
        payload: { userId: selfId, name: selfName, typing },
      });
    },
    [selfId, selfName]
  );

  const notifyTyping = useCallback(
    (hasText: boolean) => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (!hasText) {
        lastSentRef.current = 0;
        send(false);
        return;
      }
      const now = Date.now();
      if (now - lastSentRef.current >= TYPING_THROTTLE_MS) {
        lastSentRef.current = now;
        send(true);
      }
      idleTimerRef.current = setTimeout(() => {
        lastSentRef.current = 0;
        send(false);
      }, TYPING_IDLE_MS);
    },
    [send]
  );

  return { typingNames: Array.from(typers.values()), notifyTyping };
}

export function TypingIndicator({
  names,
  isGroup,
}: {
  names: string[];
  isGroup: boolean;
}) {
  if (names.length === 0) return null;

  const label = isGroup
    ? names.length === 1
      ? `${names[0]} is typing`
      : `${names.slice(0, 2).join(" and ")} are typing`
    : "Typing";

  return (
    <div className="flex items-center gap-2 px-4 pb-1.5 text-xs text-muted-foreground">
      <span className="flex items-center gap-0.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1 w-1 rounded-full bg-muted-foreground/70 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </span>
      {label}
    </div>
  );
}
