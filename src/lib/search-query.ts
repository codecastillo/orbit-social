/**
 * Parses a search box into the parts a query can act on.
 *
 * Operators are parsed on the client rather than handed to Postgres because
 * each one maps to a different column or join, not to text matching:
 * `from:` is a user id lookup, `has:image` is an EXISTS on post_media, and
 * `before:` is a timestamp comparison. Only the leftover words are text, and
 * those go to websearch_to_tsquery, which already understands quoted phrases
 * and OR on its own.
 *
 * Mirrored on mobile at orbit-mobile/src/lib/search-query.ts. The two must
 * agree: a query typed in a browser and the same query typed on a phone have
 * to mean the same thing.
 */
export interface ParsedSearch {
  /** Free text left after operators are removed. May be empty. */
  text: string;
  /** Usernames, without the @. Empty means no author filter. */
  from: string[];
  /** Words that must not appear, from -term. */
  exclude: string[];
  /** Attachment requirements from has:image, has:video, has:link. */
  has: ("image" | "video" | "link")[];
  /** ISO dates from before: and after:, or null. */
  before: string | null;
  after: string | null;
}

const HAS_VALUES = new Set(["image", "video", "link"]);

/**
 * Accepts YYYY-MM-DD and YYYY-MM, so "before:2026-07" works without anyone
 * having to remember a day. A month is read as its first day.
 */
function parseDate(raw: string): string | null {
  const ymd = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(raw);
  if (!ymd) return null;
  const [, year, month, day] = ymd;
  const date = new Date(`${year}-${month}-${day ?? "01"}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function parseSearchQuery(raw: string): ParsedSearch {
  const parsed: ParsedSearch = {
    text: "",
    from: [],
    exclude: [],
    has: [],
    before: null,
    after: null,
  };

  const words: string[] = [];
  // Quoted phrases survive whole: websearch_to_tsquery treats them as
  // phrases, so splitting them here would lose the user's intent.
  const tokens = raw.match(/"[^"]*"|\S+/g) ?? [];

  for (const token of tokens) {
    const operator = /^(from|has|before|after|since|until):(.+)$/i.exec(token);
    if (operator) {
      const [, name, valueRaw] = operator;
      const value = valueRaw.replace(/^@/, "").toLowerCase();
      // An unrecognised value falls through to plain text rather than being
      // dropped. "has:banana" is someone guessing at the syntax, and making
      // their words disappear tells them nothing; searching for them shows
      // no results, which is the honest answer.
      switch (name.toLowerCase()) {
        case "from":
          if (value) {
            parsed.from.push(value);
            continue;
          }
          break;
        case "has":
          if (HAS_VALUES.has(value)) {
            parsed.has.push(value as ParsedSearch["has"][number]);
            continue;
          }
          break;
        // since/until read the way people say them out loud; they are the
        // same two bounds as after/before.
        case "before":
        case "until": {
          const date = parseDate(value);
          if (date) {
            parsed.before = date;
            continue;
          }
          break;
        }
        case "after":
        case "since": {
          const date = parseDate(value);
          if (date) {
            parsed.after = date;
            continue;
          }
          break;
        }
      }
    }

    // A bare "-" is someone mid-word, not an exclusion of nothing.
    if (token.startsWith("-") && token.length > 1) {
      parsed.exclude.push(token.slice(1).replace(/"/g, ""));
      continue;
    }

    words.push(token);
  }

  parsed.text = words.join(" ").trim();
  return parsed;
}

/** True when the query asks for something beyond plain text. */
export function hasFilters(parsed: ParsedSearch): boolean {
  return (
    parsed.from.length > 0 ||
    parsed.exclude.length > 0 ||
    parsed.has.length > 0 ||
    parsed.before !== null ||
    parsed.after !== null
  );
}

/** A short human summary of the active filters, for the results header. */
export function describeFilters(parsed: ParsedSearch): string[] {
  const parts: string[] = [];
  for (const username of parsed.from) parts.push(`from @${username}`);
  for (const kind of parsed.has) parts.push(`with ${kind === "link" ? "a link" : `${kind}s`}`);
  if (parsed.after) parts.push(`after ${parsed.after.slice(0, 10)}`);
  if (parsed.before) parts.push(`before ${parsed.before.slice(0, 10)}`);
  for (const word of parsed.exclude) parts.push(`without "${word}"`);
  return parts;
}
