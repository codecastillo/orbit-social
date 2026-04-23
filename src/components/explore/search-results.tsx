"use client";

import { useQuery } from "@tanstack/react-query";
import { Users, FileText } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { PostCard } from "@/components/feed/post-card";
import { UserSuggestionCard } from "@/components/explore/user-suggestion-card";
import { searchUsers, searchPosts } from "@/lib/queries/social";

interface SearchResultsProps {
  query: string;
}

export function SearchResults({ query }: SearchResultsProps) {
  const {
    data: users,
    isLoading: usersLoading,
  } = useQuery({
    queryKey: ["search-users", query],
    queryFn: () => searchUsers(query, 20),
    enabled: query.length > 0,
  });

  const {
    data: posts,
    isLoading: postsLoading,
  } = useQuery({
    queryKey: ["search-posts", query],
    queryFn: () => searchPosts(query),
    enabled: query.length > 0,
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
      </TabsList>

      <TabsContent value="people">
        {usersLoading ? (
          <UserListSkeleton />
        ) : !users || users.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No people found"
            description={`No users match "${query}"`}
          />
        ) : (
          <div>
            {users.map((profile) => (
              <UserSuggestionCard key={profile.id} profile={profile} />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="posts">
        {postsLoading ? (
          <PostListSkeleton />
        ) : !posts || posts.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No posts found"
            description={`No posts match "${query}"`}
          />
        ) : (
          <div>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
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
