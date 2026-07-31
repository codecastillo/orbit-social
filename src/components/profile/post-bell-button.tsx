"use client";

import { Bell, BellRing } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  checkPostNotificationSubscription,
  subscribeToCreatorPosts,
  unsubscribeFromCreatorPosts,
} from "@/lib/queries/social";

/**
 * Per-creator new-post bell, shown next to Follow once you already follow
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
      toast.error("Couldn't update post notifications");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: bellKey });
    },
  });

  if (!user || user.id === creatorId) return null;

  return (
    <button
      aria-label={subscribed ? "Turn off post notifications" : "Turn on post notifications"}
      aria-pressed={subscribed}
      onClick={() => toggleBell.mutate(!subscribed)}
      className={cn(
        "inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border transition-colors",
        subscribed
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-surface text-foreground hover:bg-muted"
      )}
    >
      {subscribed ? (
        <BellRing className="h-4 w-4" />
      ) : (
        <Bell className="h-4 w-4" />
      )}
    </button>
  );
}
