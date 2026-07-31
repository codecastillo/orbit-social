import { StyleSheet, View } from "react-native";
import { colors, radii, spacing } from "@/lib/theme";

function SkeletonRow() {
  return (
    <View style={styles.row}>
      <View style={styles.avatar} />
      <View style={styles.body}>
        <View style={[styles.line, { width: "45%" }]} />
        <View style={[styles.line, { width: "90%" }]} />
        <View style={[styles.line, { width: "70%" }]} />
        <View style={styles.actionRow}>
          <View style={styles.actionStub} />
          <View style={styles.actionStub} />
          <View style={styles.actionStub} />
        </View>
      </View>
    </View>
  );
}

export function PostListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing(2.5),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
  },
  body: {
    flex: 1,
    gap: spacing(2),
    paddingTop: 2,
  },
  line: {
    height: 12,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceElevated,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing(7),
    marginTop: spacing(1),
  },
  actionStub: {
    width: 32,
    height: 10,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceElevated,
  },
});
