import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

/** Rows to draw for a list this account has never loaded on this device. */
const UNKNOWN_ROWS = 3;

/** Nothing is gained past a screenful of placeholders. */
const DEFAULT_MAX_ROWS = 8;

export const LIST_HINT_KEY = "list-hint";

const hintKey = (list: string, userId: string | undefined) => [
  LIST_HINT_KEY,
  list,
  userId,
];

/**
 * How many skeleton rows a list should draw while it loads.
 *
 * A skeleton is a promise about how much content is coming, so a fixed count
 * makes an account with one conversation look like an account with eight that
 * loads slowly. The last known length is remembered instead. It lives in the
 * query cache as a bare integer, which means it persists to storage even for
 * the lists whose contents deliberately do not (conversations), and it is
 * wiped with everything else on account switch.
 *
 * @param list Stable name for the list, unique across screens.
 * @param userId Owner of the count; hints never cross accounts.
 * @param length Current length once loaded, or undefined while pending.
 * @param max Upper clamp, for lists whose rows are unusually tall.
 */
export function useSkeletonRows(
  list: string,
  userId: string | undefined,
  length: number | undefined,
  max: number = DEFAULT_MAX_ROWS,
): number {
  const queryClient = useQueryClient();

  // Read once on mount. Re-reading would let the skeleton resize under the
  // user in the moment before the real rows replace it.
  const [rows] = useState(() => {
    const remembered = queryClient.getQueryData<number>(hintKey(list, userId));
    if (remembered === undefined) return UNKNOWN_ROWS;
    return Math.min(Math.max(remembered, 1), max);
  });

  useEffect(() => {
    if (length === undefined) return;
    queryClient.setQueryData(hintKey(list, userId), length);
  }, [queryClient, list, userId, length]);

  return rows;
}
