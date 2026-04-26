"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface FloatingHeart {
  id: string;
  xPct: number;
  yPct: number;
}

export function useStreamHearts(streamId: string): {
  hearts: FloatingHeart[];
  totalCount: number;
  sendHeart: (xPct: number, yPct: number) => void;
} {
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  useEffect(() => {
    if (!streamId) return;
    const supabase = createClient();
    const channel = supabase.channel(`hearts:live:${streamId}`, {
      config: { broadcast: { self: true } },
    });

    channel
      .on("broadcast", { event: "heart" }, (payload) => {
        const { id, xPct, yPct } = payload.payload as FloatingHeart;
        setHearts((h) => [...h, { id, xPct, yPct }]);
        setTotalCount((c) => c + 1);
        setTimeout(() => {
          setHearts((h) => h.filter((p) => p.id !== id));
        }, 1500);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [streamId]);

  const sendHeart = useCallback((xPct: number, yPct: number) => {
    if (!channelRef.current) return;
    const heart: FloatingHeart = {
      id: crypto.randomUUID(),
      xPct: Math.max(0, Math.min(1, xPct)),
      yPct: Math.max(0, Math.min(1, yPct)),
    };
    channelRef.current.send({
      type: "broadcast",
      event: "heart",
      payload: heart,
    });
  }, []);

  return { hearts, totalCount, sendHeart };
}
