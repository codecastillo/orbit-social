import { useRouter, Stack } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Avatar, Button, Centered, EmptyState } from "@/components/ui";
import { getRecentVods, type VodWithProfile } from "@/lib/queries/vods";
import { formatNumber, formatTimeAgo } from "@/lib/format";
import { colors, radii, spacing } from "@/lib/theme";

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}:${(m % 60).toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function PastStreamsScreen() {
  const router = useRouter();
  const {
    data: vods,
    isPending,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["live-vods"],
    queryFn: () => getRecentVods(),
  });

  return (
    <>
      <Stack.Screen options={{ title: "Past streams" }} />
      {isPending ? (
        <Centered>
          <ActivityIndicator color={colors.primary} />
        </Centered>
      ) : isError ? (
        <EmptyState
          title="Past streams did not load"
          description="Check your connection and try again."
          action={<Button label="Retry" variant="outline" onPress={() => refetch()} />}
        />
      ) : (
        <FlatList
          data={vods}
          keyExtractor={(v) => v.id}
          style={{ backgroundColor: colors.background }}
          contentContainerStyle={{ padding: spacing(4), gap: spacing(3) }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title="No past streams yet"
              description="Recordings show up here after a broadcast ends."
            />
          }
          renderItem={({ item }) => (
            <VodRowItem
              vod={item}
              onPress={() => router.push(`/vod/${item.id}` as never)}
            />
          )}
        />
      )}
    </>
  );
}

function VodRowItem({
  vod,
  onPress,
}: {
  vod: VodWithProfile;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
    >
      <Avatar
        url={vod.profile?.avatar_url ?? null}
        name={vod.profile?.display_name ?? "?"}
        size={48}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.title} numberOfLines={1}>
          {vod.title || "Past stream"}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {vod.profile?.display_name ?? "Unknown"}
          {"  ·  "}
          {formatTimeAgo(vod.created_at)}
        </Text>
      </View>
      <View style={styles.right}>
        {vod.duration_seconds ? (
          <Text style={styles.durationText}>
            {formatDuration(vod.duration_seconds)}
          </Text>
        ) : null}
        <View style={styles.viewers}>
          <Ionicons name="eye-outline" size={12} color={colors.mutedForeground} />
          <Text style={styles.viewersText}>{formatNumber(vod.view_count)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing(3.5),
  },
  title: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  meta: {
    color: colors.mutedForeground,
    fontSize: 13,
    marginTop: 2,
  },
  right: {
    alignItems: "flex-end",
    gap: 4,
  },
  viewers: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  viewersText: {
    color: colors.mutedForeground,
    fontSize: 12,
  },
  durationText: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
});
