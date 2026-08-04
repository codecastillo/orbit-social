"use client";

import { useCallback, useRef } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  recordImpression,
  type ImpressionSurface,
} from "@/lib/services/impressions";

// Half the card visible for half a second. Anything shorter is a scroll-past
// and produces no row at all.
const VISIBLE_RATIO = 0.5;
const QUALIFY_MS = 500;

/**
 * Ref to attach to a post card so its time on screen lands in the impression
 * queue. Returns a callback ref, mirroring the infinite-scroll observer in
 * feed-list.
 *
 * The impression is finalized when the card leaves view, and on unmount via
 * the ref(null) call React makes when the element goes away. A card that
 * never stays 50% visible for 500ms records nothing.
 */
export function useImpression(postId: string, surface: ImpressionSurface) {
  const { user } = useAuth();
  const enabled = Boolean(user);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const qualifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qualifiedAtRef = useRef<number | null>(null);

  const finalize = useCallback(() => {
    if (qualifyTimerRef.current) {
      clearTimeout(qualifyTimerRef.current);
      qualifyTimerRef.current = null;
    }
    const qualifiedAt = qualifiedAtRef.current;
    qualifiedAtRef.current = null;
    if (qualifiedAt === null) return;
    recordImpression({
      postId,
      surface,
      dwellMs: Date.now() - qualifiedAt,
    });
  }, [postId, surface]);

  return useCallback(
    (node: HTMLElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      // The node can be swapped out mid-observation (list reorder, key
      // change); bank whatever dwell it had earned.
      finalize();
      if (!node || !enabled) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            if (qualifyTimerRef.current || qualifiedAtRef.current !== null) {
              return;
            }
            qualifyTimerRef.current = setTimeout(() => {
              qualifyTimerRef.current = null;
              qualifiedAtRef.current = Date.now();
            }, QUALIFY_MS);
          } else {
            finalize();
          }
        },
        { threshold: VISIBLE_RATIO },
      );
      observer.observe(node);
      observerRef.current = observer;
    },
    [enabled, finalize],
  );
}
