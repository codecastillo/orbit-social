import { Pressable, StyleSheet, Text, View } from "react-native";
import { reactionGlyph, type ReactionCount, type ReactionType } from "@/lib/queries/reactions";
import { formatNumber } from "@/lib/format";
import { colors, radii } from "@/lib/theme";

// Token-derived tints: primary at ~15% fill and ~30% border, matching the
// web ReactionCountsDisplay treatment for the viewer's own reaction.
const OWN_REACTION_BG = `${colors.primary}26`;
const OWN_REACTION_BORDER = `${colors.primary}4d`;
// With free-emoji reactions a popular post can carry dozens of distinct
// glyphs; show the leaders and fold the rest into one "+N" pill.
const MAX_VISIBLE_PILLS = 3;

interface ReactionCountsProps {
  reactions: ReactionCount[];
  userReaction: ReactionType | null;
  onPressReaction: (type: ReactionType) => void;
}

/**
 * Pill row of reaction tallies under a post, sorted by count. Tapping a
 * pill applies (or removes) that reaction, same as the web display.
 */
export function ReactionCounts({ reactions, userReaction, onPressReaction }: ReactionCountsProps) {
  const visible = reactions.filter((r) => r.count > 0);
  if (visible.length === 0) return null;

  const sorted = [...visible].sort((a, b) => b.count - a.count);
  // The viewer's own reaction always stays visible, even from the overflow.
  const top = sorted.slice(0, MAX_VISIBLE_PILLS);
  const overflow = sorted.slice(MAX_VISIBLE_PILLS);
  const ownOverflow = overflow.find((r) => r.reaction_type === userReaction);
  if (ownOverflow) top.push(ownOverflow);
  const hiddenCount = overflow.length - (ownOverflow ? 1 : 0);

  return (
    <View style={styles.row}>
      {top.map(({ reaction_type, count }) => {
        const isOwn = userReaction === reaction_type;
        return (
          <Pressable
            key={reaction_type}
            accessibilityRole="button"
            accessibilityLabel={`${reaction_type} reactions: ${count}`}
            onPress={() => onPressReaction(reaction_type)}
            style={({ pressed }) => [
              styles.pill,
              isOwn && styles.pillOwn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.glyph}>{reactionGlyph(reaction_type)}</Text>
            <Text style={[styles.count, isOwn && styles.countOwn]}>{formatNumber(count)}</Text>
          </Pressable>
        );
      })}
      {hiddenCount > 0 ? (
        <View style={styles.pill}>
          <Text style={styles.count}>+{hiddenCount}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillOwn: {
    backgroundColor: OWN_REACTION_BG,
    borderColor: OWN_REACTION_BORDER,
  },
  glyph: {
    fontSize: 12,
  },
  count: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  countOwn: {
    color: colors.primary,
  },
});
