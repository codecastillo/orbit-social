import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "@/components/ui";
import { searchUsers, type ProfileSummary } from "@/lib/queries/search";
import { colors, radii, spacing } from "@/lib/theme";

const MENTION_DEBOUNCE_MS = 200;
const MAX_SUGGESTIONS = 4;

export interface MentionInputHandle {
  focus: () => void;
  /** Inserts "@" at the caret (space-separated from any preceding word) and focuses. */
  insertMentionTrigger: () => void;
}

interface MentionInputProps extends TextInputProps {
  value: string;
  onChangeText: (text: string) => void;
  /**
   * Where the suggestion panel opens relative to the input. Hosts know their
   * geometry: an input at the top of the screen opens below, a bar pinned to
   * the bottom opens above.
   */
  panelPlacement?: "above" | "below";
  containerStyle?: StyleProp<ViewStyle>;
}

// The @token the collapsed caret currently sits inside, or null. Mirrors the
// RichText boundary rule: an @ glued to a preceding word character (emails)
// is not a mention.
function activeMentionToken(
  text: string,
  caret: number,
): { start: number; query: string } | null {
  if (caret < 0 || caret > text.length) return null;
  const upto = text.slice(0, caret);
  const at = upto.lastIndexOf("@");
  if (at === -1) return null;
  if (at > 0 && /[A-Za-z0-9_@]/.test(upto[at - 1])) return null;
  const query = upto.slice(at + 1);
  if (!/^[A-Za-z0-9_]*$/.test(query)) return null;
  return { start: at, query };
}

/**
 * TextInput with inline @mention autocomplete. Tracks the caret through
 * onSelectionChange; while the caret is inside an @token it searches users
 * (debounced) and shows up to four suggestions. Picking one replaces the
 * token with the plain "@username " text the server-side mention trigger
 * parses. Pair with MentionButton for a toolbar "@" affordance.
 */
export const MentionInput = forwardRef<MentionInputHandle, MentionInputProps>(
  function MentionInput(
    { value, onChangeText, panelPlacement = "below", containerStyle, style, ...rest },
    ref,
  ) {
    const inputRef = useRef<TextInput>(null);
    // -1 while the selection is a range; token lookup only applies to a
    // collapsed caret.
    const [caret, setCaret] = useState(-1);
    const [suggestions, setSuggestions] = useState<ProfileSummary[]>([]);
    const requestIdRef = useRef(0);

    const token = useMemo(() => activeMentionToken(value, caret), [value, caret]);
    const query = token?.query ?? "";
    const active = token !== null && query.length > 0;

    // Drop stale rows the moment the caret leaves the token; render-time
    // adjustment (the post-card reseed pattern) instead of a cascading effect.
    if (!active && suggestions.length > 0) setSuggestions([]);

    useEffect(() => {
      if (!active) return;
      const requestId = ++requestIdRef.current;
      const timer = setTimeout(() => {
        searchUsers(query, MAX_SUGGESTIONS)
          .then((profiles) => {
            if (requestIdRef.current === requestId) setSuggestions(profiles);
          })
          .catch(() => {
            if (requestIdRef.current === requestId) setSuggestions([]);
          });
      }, MENTION_DEBOUNCE_MS);
      return () => {
        clearTimeout(timer);
        // Invalidate any in-flight search so a slow response for an old
        // query cannot repopulate the panel.
        requestIdRef.current += 1;
      };
    }, [active, query]);

    const applySuggestion = (username: string) => {
      if (!token) return;
      const before = value.slice(0, token.start);
      const inserted = `@${username} `;
      onChangeText(before + inserted + value.slice(caret));
      // onSelectionChange will confirm, but seed the expected caret so the
      // panel closes immediately instead of flashing a stale query.
      setCaret(before.length + inserted.length);
      inputRef.current?.focus();
    };

    const insertMentionTrigger = () => {
      const pos = caret >= 0 && caret <= value.length ? caret : value.length;
      const before = value.slice(0, pos);
      const inserted = before.length > 0 && !/\s$/.test(before) ? " @" : "@";
      onChangeText(before + inserted + value.slice(pos));
      setCaret(pos + inserted.length);
      inputRef.current?.focus();
    };

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      insertMentionTrigger,
    }));

    return (
      <View style={[styles.container, containerStyle]}>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          onSelectionChange={(event) => {
            const { start, end } = event.nativeEvent.selection;
            setCaret(start === end ? start : -1);
          }}
          style={style}
          {...rest}
        />
        {active && suggestions.length > 0 ? (
          <View
            style={[
              styles.panel,
              panelPlacement === "above" ? styles.panelAbove : styles.panelBelow,
            ]}
          >
            {suggestions.map((profile) => (
              <Pressable
                key={profile.id}
                accessibilityRole="button"
                accessibilityLabel={`Mention ${profile.display_name}`}
                onPress={() => applySuggestion(profile.username)}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { backgroundColor: colors.surface },
                ]}
              >
                <Avatar url={profile.avatar_url} name={profile.display_name} size={28} />
                <Text style={styles.rowName} numberOfLines={1}>
                  {profile.display_name}
                </Text>
                <Text style={styles.rowHandle} numberOfLines={1}>
                  @{profile.username}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    );
  },
);

/**
 * At-circle toolbar button that inserts "@" at the caret of its paired
 * MentionInput; wire onPress to the input handle's insertMentionTrigger.
 */
export function MentionButton({
  onPress,
  disabled = false,
}: {
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Mention someone"
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [pressed && { opacity: 0.7 }, disabled && { opacity: 0.4 }]}
    >
      <Ionicons name="at-circle-outline" size={24} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Elevated so the absolute panel overlays whatever renders after the input
  // (image previews in compose, for example).
  container: {
    position: "relative",
    zIndex: 10,
  },
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    overflow: "hidden",
    zIndex: 20,
    elevation: 6,
  },
  panelBelow: {
    top: "100%",
    marginTop: spacing(1),
  },
  panelAbove: {
    bottom: "100%",
    marginBottom: spacing(1),
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2.5),
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
  },
  rowName: {
    color: colors.foreground,
    fontSize: 13.5,
    fontWeight: "600",
    flexShrink: 1,
  },
  rowHandle: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    flexShrink: 1,
  },
});
