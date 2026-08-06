"use client";

import { useEffect, useRef, useState } from "react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { searchUsers } from "@/lib/queries/social";
import type { ProfileSummary } from "@/lib/queries/social";

const SUGGESTION_LIMIT = 5;
const DEBOUNCE_MS = 180;

/**
 * The @token the collapsed caret sits inside, or null.
 *
 * Deliberately identical to the mobile rule in
 * orbit-mobile/src/components/mention-input.tsx: an @ glued to a preceding
 * word character is an email, not a mention, and the server-side trigger that
 * writes post_mentions applies the same boundary. Three places have to agree
 * on what a mention is, so the rule is stated the same way in each.
 */
export function activeMentionToken(
  text: string,
  caret: number,
): { start: number; query: string } | null {
  if (caret < 0 || caret > text.length) return null;
  const upto = text.slice(0, caret);
  const at = upto.lastIndexOf("@");
  if (at === -1) return null;
  if (at > 0 && /[A-Za-z0-9_@]/.test(upto[at - 1])) return null;
  const query = upto.slice(at + 1);
  if (!/^[A-Za-z0-9_]*$/.test(query)) return null;
  return { start: at, query };
}

/**
 * Suggestion list for an @mention being typed in a textarea.
 *
 * Rendered by the composer, which owns the textarea and its caret; this only
 * decides what to show and reports the pick. Keyboard-first, because the
 * caret is already in a text field and reaching for the mouse to finish a
 * word is the thing that makes autocomplete feel worse than typing.
 */
export function MentionAutocomplete({
  text,
  caret,
  onPick,
  className,
}: {
  text: string;
  /** Collapsed caret offset, or -1 while a range is selected. */
  caret: number;
  /** Receives the replacement text and the caret position after it. */
  onPick: (nextText: string, nextCaret: number) => void;
  className?: string;
}) {
  const token = caret >= 0 ? activeMentionToken(text, caret) : null;
  const query = token?.query ?? null;

  const [results, setResults] = useState<ProfileSummary[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  // Guards against a slow response for an old query landing after a newer
  // one and repopulating the list with stale names.
  const requestRef = useRef(0);

  useEffect(() => {
    // No token under the caret means nothing to search. Returning rather
    // than clearing state keeps this effect free of synchronous setState;
    // `suggestions` below is what decides whether anything renders.
    if (query === null) return;
    const id = ++requestRef.current;
    const timer = setTimeout(async () => {
      try {
        const found = await searchUsers(query, SUGGESTION_LIMIT);
        if (requestRef.current === id) {
          setResults(found);
          setHighlighted(0);
        }
      } catch {
        // A failed lookup shows no suggestions, which is what happens when
        // there are none. Nothing to tell the user about mid-word.
        if (requestRef.current === id) setResults([]);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // Derived rather than stored: results for a token that is no longer under
  // the caret must not show, and clearing them in an effect would cascade.
  const suggestions = query === null ? [] : results;

  const pick = (profile: ProfileSummary) => {
    if (!token) return;
    const before = text.slice(0, token.start);
    const after = text.slice(token.start + 1 + token.query.length);
    const inserted = `@${profile.username} `;
    onPick(before + inserted + after, before.length + inserted.length);
    setResults([]);
  };

  // The composer forwards its keydown here so arrows and Enter drive the list
  // while it is open, and fall through to normal typing when it is not.
  useEffect(() => {
    if (suggestions.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlighted((i) => (i + 1) % suggestions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlighted((i) => (i - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pick(suggestions[highlighted]);
      } else if (e.key === "Escape") {
        setResults([]);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  if (suggestions.length === 0) return null;

  return (
    <ul
      role="listbox"
      aria-label="Mention suggestions"
      className={`absolute z-50 w-full max-w-sm overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-lg ${className ?? ""}`}
    >
      {suggestions.map((profile, i) => (
        <li key={profile.id}>
          <button
            type="button"
            role="option"
            aria-selected={i === highlighted}
            onMouseEnter={() => setHighlighted(i)}
            onClick={() => pick(profile)}
            className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
              i === highlighted ? "bg-muted" : "hover:bg-muted/60"
            }`}
          >
            <UserAvatar
              src={profile.avatar_url}
              fallback={profile.display_name || profile.username}
              size="sm"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {profile.display_name || profile.username}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                @{profile.username}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
