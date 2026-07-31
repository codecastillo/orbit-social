import { StyleSheet, View } from "react-native";
import { colors, radii, spacing } from "@/lib/theme";

const STORY_CIRCLE = 64;
const STORY_STUB_COUNT = 6;

function SkeletonCard({ withMedia }: { withMedia: boolean }) {
  return (
    <View style={styles.card}>
      <View style={styles.authorRow}>
        <View style={styles.avatar} />
        <View style={styles.authorLines}>
          <View style={[styles.line, { width: "40%" }]} />
          <View style={[styles.line, { width: "25%", height: 10 }]} />
        </View>
      </View>
      <View style={[styles.line, { width: "92%" }]} />
      <View style={[styles.line, { width: "70%" }]} />
      {withMedia ? <View style={styles.mediaBlock} /> : null}
      <View style={styles.actionRow}>
        <View style={styles.actionStub} />
        <View style={styles.actionStub} />
        <View style={styles.actionStub} />
      </View>
    </View>
  );
}

export function PostListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }, (_, i) => (
        // Alternate media blocks so the placeholder rhythm matches a real
        // feed instead of a uniform wall.
        <SkeletonCard key={i} withMedia={i % 2 === 0} />
      ))}
    </View>
  );
}

/** Placeholder for the stories strip: a row of ring-sized circles. */
export function StoriesSkeleton() {
  return (
    <View style={styles.storiesRow}>
      {Array.from({ length: STORY_STUB_COUNT }, (_, i) => (
        <View key={i} style={styles.storyItem}>
          <View style={styles.storyCircle} />
          <View style={styles.storyName} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    gap: spacing(2),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2.5),
    marginBottom: spacing(1),
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
  },
  authorLines: {
    flex: 1,
    gap: spacing(1.5),
  },
  line: {
    height: 12,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceElevated,
  },
  mediaBlock: {
    height: 220,
    marginHorizontal: -spacing(4),
    backgroundColor: colors.surfaceElevated,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing(5),
    marginTop: spacing(1),
  },
  actionStub: {
    width: 36,
    height: 12,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceElevated,
  },
  storiesRow: {
    flexDirection: "row",
    gap: spacing(3.5),
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    overflow: "hidden",
  },
  storyItem: {
    alignItems: "center",
    gap: spacing(1.5),
  },
  storyCircle: {
    width: STORY_CIRCLE + 10,
    height: STORY_CIRCLE + 10,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceElevated,
  },
  storyName: {
    width: 44,
    height: 8,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceElevated,
  },
});
