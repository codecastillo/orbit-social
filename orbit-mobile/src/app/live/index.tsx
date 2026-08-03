import { useEffect, useState } from "react";
import { useRouter, Stack } from "expo-router";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Avatar, Button, Centered, EmptyState } from "@/components/ui";
import { useAuth } from "@/providers/auth-provider";
import { getLiveStreams, type LiveStreamWithProfile } from "@/lib/queries/live";
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

export default function LiveScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [goLiveOpen, setGoLiveOpen] = useState(false);
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

  const { data: vods } = useQuery({
    queryKey: ["live-vods"],
    queryFn: () => getRecentVods(),
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
          ListHeaderComponent={
            user ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go live"
                onPress={() => setGoLiveOpen(true)}
                style={({ pressed }) => [styles.goLiveRow, pressed && { opacity: 0.85 }]}
              >
                <View style={styles.goLiveIcon}>
                  <Ionicons name="radio-outline" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.goLiveTitle}>Go live</Text>
                  <Text style={styles.goLiveMeta}>
                    Stream with OBS or from the web
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.mutedForeground}
                />
              </Pressable>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              title="Nobody is live right now"
              description="Streams from people you follow show up here the moment they go on air."
            />
          }
          ListFooterComponent={
            vods && vods.length > 0 ? (
              <View style={styles.pastSection}>
                <Text style={styles.pastHeading}>Past streams</Text>
                {vods.map((vod) => (
                  <VodRowItem
                    key={vod.id}
                    vod={vod}
                    onPress={() => router.push(`/vod/${vod.id}` as never)}
                  />
                ))}
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <StreamRow
              stream={item}
              onPress={() => router.push(`/live/${item.id}` as never)}
            />
          )}
        />
      )}
      <GoLiveSheet
        visible={goLiveOpen}
        onClose={() => setGoLiveOpen(false)}
        onOpenSettings={() => {
          setGoLiveOpen(false);
          router.push("/settings/streaming" as never);
        }}
      />
    </>
  );
}

// Info-only for now: Expo Go has no native RTMP broadcasting, so this
// points streamers at OBS or the web and at their stream key.
function GoLiveSheet({
  visible,
  onClose,
  onOpenSettings,
}: {
  visible: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [fade] = useState(() => new Animated.Value(0));
  const [slide] = useState(() => new Animated.Value(height));

  // Same backdrop-fade plus RAF-kicked slide as ReportSheet.
  useEffect(() => {
    if (!visible) {
      fade.setValue(0);
      slide.setValue(height);
      return;
    }
    slide.setValue(height);
    const raf = requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(slide, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });
    return () => cancelAnimationFrame(raf);
  }, [visible, height, fade, slide]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Pressable
          style={{ flex: 1 }}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close go live"
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheetPanel,
          {
            paddingBottom: insets.bottom + spacing(4),
            transform: [{ translateY: slide }],
          },
        ]}
      >
        <View style={styles.sheetHandleWrap}>
          <View style={styles.sheetHandle} />
        </View>

        <Text style={styles.sheetTitle}>Go live</Text>
        <Text style={styles.sheetBody}>
          Broadcasting from the phone isn&apos;t supported yet. Go live with OBS
          or any RTMP app using your stream key, or start the stream from the
          web. Your broadcast shows up here for everyone the moment it starts.
        </Text>

        <View style={styles.sheetActions}>
          <Button label="View stream key" onPress={onOpenSettings} />
          <Button label="Close" variant="outline" onPress={onClose} />
        </View>
      </Animated.View>
    </Modal>
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
  durationText: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  goLiveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing(3.5),
    marginBottom: spacing(1),
  },
  goLiveIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  goLiveTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  goLiveMeta: {
    color: colors.mutedForeground,
    fontSize: 13,
    marginTop: 2,
  },
  pastSection: {
    gap: spacing(3),
    marginTop: spacing(3),
  },
  pastHeading: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  sheetPanel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing(4),
    paddingTop: spacing(2),
  },
  sheetHandleWrap: {
    alignItems: "center",
    paddingBottom: spacing(2),
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  sheetTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "600",
  },
  sheetBody: {
    color: colors.mutedForeground,
    fontSize: 13,
    lineHeight: 19,
    paddingTop: spacing(2),
  },
  sheetActions: {
    gap: spacing(2),
    paddingTop: spacing(4),
  },
});
