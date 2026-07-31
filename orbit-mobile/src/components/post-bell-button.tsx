import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  checkPostNotificationSubscription,
  subscribeToCreatorPosts,
  unsubscribeFromCreatorPosts,
} from "@/lib/queries/profiles";
import { useAuth } from "@/providers/auth-provider";
import { colors } from "@/lib/theme";

// Matches ProfileActionButton's height so the bell sits flush in the
// profile action row.
const BELL_SIZE = 36;
const BELL_RADIUS = 10;

/**
 * Per-creator new-post bell shown next to Follow once you already follow
 * someone. Toggles a post_notification_subscriptions row, optimistically.
 */
export function PostBellButton({ creatorId }: { creatorId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const bellKey = ["post-bell", user?.id, creatorId];

  const { data: subscribed = false } = useQuery({
    queryKey: bellKey,
    queryFn: () => checkPostNotificationSubscription(user!.id, creatorId),
    enabled: !!user,
  });

  const toggleBell = useMutation({
    mutationFn: (next: boolean) =>
      next
        ? subscribeToCreatorPosts(user!.id, creatorId)
        : unsubscribeFromCreatorPosts(user!.id, creatorId),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: bellKey });
      const previous = queryClient.getQueryData<boolean>(bellKey);
      queryClient.setQueryData(bellKey, next);
      return { previous };
    },
    onError: (_error, _next, context) => {
      queryClient.setQueryData(bellKey, context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: bellKey });
    },
  });

  if (!user || user.id === creatorId) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        subscribed ? "Turn off post notifications" : "Turn on post notifications"
      }
      accessibilityState={{ selected: subscribed }}
      onPress={() => toggleBell.mutate(!subscribed)}
      style={({ pressed }) => [
        styles.bell,
        subscribed && styles.bellActive,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Ionicons
        name={subscribed ? "notifications" : "notifications-outline"}
        size={17}
        color={subscribed ? colors.primary : colors.foreground}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bell: {
    width: BELL_SIZE,
    height: BELL_SIZE,
    borderRadius: BELL_RADIUS,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
  },
  bellActive: {
    backgroundColor: `${colors.primary}1A`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.primary}66`,
  },
});
