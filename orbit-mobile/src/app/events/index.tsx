import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { Button, Centered, EmptyState } from "@/components/ui";
import { getEvents, type EventWithCreator } from "@/lib/queries/events";
import { formatNumber } from "@/lib/format";
import { colors, radii, spacing } from "@/lib/theme";

function formatEventTime(startAt: string): string {
  const date = new Date(startAt);
  const day = date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${day} at ${time}`;
}

function EventCard({
  event,
  onPress,
}: {
  event: EventWithCreator;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      {event.cover_url ? (
        <Image
          source={{ uri: event.cover_url }}
          alt=""
          style={styles.cardCover}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <View style={[styles.cardCover, styles.cardCoverFallback]} />
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardTime}>{formatEventTime(event.start_at)}</Text>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {event.is_online ? "Online" : (event.location ?? "Location TBA")}
          {"  ·  "}
          {formatNumber(event.attendee_count)} going
        </Text>
      </View>
    </Pressable>
  );
}

export default function EventsScreen() {
  const router = useRouter();

  const eventsQuery = useQuery({
    queryKey: ["events"],
    queryFn: () => getEvents(),
  });

  if (eventsQuery.isPending) {
    return (
      <>
        <Stack.Screen options={{ title: "Events" }} />
        <Centered>
          <ActivityIndicator color={colors.primary} />
        </Centered>
      </>
    );
  }

  if (eventsQuery.isError) {
    return (
      <>
        <Stack.Screen options={{ title: "Events" }} />
        <EmptyState
          title="Could not load events"
          description="Check your connection and try again."
          action={
            <Button
              label="Retry"
              variant="outline"
              onPress={() => eventsQuery.refetch()}
            />
          }
        />
      </>
    );
  }

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: "Events" }} />
      <FlatList
        data={eventsQuery.data}
        keyExtractor={(event) => event.id}
        refreshControl={
          <RefreshControl
            refreshing={eventsQuery.isRefetching}
            onRefresh={() => eventsQuery.refetch()}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => (
          <EventCard event={item} onPress={() => router.push(`/events/${item.id}`)} />
        )}
        ListEmptyComponent={
          <EmptyState
            title="No upcoming events"
            description="Events created on Orbit will show up here."
          />
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    padding: spacing(4),
    paddingBottom: spacing(10),
    flexGrow: 1,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    overflow: "hidden",
    marginBottom: spacing(3),
  },
  cardCover: {
    width: "100%",
    aspectRatio: 16 / 9,
  },
  cardCoverFallback: {
    backgroundColor: colors.surfaceElevated,
  },
  cardBody: {
    padding: spacing(3.5),
  },
  cardTime: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  cardTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginTop: 4,
  },
  cardMeta: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    marginTop: 6,
  },
});
