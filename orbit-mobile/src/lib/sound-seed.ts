import { registerAccountScopedReset } from "@/lib/account-state";

// Module-scope handoff mirroring quote-seed.ts: the sound page stages the
// sound being reused here before pushing the clip camera, and the clip
// flows consume it on mount so the new clip credits that sound instead of
// minting an original one.
export interface SoundSeed {
  id: string;
  label: string;
}

let pendingSound: SoundSeed | null = null;

export function stageSoundSeed(seed: SoundSeed) {
  pendingSound = seed;
}

// Clears on read so the next clip starts unattributed.
export function consumeSoundSeed(): SoundSeed | null {
  const seed = pendingSound;
  pendingSound = null;
  return seed;
}

registerAccountScopedReset(() => {
  pendingSound = null;
});
