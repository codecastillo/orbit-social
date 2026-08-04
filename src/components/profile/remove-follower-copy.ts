/**
 * Shared wording for removing a follower, used by the followers page and the
 * follow list dialog. Both need to say the same two things: nothing is sent
 * to the person, and removal is not a block.
 */
export const REMOVE_FOLLOWER_DESCRIPTION =
  "They won't be notified, and they can follow you again unless you block them.";

export function removeFollowerTitle(username: string): string {
  return `Remove @${username} from your followers?`;
}
