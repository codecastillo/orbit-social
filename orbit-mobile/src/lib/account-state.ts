type Reset = () => void;

const resets = new Set<Reset>();

/**
 * Registers a reset for state a module keeps at module scope on behalf of the
 * signed-in account. Modules register themselves rather than being listed
 * here so nothing is pulled into the cold-start bundle just to be cleared,
 * and a module that never loaded has no carryover to clear.
 */
export function registerAccountScopedReset(reset: Reset): void {
  resets.add(reset);
}

/**
 * Drops every module-scope carryover from the outgoing account. Called on
 * account switch and sign-out, alongside the react-query cache clear: a
 * value that outlives the session it was captured under is a data leak, not
 * a stale render.
 */
export function resetAccountScopedState(): void {
  for (const reset of resets) reset();
}
