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
  const broadcastChannelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);

  useEffect(() => {
    if (!streamId) return;
    const supabase = createClient();
    supabaseRef.current = supabase;

    let cancelled = false;
    const fetchTotal = async () => {
      const { data } = await supabase
        .from("live_streams")
        .select("total_likes")
        .eq("id", streamId)
        .single();
      if (cancelled) return;
      const next = (data as { total_likes?: number } | null)?.total_likes;
      if (typeof next === "number") setTotalCount(next);
    };
    void fetchTotal();
    const pollId = setInterval(() => void fetchTotal(), 5000);

    const broadcastChannel = supabase.channel(`hearts:live:${streamId}`, {
      config: { broadcast: { self: true } },
    });

    broadcastChannel
      .on("broadcast", { event: "heart" }, (payload) => {
        const { id, xPct, yPct } = payload.payload as FloatingHeart;
        setHearts((h) => [...h, { id, xPct, yPct }]);
        setTimeout(() => {
          setHearts((h) => h.filter((p) => p.id !== id));
        }, 1500);
      })
      .subscribe();

    broadcastChannelRef.current = broadcastChannel;

    const rowChannel = supabase
      .channel(`live-stream-row:${streamId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "live_streams",
          filter: `id=eq.${streamId}`,
        },
        (payload) => {
          const next = (payload.new as { total_likes?: number }).total_likes;
          if (typeof next === "number") setTotalCount(next);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(pollId);
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(rowChannel);
      broadcastChannelRef.current = null;
      supabaseRef.current = null;
    };
  }, [streamId]);

  const sendHeart = useCallback(
    (xPct: number, yPct: number) => {
      if (!broadcastChannelRef.current) return;
      const heart: FloatingHeart = {
        id: crypto.randomUUID(),
        xPct: Math.max(0, Math.min(1, xPct)),
        yPct: Math.max(0, Math.min(1, yPct)),
      };
      broadcastChannelRef.current.send({
        type: "broadcast",
        event: "heart",
        payload: heart,
      });
      setTotalCount((c) => c + 1);
      const supabase = supabaseRef.current;
      if (supabase) {
        supabase
          .rpc("increment_stream_likes", { p_stream_id: streamId })
          .then(({ error }) => {
            if (error) console.error("increment_stream_likes failed", error);
          });
      }
    },
    [streamId],
  );

  return { hearts, totalCount, sendHeart };
}
