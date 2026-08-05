/**
 * Every kind of thing a person can report, in one place.
 *
 * `reports.entity_type` is a free TEXT column, which is why report paths could
 * be added to individual surfaces over time without a migration. The cost of
 * that freedom is that the admin queue had no idea what any given value meant
 * and could not link to the reported content, so a moderator saw "reported
 * clip" with no way to look at the clip. This registry is what makes a report
 * actionable: a label to read, and a route to the thing itself.
 *
 * Adding a report path anywhere means adding an entry here first. A type with
 * no entry still records correctly, it just arrives in the queue unlinked.
 */
export const REPORT_ENTITIES = {
  post: { label: "post", href: (id: string) => `/post/${id}` },
  comment: { label: "comment", href: (id: string) => `/post/${id}` },
  profile: { label: "profile", href: null },
  clip: { label: "clip", href: (id: string) => `/clips/${id}` },
  clip_comment: { label: "clip comment", href: (id: string) => `/post/${id}` },
  moment: { label: "moment", href: null },
  room: { label: "room", href: null },
  room_post: { label: "room post", href: (id: string) => `/post/${id}` },
  room_member: { label: "room member", href: null },
  event: { label: "event", href: (id: string) => `/events/${id}` },
  listing: { label: "listing", href: (id: string) => `/marketplace/${id}` },
  live_stream: { label: "live stream", href: (id: string) => `/live/${id}` },
  live_chat: { label: "live chat message", href: null },
  vod: { label: "replay", href: (id: string) => `/vod/${id}` },
  message: { label: "message", href: null },
  conversation: { label: "group conversation", href: null },
} as const;

export type ReportEntityType = keyof typeof REPORT_ENTITIES;

/** Human label for the queue. Unknown types read as themselves. */
export function reportEntityLabel(entityType: string): string {
  return REPORT_ENTITIES[entityType as ReportEntityType]?.label ?? entityType;
}

/**
 * Route to the reported content, or null when there is nowhere useful to send
 * a moderator. Profiles, moments, and DM content are null on purpose: the
 * first needs a username the report does not carry, and the rest are private
 * to their participants, so the queue must not offer a door into them.
 */
export function reportEntityHref(
  entityType: string,
  entityId: string,
): string | null {
  const entity = REPORT_ENTITIES[entityType as ReportEntityType];
  return entity?.href ? entity.href(entityId) : null;
}
