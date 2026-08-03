import type { Post } from "@/lib/queries/posts";

// Module-scope handoff mirroring draft-restore.ts: the post card stages
// the post being quoted here before pushing /compose, and the composer
// consumes it on mount to render the quoted preview and set the parent.
let pendingQuote: Post | null = null;

export function stageQuoteSeed(post: Post) {
  pendingQuote = post;
}

// Clears on read so the next compose starts without a quote.
export function consumeQuoteSeed(): Post | null {
  const post = pendingQuote;
  pendingQuote = null;
  return post;
}
