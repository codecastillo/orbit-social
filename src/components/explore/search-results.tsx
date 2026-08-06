"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Users, FileText, MessageSquare, Bookmark, Heart } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { OrbitErrorState } from "@/components/orbit/error-state";
import { PostCard } from "@/components/feed/post-card";
import { UserSuggestionCard } from "@/components/explore/user-suggestion-card";
import { useAuth } from "@/lib/hooks/use-auth";
import { checkFollowStates, searchUsers } from "@/lib/queries/social";
import {
  searchLiked,
  searchMessages,
  searchPostsAdvanced,
  searchSaved,
} from "@/lib/queries/search-advanced";
import { describeFilters, parseSearchQuery } from "@/lib/search-query";
import { formatTimeAgo } from "@/lib/utils/format";

interface SearchResultsProps {
  query: string;
  /** Records a profile the viewer opened from these results. */
  onOpenProfile?: (username: string) => void;
}

export function SearchResults({ query, onOpenProfile }: SearchResultsProps) {
  const { user } = useAuth();
  // Operators are parsed once and every search below acts on the parts, so
  // "from:@dan has:image beach" narrows rather than being searched for
  // literally. Same parser as mobile.
  const parsed = useMemo(() => parseSearchQuery(query), [query]);
  const filterSummary = describeFilters(parsed);
  const {
    data: users,
    isLoading: usersLoading,
    isError: usersError,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: ["search-users", query],
    queryFn: () => searchUsers(parsed.text || query, 20),
    enabled: query.length > 0,
  });

  const {
    data: posts,
    isLoading: postsLoading,
    isError: postsError,
    refetch: refetchPosts,
  } = useQuery({
    queryKey: ["search-posts", query],
    queryFn: () => searchPostsAdvanced(parsed),
    enabled: query.length > 0,
  });

  // The three below search the viewer's own things, so they only run for a
  // signed-in reader and their tabs are absent otherwise.
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ["search-messages", query, user?.id],
    queryFn: () => searchMessages(parsed),
    enabled: query.length > 0 && !!user,
  });

  const { data: saved, isLoading: savedLoading } = useQuery({
    queryKey: ["search-saved", query, user?.id],
    queryFn: () => searchSaved(user!.id, parsed),
    enabled: query.length > 0 && !!user,
  });

  const { data: liked, isLoading: likedLoading } = useQuery({
    queryKey: ["search-liked", query, user?.id],
    queryFn: () => searchLiked(user!.id, parsed),
    enabled: query.length > 0 && !!user,
  });

  // One lookup for the whole result page, so every row can show the right
  // Follow / Requested / Following label without a round trip of its own.
  const resultIds = (users ?? []).map((u) => u.id);
  const { data: followStates } = useQuery({
    queryKey: ["search-follow-states", user?.id, resultIds],
    queryFn: () => checkFollowStates(user!.id, resultIds),
    enabled: !!user && resultIds.length > 0,
  });

  return (
    <Tabs defaultValue="people">
      <TabsList
        variant="line"
        className="w-full border-b border-border px-4"
      >
        <TabsTrigger value="people" className="flex-1 py-3">
          <Users className="h-4 w-4 mr-1.5" />
          People
        </TabsTrigger>
        <TabsTrigger value="posts" className="flex-1 py-3">
          <FileText className="h-4 w-4 mr-1.5" />
          Posts
        </TabsTrigger>
        {user && (
          <>
            <TabsTrigger value="messages" className="flex-1 py-3">
              <MessageSquare className="h-4 w-4 mr-1.5" />
              Messages
            </TabsTrigger>
            <TabsTrigger value="saved" className="flex-1 py-3">
              <Bookmark className="h-4 w-4 mr-1.5" />
              Saved
            </TabsTrigger>
            <TabsTrigger value="liked" className="flex-1 py-3">
              <Heart className="h-4 w-4 mr-1.5" />
              Liked
            </TabsTrigger>
          </>
        )}
      </TabsList>

      {/* Says how the operators were read. Without it a typo like
          "form:@dan" silently searches for the word instead. */}
      {filterSummary.length > 0 && (
        <p className="px-4 pt-2 text-xs text-muted-foreground">
          Filtering {filterSummary.join(", ")}
        </p>
      )}

      <TabsContent value="people">
        {usersLoading ? (
          <UserListSkeleton />
        ) : usersError ? (
          <OrbitErrorState
            headline="Search couldn't"
            accentWord="finish"
            sub="Something went wrong searching for people."
            onRetry={() => refetchUsers()}
          />
        ) : !users || users.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No people found"
            description={`No users match "${query}"`}
          />
        ) : (
          <div>
            {users.map((profile) => (
              <UserSuggestionCard
                key={profile.id}
                profile={profile}
                initialFollowState={followStates?.get(profile.id) ?? "none"}
                onOpen={() => onOpenProfile?.(profile.username)}
              />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="posts">
        {postsLoading ? (
          <PostListSkeleton />
        ) : postsError ? (
          <OrbitErrorState
            headline="Search couldn't"
            accentWord="finish"
            sub="Something went wrong searching posts."
            onRetry={() => refetchPosts()}
          />
        ) : !posts || posts.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No posts found"
            description={`No posts match "${query}"`}
          />
        ) : (
          <div>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} surface="search" />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="messages">
        {messagesLoading ? (
          <PostListSkeleton />
        ) : !messages || messages.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No messages found"
            description={
              parsed.text
                ? `No message matches "${parsed.text}"`
                : "Type something to search your conversations."
            }
          />
        ) : (
          <div>
            {messages.map((hit) => (
              <Link
                key={hit.id}
                href={`/messages/${hit.conversation_id}`}
                className="block border-b border-border px-4 py-3 transition-colors hover:bg-muted/40"
              >
                <p className="text-sm font-semibold">
                  {hit.sender?.display_name ?? hit.sender?.username ?? "Unknown"}
                </p>
                <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                  {hit.content}
                </p>
                <p className="mt-1 text-xs text-text-faint">
                  {formatTimeAgo(hit.created_at)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="saved">
        {savedLoading ? (
          <PostListSkeleton />
        ) : !saved || saved.length === 0 ? (
          <EmptyState
            icon={Bookmark}
            title="Nothing saved matches"
            description={`No saved post matches "${query}"`}
          />
        ) : (
          <div>
            {saved.map((post) => (
              <PostCard key={post.id} post={post} surface="search" />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="liked">
        {likedLoading ? (
          <PostListSkeleton />
        ) : !liked || liked.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="Nothing liked matches"
            description={`No liked post matches "${query}"`}
          />
        ) : (
          <div>
            {liked.map((post) => (
              <PostCard key={post.id} post={post} surface="search" />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

function UserListSkeleton() {
  return (
    <div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-8 w-[100px] rounded-full" />
        </div>
      ))}
    </div>
  );
}

function PostListSkeleton() {
  return (
    <div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-3 p-4 border-b border-border">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
