import type { PostDraft } from "@/lib/queries/drafts";

// Module-scope handoff mirroring the undoRestore snapshot inside
// compose.tsx: the drafts screen stages a draft here before pushing
// /compose, and the composer consumes it on mount to seed its state.
// Kept in its own file so the drafts screen and compose.tsx can share it
// without either owning the other.
let pendingDraft: PostDraft | null = null;

export function stageDraftRestore(draft: PostDraft) {
  pendingDraft = draft;
}

// Clears on read so the next compose starts blank.
export function consumeDraftRestore(): PostDraft | null {
  const draft = pendingDraft;
  pendingDraft = null;
  return draft;
}
