import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Button, EmptyState } from "@/components/ui";
import { getEvents, type EventWithCreator } from "@/lib/queries/events";
import { formatNumber } from "@/lib/format";
import { colors, spacing } from "@/lib/theme";

const SKELETON_ROWS = 6;

function EventRow({
  event,
  onPress,
}: {
  event: EventWithCreator;
  onPress: () => void;
}) {
  const start = new Date(event.start_at);
  const weekday = start.toLocaleDateString(undefined, { weekday: "short" });
  const day = start.toLocaleDateString(undefined, { day: "numeric" });
  const month = start.toLocaleDateString(undefined, { month: "short" });
  const time = start.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.dateBlock}>
        <Text style={styles.dateWeekday}>{weekday}</Text>
        <Text style={styles.dateDay}>{day}</Text>
        <Text style={styles.dateMonth}>{month}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {time}
          {"  ·  "}
          {event.is_online ? "Online" : (event.location ?? "Location TBA")}
        </Text>
        <Text style={styles.rowGoing}>
          <Text style={styles.rowGoingCount}>
            {formatNumber(event.attendee_count)}
          </Text>{" "}
          going
        </Text>
      </View>
    </Pressable>
  );
}

function EventsSkeleton() {
  return (
    <View>
      {Array.from({ length: SKELETON_ROWS }, (_, i) => (
        <View key={i} style={[styles.row, i > 0 && styles.separatorTop]}>
          <View style={styles.skeletonDate} />
          <View style={styles.rowBody}>
            <View style={[styles.skeletonBar, { width: "65%" }]} />
            <View style={[styles.skeletonBar, styles.skeletonBarThin]} />
          </View>
        </View>
      ))}
    </View>
  );
}

function CreateEventHeaderButton() {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Create an event"
      onPress={() => router.push("/events/create")}
      hitSlop={8}
      style={({ pressed }) => [pressed && { opacity: 0.7 }]}
    >
      <Ionicons name="add" size={26} color={colors.foreground} />
    </Pressable>
  );
}

const screenOptions = {
  title: "Events",
  headerRight: () => <CreateEventHeaderButton />,
};

export default function EventsScreen() {
  const router = useRouter();

  const eventsQuery = useQuery({
    queryKey: ["events"],
    queryFn: () => getEvents(),
  });

  if (eventsQuery.isPending) {
    return (
      <View style={styles.flex}>
        <Stack.Screen options={screenOptions} />
        <EventsSkeleton />
      </View>
    );
  }

  if (eventsQuery.isError) {
    return (
      <>
        <Stack.Screen options={screenOptions} />
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
      <Stack.Screen options={screenOptions} />
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
          <EventRow event={item} onPress={() => router.push(`/events/${item.id}`)} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
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
    paddingVertical: spacing(1),
    paddingBottom: spacing(10),
    flexGrow: 1,
  },
  row: {
    flexDirection: "row",
    gap: spacing(3.5),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
  },
  dateBlock: {
    width: 48,
    alignItems: "center",
  },
  dateWeekday: {
    color: colors.mutedForeground,
    fontSize: 10.5,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  dateDay: {
    color: colors.foreground,
    fontSize: 20,
    fontWeight: "700",
    marginTop: 1,
  },
  dateMonth: {
    color: colors.mutedForeground,
    fontSize: 12,
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  rowMeta: {
    color: colors.mutedForeground,
    fontSize: 13,
    marginTop: 3,
  },
  rowGoing: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    marginTop: 4,
  },
  rowGoingCount: {
    color: colors.foreground,
    fontWeight: "700",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing(4) + 48 + spacing(3.5),
  },
  separatorTop: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  skeletonDate: {
    width: 48,
    height: 52,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
  },
  skeletonBar: {
    height: 13,
    borderRadius: 6,
    backgroundColor: colors.surfaceElevated,
  },
  skeletonBarThin: {
    width: "45%",
    height: 10,
    marginTop: 8,
  },
});
