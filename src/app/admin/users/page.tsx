"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Users,
  ShieldCheck,
  ShieldOff,
  ExternalLink,
  BadgeCheck,
  BadgeX,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatTimeAgo } from "@/lib/utils/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { getUsers, toggleUserAdmin, toggleUserVerified } from "@/lib/queries/admin";

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users", debouncedQuery],
    queryFn: () => getUsers(debouncedQuery || undefined),
  });

  const toggleAdminMutation = useMutation({
    mutationFn: ({
      userId,
      isAdmin,
    }: {
      userId: string;
      isAdmin: boolean;
    }) => toggleUserAdmin(userId, isAdmin),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });

  const toggleVerifiedMutation = useMutation({
    mutationFn: ({
      userId,
      isVerified,
    }: {
      userId: string;
      isVerified: boolean;
    }) => toggleUserVerified(userId, isVerified),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage platform users
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Search users by name or username..."
          className="pl-9"
        />
      </div>

      {/* User list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl p-3"
            >
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-7 w-20" />
            </div>
          ))}
        </div>
      ) : users && users.length > 0 ? (
        <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
          {users.map((user, idx) => (
            <div
              key={user.id}
              className={cn(
                "flex items-center gap-3 bg-card p-3 transition-colors hover:bg-muted/20",
                idx !== 0 && "border-t border-foreground/5"
              )}
            >
              <UserAvatar
                src={user.avatar_url}
                fallback={user.display_name}
                size="md"
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {user.display_name}
                  </span>
                  {user.is_admin && (
                    <Badge variant="secondary" className="text-[10px]">
                      Admin
                    </Badge>
                  )}
                  {user.is_verified && (
                    <Badge variant="outline" className="text-[10px]">
                      Verified
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>@{user.username}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span>Joined {formatTimeAgo(user.created_at)}</span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <Link href={`/${user.username}`}>
                  <Button variant="ghost" size="icon-sm">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </Link>

                <Button
                  variant={user.is_verified ? "secondary" : "outline"}
                  size="sm"
                  disabled={toggleVerifiedMutation.isPending}
                  onClick={() =>
                    toggleVerifiedMutation.mutate({
                      userId: user.id,
                      isVerified: !user.is_verified,
                    })
                  }
                >
                  {user.is_verified ? (
                    <>
                      <BadgeX className="h-3.5 w-3.5" />
                      Unverify
                    </>
                  ) : (
                    <>
                      <BadgeCheck className="h-3.5 w-3.5" />
                      Verify
                    </>
                  )}
                </Button>

                <Button
                  variant={user.is_admin ? "destructive" : "outline"}
                  size="sm"
                  disabled={toggleAdminMutation.isPending}
                  onClick={() =>
                    toggleAdminMutation.mutate({
                      userId: user.id,
                      isAdmin: !user.is_admin,
                    })
                  }
                >
                  {user.is_admin ? (
                    <>
                      <ShieldOff className="h-3.5 w-3.5" />
                      Remove Admin
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Make Admin
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title="No users found"
          description={
            debouncedQuery
              ? `No users match "${debouncedQuery}"`
              : "No users on the platform yet."
          }
        />
      )}
    </div>
  );
}
