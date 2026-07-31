"use client";

import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import {
  buildMutedWordMatcher,
  getMutedWords,
  getNotInterestedPostIds,
  getRestrictedIds,
} from "@/lib/queries/content-safety";
import type { PostWithAuthor } from "@/lib/queries/posts";

// Long staleTime: these lists only change through the viewer's own
// actions, and every mutation invalidates or patches the cache directly.
const CONTENT_SAFETY_STALE_MS = 30 * 60_000;

export function useMutedWords() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["muted-words", user?.id],
    queryFn: () => getMutedWords(user!.id),
    enabled: !!user,
    staleTime: CONTENT_SAFETY_STALE_MS,
  });
}

export function useRestrictedIds() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["restricted-users", user?.id],
    queryFn: () => getRestrictedIds(user!.id),
    enabled: !!user,
    staleTime: CONTENT_SAFETY_STALE_MS,
  });
}

export function useNotInterestedIds() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["not-interested", user?.id],
    queryFn: () => getNotInterestedPostIds(user!.id),
    enabled: !!user,
    staleTime: CONTENT_SAFETY_STALE_MS,
  });
}

/**
 * Shared comment-list filter, meant to be passed as a query `select`:
 * drops comments from accounts the viewer restricted and comments that
 * contain a muted word. The viewer's own comments always stay visible.
 */
export function useCommentFilter() {
  const { user } = useAuth();
  const { data: mutedWords } = useMutedWords();
  const { data: restrictedIds } = useRestrictedIds();

  const matchesMutedWord = useMemo(
    () => buildMutedWordMatcher(mutedWords ?? []),
    [mutedWords]
  );

  return useCallback(
    (comments: PostWithAuthor[]) =>
      comments.filter((comment) => {
        if (user && comment.user_id === user.id) return true;
        if (restrictedIds?.has(comment.user_id)) return false;
        return !matchesMutedWord(comment.content);
      }),
    [user, restrictedIds, matchesMutedWord]
  );
}
