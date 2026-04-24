"use client";

import { use } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { PostCard } from "@/components/feed/post-card";
import { InlineComposer } from "@/components/feed/post-composer";
import { CommunityHeader } from "@/components/communities/community-header";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  getCommunityBySlug,
  getCommunityMembers,
  getCommunityPosts,
  checkMembership,
} from "@/lib/queries/communities";
import { checkUserInteractions, type PostWithAuthor } from "@/lib/queries/posts";

export default function CommunityDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: community,
    isLoading: loadingCommunity,
  } = useQuery({
    queryKey: ["community", slug],
    queryFn: () => getCommunityBySlug(slug),
  });

  const { data: members = [] } = useQuery({
    queryKey: ["community-members", community?.id],
    queryFn: () => getCommunityMembers(community!.id, 5),
    enabled: !!community,
  });

  const { data: userRole = null, refetch: refetchRole } = useQuery({
    queryKey: ["community-membership", community?.id, user?.id],
    queryFn: () => checkMembership(community!.id, user!.id),
    enabled: !!community && !!user,
  });

  const {
    data: posts,
    isLoading: loadingPosts,
    refetch: refetchPosts,
  } = useQuery({
    queryKey: ["community-posts", community?.id],
    queryFn: () => getCommunityPosts(community!.id),
    enabled: !!community,
  });

  const { data: interactions } = useQuery({
    queryKey: ["community-post-interactions", user?.id, posts?.map((p: PostWithAuthor) => p.id)],
    queryFn: () =>
      checkUserInteractions(
        user!.id,
        posts!.map((p: PostWithAuthor) => p.id)
      ),
    enabled: !!user && !!posts && posts.length > 0,
  });

  const handleMembershipChange = () => {
    refetchRole();
    queryClient.invalidateQueries({ queryKey: ["community", slug] });
    queryClient.invalidateQueries({ queryKey: ["community-members", community?.id] });
  };

  if (loadingCommunity) {
    return (
      <div className="border-x border-border min-h-screen">
        <Skeleton className="h-48 w-full" />
        <div className="p-4 space-y-3">
          <Skeleton className="h-24 w-24 rounded-full -mt-12" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="border-x border-border min-h-screen">
        <EmptyState
          title="Community not found"
          description="This community may have been removed or doesn't exist."
        />
      </div>
    );
  }

  const isMember = userRole !== null;

  return (
    <div className="border-x border-border min-h-screen">
      <CommunityHeader
        community={community}
        members={members}
        userRole={userRole}
        onMembershipChange={handleMembershipChange}
      />

      {/* Post composer for members */}
      {isMember && user && (
        <div className="border-b border-border p-4">
          <InlineComposer
            communityId={community.id}
            onSuccess={() => refetchPosts()}
          />
        </div>
      )}

      {/* Community feed */}
      <div>
        {loadingPosts ? (
          <div className="p-4 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="h-16 w-full" />
              </div>
            ))}
          </div>
        ) : posts && posts.length > 0 ? (
          posts.map((post: PostWithAuthor) => (
            <PostCard
              key={post.id}
              post={post}
              isLiked={interactions?.likedPostIds?.has(post.id)}
              isBookmarked={interactions?.bookmarkedPostIds?.has(post.id)}
              onUpdate={() => refetchPosts()}
            />
          ))
        ) : (
          <EmptyState
            icon={MessageSquare}
            title="No posts yet"
            description={
              isMember
                ? "Be the first to post in this community!"
                : "Join this community to start posting."
            }
          />
        )}
      </div>
    </div>
  );
}
