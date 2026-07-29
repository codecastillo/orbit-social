// Reads the `aal` claim out of a JWT that has ALREADY been validated by
// getUser(); this does no signature verification of its own and must never
// be called on a token from any other source.
export function tokenAal(accessToken: string | undefined): string | null {
  if (!accessToken) return null;
  try {
    const payload = accessToken.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return (JSON.parse(json) as { aal?: string }).aal ?? null;
  } catch {
    return null;
  }
}
