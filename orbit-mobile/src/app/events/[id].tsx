import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { Avatar, Button, Centered, EmptyState } from "@/components/ui";
import {
  getEventAttendees,
  getEventById,
  getUserRsvpStatus,
  removeRsvp,
  rsvpEvent,
  type RsvpStatus,
} from "@/lib/queries/events";
import { formatNumber } from "@/lib/format";
import { colors, radii, spacing } from "@/lib/theme";

const MAX_ATTENDEE_AVATARS = 6;

function formatEventTime(startAt: string): string {
  const date = new Date(startAt);
  const day = date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${day} at ${time}`;
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const eventQuery = useQuery({
    queryKey: ["event", id],
    queryFn: () => getEventById(id),
    enabled: !!id,
  });
  const event = eventQuery.data;

  const attendeesQuery = useQuery({
    queryKey: ["event-attendees", id],
    queryFn: () => getEventAttendees(id),
    enabled: !!id,
  });

  const rsvpKey = ["event-rsvp", id, user?.id];
  const rsvpQuery = useQuery({
    queryKey: rsvpKey,
    queryFn: () => getUserRsvpStatus(id, user!.id),
    enabled: !!id && !!user,
  });
  const rsvpStatus = rsvpQuery.data ?? null;

  // Mirrors the web: tapping the active status removes the RSVP, anything
  // else upserts it. The DB trigger recomputes attendee_count.
  const rsvp = useMutation({
    mutationFn: (status: RsvpStatus) =>
      rsvpStatus === status
        ? removeRsvp(id, user!.id)
        : rsvpEvent(id, user!.id, status),
    onSuccess: (_data, status) => {
      queryClient.setQueryData(rsvpKey, rsvpStatus === status ? null : status);
      queryClient.invalidateQueries({ queryKey: ["event", id] });
      queryClient.invalidateQueries({ queryKey: ["event-attendees", id] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  if (eventQuery.isPending) {
    return (
      <>
        <Stack.Screen options={{ title: "Event" }} />
        <Centered>
          <ActivityIndicator color={colors.primary} />
        </Centered>
      </>
    );
  }

  if (eventQuery.isError || !event) {
    return (
      <>
        <Stack.Screen options={{ title: "Event" }} />
        <EmptyState
          title="Could not load this event"
          description="It may have been removed, or your connection dropped."
          action={
            <Button
              label="Retry"
              variant="outline"
              onPress={() => eventQuery.refetch()}
            />
          }
        />
      </>
    );
  }

  const goingAttendees = (attendeesQuery.data ?? []).filter(
    (attendee) => attendee.status === "going",
  );

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: event.title }} />
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={eventQuery.isRefetching || attendeesQuery.isRefetching}
            onRefresh={() => {
              eventQuery.refetch();
              attendeesQuery.refetch();
              rsvpQuery.refetch();
            }}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {event.cover_url ? (
          <Image
            source={{ uri: event.cover_url }}
            alt=""
            style={styles.cover}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View style={[styles.cover, styles.coverFallback]} />
        )}

        <View style={styles.body}>
          <Text style={styles.time}>{formatEventTime(event.start_at)}</Text>
          <Text style={styles.title}>{event.title}</Text>
          <Text style={styles.location}>
            {event.is_online ? "Online event" : (event.location ?? "Location TBA")}
          </Text>

          <View style={styles.hostRow}>
            <Avatar
              url={event.profiles.avatar_url}
              name={event.profiles.display_name}
              size={36}
            />
            <View style={styles.hostInfo}>
              <Text style={styles.hostLabel}>Hosted by</Text>
              <Text style={styles.hostName}>{event.profiles.display_name}</Text>
            </View>
          </View>

          {event.description ? (
            <Text style={styles.description}>{event.description}</Text>
          ) : null}

          {user ? (
            <View style={styles.rsvpRow}>
              <View style={styles.rsvpButton}>
                <Button
                  label="Going"
                  variant={rsvpStatus === "going" ? "primary" : "outline"}
                  disabled={rsvp.isPending || rsvpQuery.isPending}
                  onPress={() => rsvp.mutate("going")}
                  style={[
                    styles.pairButton,
                    rsvpStatus !== "going" && styles.pairButtonSecondary,
                  ]}
                />
              </View>
              <View style={styles.rsvpButton}>
                <Button
                  label="Not going"
                  variant={rsvpStatus === "not_going" ? "primary" : "outline"}
                  disabled={rsvp.isPending || rsvpQuery.isPending}
                  onPress={() => rsvp.mutate("not_going")}
                  style={[
                    styles.pairButton,
                    rsvpStatus !== "not_going" && styles.pairButtonSecondary,
                  ]}
                />
              </View>
            </View>
          ) : null}

          <View style={styles.attendeesCard}>
            <Text style={styles.attendeesTitle}>
              {formatNumber(event.attendee_count)} going
            </Text>
            {attendeesQuery.isPending ? (
              <ActivityIndicator color={colors.primary} />
            ) : goingAttendees.length > 0 ? (
              <View style={styles.attendeesRow}>
                {goingAttendees.slice(0, MAX_ATTENDEE_AVATARS).map((attendee) => (
                  <View key={attendee.user_id} style={styles.attendeeAvatar}>
                    <Avatar
                      url={attendee.profiles.avatar_url}
                      name={attendee.profiles.display_name}
                      size={36}
                    />
                  </View>
                ))}
                {goingAttendees.length > MAX_ATTENDEE_AVATARS ? (
                  <Text style={styles.attendeesMore}>
                    +{goingAttendees.length - MAX_ATTENDEE_AVATARS}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text style={styles.attendeesEmpty}>No RSVPs yet.</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: spacing(10),
  },
  cover: {
    width: "100%",
    aspectRatio: 16 / 9,
  },
  coverFallback: {
    backgroundColor: colors.surfaceElevated,
  },
  body: {
    padding: spacing(4),
  },
  time: {
    color: colors.primary,
    fontSize: 12.5,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  title: {
    color: colors.foreground,
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.4,
    marginTop: 4,
  },
  location: {
    color: colors.mutedForeground,
    fontSize: 13.5,
    marginTop: 6,
  },
  hostRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing(4),
  },
  hostInfo: {
    marginLeft: spacing(2.5),
  },
  hostLabel: {
    color: colors.textFaint,
    fontSize: 11.5,
  },
  hostName: {
    color: colors.foreground,
    fontSize: 13.5,
    fontWeight: "600",
  },
  description: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing(4),
  },
  rsvpRow: {
    flexDirection: "row",
    gap: spacing(3),
    marginTop: spacing(5),
  },
  rsvpButton: {
    flex: 1,
  },
  pairButton: {
    minHeight: 36,
    borderRadius: 10,
  },
  pairButtonSecondary: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 0,
  },
  attendeesCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing(3.5),
    marginTop: spacing(5),
  },
  attendeesTitle: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.2,
    marginBottom: spacing(3),
  },
  attendeesRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  attendeeAvatar: {
    marginRight: -spacing(2),
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  attendeesMore: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    fontWeight: "600",
    marginLeft: spacing(4),
  },
  attendeesEmpty: {
    color: colors.mutedForeground,
    fontSize: 13,
  },
});
