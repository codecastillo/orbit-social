import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, Button, EmptyState } from "@/components/ui";
import {
  approveCommunityRequest,
  getCommunityJoinRequests,
  rejectCommunityRequest,
  type CommunityJoinRequest,
} from "@/lib/queries/communities";
import { formatTimeAgo } from "@/lib/format";
import { colors, spacing } from "@/lib/theme";

export default function CommunityJoinRequestsScreen() {
  const { communityId } = useLocalSearchParams<{ communityId: string }>();
  const queryClient = useQueryClient();

  const requestsKey = ["community-join-requests", communityId];
  const requestsQuery = useQuery({
    queryKey: requestsKey,
    queryFn: () => getCommunityJoinRequests(communityId),
    enabled: !!communityId,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: requestsKey });
    // Approvals change the roster and member count too.
    queryClient.invalidateQueries({ queryKey: ["community-members", communityId] });
  };

  const approve = useMutation({
    mutationFn: (request: CommunityJoinRequest) =>
      approveCommunityRequest(request.id),
    onSuccess: refresh,
    onError: () => Alert.alert("Couldn't approve this request"),
  });

  const reject = useMutation({
    mutationFn: (request: CommunityJoinRequest) =>
      rejectCommunityRequest(request.id),
    onSuccess: refresh,
    onError: () => Alert.alert("Couldn't deny this request"),
  });

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: "Join requests" }} />
      <FlatList
        data={requestsQuery.data ?? []}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => {
          const busy =
            (approve.isPending && approve.variables?.id === item.id) ||
            (reject.isPending && reject.variables?.id === item.id);
          return (
            <View style={styles.row}>
              <Avatar
                url={item.profiles.avatar_url}
                name={item.profiles.display_name || item.profiles.username}
                size={40}
              />
              <View style={styles.rowBody}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.profiles.display_name || item.profiles.username}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  @{item.profiles.username} · {formatTimeAgo(item.created_at)}
                </Text>
              </View>
              <Button
                label="Deny"
                variant="outline"
                disabled={busy}
                onPress={() => reject.mutate(item)}
                style={styles.actionButton}
              />
              <Button
                label="Approve"
                disabled={busy}
                onPress={() => approve.mutate(item)}
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
              description="New join requests for this room show up here."
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
