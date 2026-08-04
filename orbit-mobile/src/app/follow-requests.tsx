import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, Button, EmptyState } from "@/components/ui";
import {
  approveFollowRequest,
  cancelFollowRequest,
  getIncomingFollowRequests,
} from "@/lib/queries/profiles";
import { formatTimeAgo } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import { colors, spacing } from "@/lib/theme";

export default function FollowRequestsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const requestsKey = ["follow-requests", user?.id];
  const requestsQuery = useQuery({
    queryKey: requestsKey,
    queryFn: () => getIncomingFollowRequests(user!.id),
    enabled: !!user,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: requestsKey });
    // Approving adds a follower and clears the notification that led here.
    queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
  };

  const approve = useMutation({
    mutationFn: (requesterId: string) => approveFollowRequest(requesterId),
    onSuccess: refresh,
    onError: () => Alert.alert("Couldn't approve this request"),
  });

  const deny = useMutation({
    mutationFn: (requesterId: string) =>
      cancelFollowRequest(requesterId, user!.id),
    onSuccess: refresh,
    onError: () => Alert.alert("Couldn't remove this request"),
  });

  if (!user) return null;

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: "Follow requests" }} />
      <FlatList
        data={requestsQuery.data ?? []}
        keyExtractor={(request) => request.requester.id}
        renderItem={({ item }) => {
          const { requester } = item;
          const busy =
            (approve.isPending && approve.variables === requester.id) ||
            (deny.isPending && deny.variables === requester.id);
          return (
            <View style={styles.row}>
              <Pressable
                onPress={() => router.push(`/user/${requester.username}`)}
                style={styles.rowTap}
              >
                <Avatar
                  url={requester.avatar_url}
                  name={requester.display_name || requester.username}
                  size={40}
                />
                <View style={styles.rowBody}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {requester.display_name || requester.username}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    @{requester.username} · {formatTimeAgo(item.created_at)}
                  </Text>
                </View>
              </Pressable>
              <Button
                label="Deny"
                variant="outline"
                disabled={busy}
                onPress={() => deny.mutate(requester.id)}
                style={styles.actionButton}
              />
              <Button
                label="Approve"
                disabled={busy}
                onPress={() => approve.mutate(requester.id)}
                style={styles.actionButton}
              />
            </View>
          );
        }}
        ListEmptyComponent={
          requestsQuery.isPending ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : requestsQuery.isError ? (
            <EmptyState
              title="Could not load requests"
              action={
                <Button
                  label="Retry"
                  variant="outline"
                  onPress={() => requestsQuery.refetch()}
                />
              }
            />
          ) : (
            <EmptyState
              title="No pending requests"
              description="When someone asks to follow your private account, they show up here."
            />
          )
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
    paddingTop: spacing(2),
    paddingBottom: spacing(10),
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
  },
  rowTap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    minWidth: 0,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "600",
  },
  rowMeta: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    marginTop: 1,
  },
  actionButton: {
    minHeight: 32,
    borderRadius: 10,
    paddingHorizontal: spacing(3),
  },
  loading: {
    padding: spacing(8),
    alignItems: "center",
  },
});
