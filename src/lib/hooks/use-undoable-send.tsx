"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export const UNDO_WINDOW_MS = 5000;

export interface UndoableSendOptions {
  /** Toast label, e.g. "Sent" or "Post created". */
  message: string;
  /** The delayed network write. Must handle its own failures. */
  commit: () => void;
  /** Cancels the write and restores whatever the user typed. */
  onUndo: () => void;
}

export type ScheduleUndoableSend = (options: UndoableSendOptions) => void;

interface PendingSend {
  timer: ReturnType<typeof setTimeout>;
  toastId: string | number;
  commit: () => void;
}

/** Toast body with a live seconds-remaining readout for the undo window. */
function UndoCountdown({ message }: { message: string }) {
  const [secondsLeft, setSecondsLeft] = useState(UNDO_WINDOW_MS / 1000);
  useEffect(() => {
    const interval = setInterval(
      () => setSecondsLeft((s) => Math.max(1, s - 1)),
      1000
    );
    return () => clearInterval(interval);
  }, []);
  return (
    <span>
      {message} · {secondsLeft}s
    </span>
  );
}

/**
 * Client-side delayed commit: the network write waits UNDO_WINDOW_MS while a
 * toast offers Undo. Undo cancels the write; the timer elapsing, the owning
 * component unmounting, or the page hiding commits immediately so the send
 * is never lost. Each scheduled send gets its own timer, so rapid successive
 * sends stack independently.
 */
export function useUndoableSend() {
  const pendingRef = useRef(new Map<string | number, PendingSend>());

  /** Commits every pending send now, skipping the rest of its window. */
  const flush = useCallback(() => {
    for (const send of pendingRef.current.values()) {
      clearTimeout(send.timer);
      toast.dismiss(send.toastId);
      send.commit();
    }
    pendingRef.current.clear();
  }, []);

  useEffect(() => {
    // pagehide covers tab close and hard navigations; the unmount cleanup
    // covers client-side route changes away from the sending surface.
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  const schedule = useCallback<ScheduleUndoableSend>(
    ({ message, commit, onUndo }) => {
      const toastId = toast(<UndoCountdown message={message} />, {
        duration: UNDO_WINDOW_MS,
        action: {
          label: "Undo",
          onClick: () => {
            const send = pendingRef.current.get(toastId);
            if (!send) return;
            clearTimeout(send.timer);
            pendingRef.current.delete(toastId);
            onUndo();
          },
        },
      });
      const timer = setTimeout(() => {
        pendingRef.current.delete(toastId);
        commit();
      }, UNDO_WINDOW_MS);
      pendingRef.current.set(toastId, { timer, toastId, commit });
    },
    []
  );

  return { schedule, flush };
}
