/**
 * Labels for the kinds of thing a person can report, mirroring the web
 * registry at src/lib/reports/entities.ts. Kept in sync by hand because the
 * two apps share no code; the values are what land in `reports.entity_type`,
 * so a mismatch would split one kind of report into two buckets in the admin
 * queue.
 *
 * Mobile needs only the labels. The routes in the web registry exist for the
 * admin queue, which has no mobile equivalent.
 */
export const REPORT_ENTITY_LABELS: Record<string, string> = {
  post: "post",
  comment: "comment",
  profile: "profile",
  clip: "clip",
  clip_comment: "clip comment",
  moment: "moment",
  room: "room",
  room_post: "room post",
  room_member: "room member",
  event: "event",
  listing: "listing",
  live_stream: "live stream",
  live_chat: "live chat message",
  vod: "replay",
  message: "message",
  conversation: "group conversation",
};

/** Human label for a report sheet's header. Unknown types read as themselves. */
export function reportEntityLabel(entityType: string): string {
  return REPORT_ENTITY_LABELS[entityType] ?? entityType;
}
