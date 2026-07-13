#!/usr/bin/env bash
# Ratchet against the legacy Orbit Glass styling during the refined-dark
# migration. Any file matching a legacy signal must be listed in
# scripts/legacy-allowlist.txt (the not-yet-migrated set). The allowlist
# only ever shrinks; new files are covered automatically. Delete this
# script and the allowlist when the migration finishes.
set -euo pipefail
cd "$(dirname "$0")/.."

ALLOWLIST="scripts/legacy-allowlist.txt"

collect_hits() {
  {
    # Bridge imports: a migrated file must not depend on the compat tokens.
    grep -rlE 'from "@/lib/design/orbit"' src --include='*.tsx' --include='*.ts' 2>/dev/null || true
    # Glass blur in inline styles.
    grep -rl 'backdropFilter' src --include='*.tsx' 2>/dev/null || true
    # Hex alpha concatenated onto an interpolated color: silently invalid
    # CSS once the value is a var() reference.
    perl -lne 'print $ARGV and close ARGV if /\$\{[^{}]+\}[0-9a-fA-F]{2}(?![0-9a-zA-Z_-])/ && !/color-mix/' \
      $(find src -name '*.tsx' -o -name '*.ts') 2>/dev/null || true
    # Legacy utility classes. The landing-* entrance keyframes are NOT
    # legacy: they are reduced-motion-guarded reveals the new landing keeps.
    grep -rlE '\b(glass|avatar-animated-glow|hover-lift)\b' \
      src --include='*.tsx' 2>/dev/null || true
  } | sort -u
}

hits=$(collect_hits)
violations=$(comm -23 <(printf '%s\n' "$hits") <(sort -u "$ALLOWLIST"))
stale=$(comm -12 <(sort -u "$ALLOWLIST") <(comm -13 <(printf '%s\n' "$hits") <(sort -u "$ALLOWLIST")) || true)

if [ -n "$violations" ]; then
  echo "Legacy design styling found outside the migration allowlist:"
  printf '  %s\n' $violations
  echo "Migrate the file onto the token system, or (only for not-yet-migrated code) add it to $ALLOWLIST."
  exit 1
fi

clean=$(comm -13 <(printf '%s\n' "$hits") <(sort -u "$ALLOWLIST"))
if [ -n "$clean" ]; then
  echo "Allowlist entries now clean (remove them from $ALLOWLIST):"
  printf '  %s\n' $clean
fi

remaining=$(printf '%s\n' "$hits" | grep -c . || true)
echo "Legacy-design ratchet OK. Files still carrying legacy styling: $remaining"
