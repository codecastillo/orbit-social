import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";
import { useRouter, type Href } from "expo-router";
import { colors } from "@/lib/theme";

// Mentions need at least two word characters; hashtags accept any letter
// script so non-latin tags highlight too.
const TOKEN_REGEX = /@[a-zA-Z0-9_]{2,}|#[\p{L}0-9_]+/gu;
// A token glued to a preceding word character is not a token (emails,
// mid-word # in URLs), matching how the server-side mention parser scopes.
const GLUED_TO_WORD = /[\p{L}0-9_@#]/u;

type Segment =
  | { kind: "plain"; text: string }
  | { kind: "mention"; text: string; username: string }
  | { kind: "hashtag"; text: string; tag: string };

function segment(content: string): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;
  for (const match of content.matchAll(TOKEN_REGEX)) {
    const start = match.index;
    if (start > 0 && GLUED_TO_WORD.test(content[start - 1])) continue;
    if (start > cursor) segments.push({ kind: "plain", text: content.slice(cursor, start) });
    const text = match[0];
    if (text.startsWith("@")) {
      segments.push({ kind: "mention", text, username: text.slice(1) });
    } else {
      segments.push({ kind: "hashtag", text, tag: text.slice(1) });
    }
    cursor = start + text.length;
  }
  if (cursor < content.length) segments.push({ kind: "plain", text: content.slice(cursor) });
  return segments;
}

/**
 * Post body text with tappable @mentions and #hashtags. Mentions open the
 * author's profile; hashtags land on the Discover tab with the tag seeded
 * into its search box via the `q` param. Drop-in for a plain Text: pass the
 * same style and numberOfLines the Text carried.
 */
export function RichText({
  children,
  style,
  numberOfLines,
}: {
  children: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const router = useRouter();

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {segment(children).map((seg, index) => {
        if (seg.kind === "plain") {
          return <Text key={index}>{seg.text}</Text>;
        }
        const onPress =
          seg.kind === "mention"
            ? () => router.push(`/user/${seg.username}`)
            : () =>
                router.push({
                  pathname: "/(tabs)/discover",
                  params: { q: seg.text },
                } as Href);
        return (
          <Text key={index} style={styles.token} onPress={onPress} suppressHighlighting>
            {seg.text}
          </Text>
        );
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  token: {
    color: colors.primary,
    fontWeight: "600",
  },
});
