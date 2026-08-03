// Module-scope handoff mirroring draft-restore.ts: the conversation
// settings screen stages a search request here before popping back, and
// the conversation screen consumes it on focus to open its search bar.
// Scoped to a conversation id so a stale flag can't open search in a
// different thread.
let pendingSearchConversationId: string | null = null;

export function stageConversationSearch(conversationId: string) {
  pendingSearchConversationId = conversationId;
}

// Clears on read either way so a stale request never lingers.
export function consumeConversationSearch(conversationId: string): boolean {
  const matches = pendingSearchConversationId === conversationId;
  pendingSearchConversationId = null;
  return matches;
}
