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
import { getLiveStreams, type LiveStreamWithProfile } from "@/lib/queries/live";
import { formatNumber } from "@/lib/format";
import { colors, radii, spacing } from "@/lib/theme";

export default function LiveScreen() {
  const router = useRouter();
  const {
    data: streams,
    isPending,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["live-streams"],
    queryFn: getLiveStreams,
    refetchInterval: 30_000,
  });

  return (
    <>
      <Stack.Screen options={{ title: "Live" }} />
      {isPending ? (
        <Centered>
          <ActivityIndicator color={colors.primary} />
        </Centered>
      ) : isError ? (
        <EmptyState
          title="Live did not load"
          description="Check your connection and try again."
          action={<Button label="Retry" variant="outline" onPress={() => refetch()} />}
        />
      ) : (
        <FlatList
          data={streams}
          keyExtractor={(s) => s.id}
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
              title="Nobody is live right now"
              description="Streams from people you follow show up here the moment they go on air."
            />
          }
          renderItem={({ item }) => (
            <StreamRow
              stream={item}
              onPress={() => router.push(`/live/${item.id}` as never)}
            />
          )}
        />
      )}
    </>
  );
}

function StreamRow({
  stream,
  onPress,
}: {
  stream: LiveStreamWithProfile;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
    >
      <Avatar
        url={stream.profiles.avatar_url}
        name={stream.profiles.display_name}
        size={48}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.title} numberOfLines={1}>
          {stream.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {stream.profiles.display_name}
          {stream.category ? `  ·  ${stream.category}` : ""}
        </Text>
      </View>
      <View style={styles.right}>
        <View style={styles.liveBadge}>
          <Text style={styles.liveBadgeText}>LIVE</Text>
        </View>
        <View style={styles.viewers}>
          <Ionicons name="eye-outline" size={12} color={colors.mutedForeground} />
          <Text style={styles.viewersText}>{formatNumber(stream.viewer_count)}</Text>
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
  liveBadge: {
    backgroundColor: colors.destructive,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  liveBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
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
});
