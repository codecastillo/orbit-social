import Link from "next/link";

// Mentions need at least two word characters; hashtags accept any letter
// script so non-latin tags highlight too. Bare URLs become external links.
const TOKEN_REGEX = /@[a-zA-Z0-9_]{2,}|#[\p{L}0-9_]+|https?:\/\/[^\s]+/gu;
// A token glued to a preceding word character is not a token (emails,
// mid-word # in URLs), matching how the server-side mention parser scopes.
const GLUED_TO_WORD = /[\p{L}0-9_@#]/u;
// Sentence punctuation after a URL belongs to the prose, not the link.
const TRAILING_PUNCTUATION = /[.,;:!?)\]}'"]+$/;

type Segment =
  | { kind: "plain"; text: string }
  | { kind: "mention"; text: string; username: string }
  | { kind: "hashtag"; text: string; tag: string }
  | { kind: "url"; text: string; href: string };

function segment(content: string): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;
  for (const match of content.matchAll(TOKEN_REGEX)) {
    const start = match.index;
    if (start > 0 && GLUED_TO_WORD.test(content[start - 1])) continue;
    if (start > cursor) segments.push({ kind: "plain", text: content.slice(cursor, start) });
    let text = match[0];
    if (text.startsWith("@")) {
      segments.push({ kind: "mention", text, username: text.slice(1) });
    } else if (text.startsWith("#")) {
      segments.push({ kind: "hashtag", text, tag: text.slice(1) });
    } else {
      text = text.replace(TRAILING_PUNCTUATION, "");
      segments.push({ kind: "url", text, href: text });
    }
    cursor = start + text.length;
  }
  if (cursor < content.length) segments.push({ kind: "plain", text: content.slice(cursor) });
  return segments;
}

/**
 * Non-post text (bios, about sections) with live @mentions, #hashtags and
 * bare URLs. Mentions open the profile, hashtags the hashtag page, URLs a
 * new tab. Drop-in for a plain <p>: pass the same className the <p> carried.
 * Post bodies keep their own renderer (PostContent in post-card).
 */
export function RichText({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <p className={className}>
      {segment(children).map((seg, index) => {
        if (seg.kind === "plain") {
          return <span key={index}>{seg.text}</span>;
        }
        if (seg.kind === "url") {
          return (
            <a
              key={index}
              href={seg.href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary no-underline hover:underline break-all"
            >
              {seg.text}
            </a>
          );
        }
        const href =
          seg.kind === "mention"
            ? `/${seg.username}`
            : `/hashtag/${encodeURIComponent(seg.tag)}`;
        return (
          <Link
            key={index}
            href={href}
            className="font-semibold text-primary no-underline hover:underline"
          >
            {seg.text}
          </Link>
        );
      })}
    </p>
  );
}
