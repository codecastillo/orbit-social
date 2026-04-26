"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useStreamPresence(
  streamId: string,
  { isStreamer, userId }: { isStreamer: boolean; userId: string | null }
): { count: number } {
  const [count, setCount] = useState(0);
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWrittenRef = useRef<number>(-1);
  const isStreamerRef = useRef(isStreamer);

  useEffect(() => {
    isStreamerRef.current = isStreamer;
  }, [isStreamer]);

  const presenceKey = useMemo(
    () => userId ?? `anon-${crypto.randomUUID()}`,
    [userId]
  );

  useEffect(() => {
    if (!streamId) return;
    const supabase = createClient();
    const channel = supabase.channel(`presence:live:${streamId}`, {
      config: { presence: { key: presenceKey } },
    });

    const sync = () => {
      const state = channel.presenceState();
      const n = Object.keys(state).length;
      setCount(n);
      if (isStreamerRef.current && n !== lastWrittenRef.current) {
        if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
        writeTimerRef.current = setTimeout(async () => {
          try {
            const { error } = await supabase
              .from("live_streams")
              .update({ viewer_count: n })
              .eq("id", streamId);
            if (!error) lastWrittenRef.current = n;
          } catch {
            // best-effort write; ignore network errors
          }
        }, 5000);
      }
    };

    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && !isStreamerRef.current) {
          await channel.track({ joined_at: Date.now() });
        }
      });

    return () => {
      if (writeTimerRef.current) {
        clearTimeout(writeTimerRef.current);
        writeTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [streamId, presenceKey]);

  return { count };
}
