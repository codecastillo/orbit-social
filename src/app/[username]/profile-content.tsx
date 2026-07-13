"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MoreHorizontal, ExternalLink, Copy, UserX, VolumeX, Flag, Trash2, Loader2, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FollowListDialog } from "@/components/profile/follow-list-dialog";
import { BlockMuteDialog } from "@/components/shared/block-mute-dialog";
import { ReportDialog } from "@/components/shared/report-dialog";
import { normalizeAccent } from "@/lib/design/accents";
import { getOrCreateDMConversation } from "@/lib/queries/messages";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/hooks/use-auth";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import {
  getUserPosts,
  getUserLikedPosts,
  getUserBookmarkedPosts,
  getUserRepostedPosts,
  getUserPinnedPosts,
  getUserClips,
  getUserTaggedPosts,
  getProfileTabCounts,
  checkUserInteractions,
  type PostWithAuthor,
  type ProfileTabCounts,
} from "@/lib/queries/posts";
import { getUserVods, deleteVod, type VodRow } from "@/lib/queries/vods";
import { PostCard } from "@/components/feed/post-card";
import { ClipPlayer } from "@/components/clips/clip-player";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { AvatarBorderStyle } from "@/components/shared/user-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { VerifiedStar } from "@/components/orbit/verified-star";
import { StatCluster } from "@/components/orbit/stat-cluster";

interface ProfileContentProps {
  profile: {
    id: string;
    username: string;
    display_name: string;
    bio: string | null;
    avatar_url: string | null;
    cover_url: string | null;
    website: string | null;
    location: string | null;
    is_verified: boolean;
    follower_count: number;
    following_count: number;
    post_count: number;
    created_at: string;
    theme_color?: string | null;
    avatar_border?: string | null;
    private_followers?: boolean | null;
    private_likes?: boolean | null;
    is_private?: boolean | null;
  };
  isOwnProfile: boolean;
  initialIsFollowing: boolean;
  initialTabCounts?: ProfileTabCounts;
}

// All possible tabs in their canonical render order. Visibility is computed
// at runtime from `getProfileTabCounts` plus owner/visitor + privacy rules,
// so a brand-new account only sees Posts / Likes / Tagged and the rest pop
// in once the underlying content exists.
const ALL_TABS = [
  { value: "posts", label: "Posts" },
  { value: "clips", label: "Clips" },
  { value: "tagged", label: "Tagged" },
  { value: "reposts", label: "Reposts" },
  { value: "likes", label: "Likes" },
  { value: "saved", label: "Saved" },
] as const;

type TabValue = (typeof ALL_TABS)[number]["value"];

function fmtNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${n}`;
}

function splitName(name: string): { first: string; rest: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], rest: "" };
  return { first: parts[0], rest: parts.slice(1).join(" ") };
}

function joinedYear(iso: string): string {
  const y = new Date(iso).getFullYear();
  return `'${y.toString().slice(-2)}`;
}

export function ProfileContent({
  profile,
  isOwnProfile,
  initialIsFollowing,
  initialTabCounts,
}: ProfileContentProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [activeTab, setActiveTab] = useState<TabValue>("posts");
  const [followListOpen, setFollowListOpen] = useState<null | "followers" | "following">(null);
  const [blockMuteAction, setBlockMuteAction] = useState<null | "block" | "mute">(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [openingDm, setOpeningDm] = useState(false);
  const router = useRouter();
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const queryClient = useQueryClient();
  const supabase = createClient();

  // Live orbit / mutuals counts. Seeded from server data, then kept in sync
  // via realtime UPDATE on the profile row (the existing follow/unfollow
  // triggers maintain follower_count + following_count).
  const [liveCounts, setLiveCounts] = useState({
    followers: profile.follower_count,
    following: profile.following_count,
  });
  useEffect(() => {
    setLiveCounts({
      followers: profile.follower_count,
      following: profile.following_count,
    });
  }, [profile.id, profile.follower_count, profile.following_count]);

  useEffect(() => {
    const channel = supabase
      .channel(
        `profile-${profile.id}-${Math.random().toString(36).slice(2)}`
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${profile.id}`,
        },
        (payload) => {
          const row = payload.new as {
            follower_count?: number;
            following_count?: number;
          };
          setLiveCounts((prev) => ({
            followers: row.follower_count ?? prev.followers,
            following: row.following_count ?? prev.following,
          }));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "follows",
          filter: `following_id=eq.${profile.id}`,
        },
        () => {
          // Their orbit (followers) changed, refresh the list dialog
          queryClient.invalidateQueries({
            queryKey: ["follow-list", profile.id, "followers"],
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "follows",
          filter: `follower_id=eq.${profile.id}`,
        },
        () => {
          // Their mutuals (following) changed, refresh the list dialog
          queryClient.invalidateQueries({
            queryKey: ["follow-list", profile.id, "following"],
          });
        }
      )
      .on(
        "postgres_changes",
        {
          // Posts the profile owner authored (or removed/edited, e.g.
          // pin toggled) → recompute tab counts AND refetch every tab
          // list so pinning, unpinning, deleting, or posting a new clip
          // shows up in real time without a reload.
          event: "*",
          schema: "public",
          table: "posts",
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["profile-tab-counts", profile.id],
          });
          queryClient.invalidateQueries({
            queryKey: ["user-posts", profile.id],
          });
          queryClient.invalidateQueries({
            queryKey: ["user-pinned-posts", profile.id],
          });
          queryClient.invalidateQueries({
            queryKey: ["user-clips", profile.id],
          });
          queryClient.invalidateQueries({
            queryKey: ["user-reposted-posts", profile.id],
          });
        }
      )
      .on(
        "postgres_changes",
        {
          // Someone @mentioned this profile (or unmentioned via edit) →
          // refresh counts so the Tagged tab appears immediately.
          event: "*",
          schema: "public",
          table: "post_mentions",
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["profile-tab-counts", profile.id],
          });
          queryClient.invalidateQueries({
            queryKey: ["user-tagged-posts", profile.id],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile.id, supabase, queryClient]);

  // Viewer-scoped realtime: when the *viewer* (un)likes / (un)bookmarks /
  // (un)reposts something, the corresponding tab on this profile should
  // refetch so the row drops or appears without a reload. The Repost tab
  // is owner-only on this profile (the viewer's own reposts only show
  // here when this is their own profile), so we only invalidate
  // user-reposted-posts when isOwnProfile.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(
        `profile-viewer-${profile.id}-${user.id}-${Math.random().toString(36).slice(2)}`,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "post_likes",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["user-liked-posts", profile.id],
          });
          if (isOwnProfile) {
            queryClient.invalidateQueries({
              queryKey: ["profile-tab-counts", profile.id],
            });
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookmarks",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["user-saved-posts", profile.id],
          });
          if (isOwnProfile) {
            queryClient.invalidateQueries({
              queryKey: ["profile-tab-counts", profile.id],
            });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile.id, user, supabase, queryClient, isOwnProfile]);

  // Stamp the viewer's like/bookmark state onto a list of posts so PostCard
  // renders the heart filled-in for posts they've already liked. Without
  // this, the profile tabs serve raw rows (no `user_has_liked`) and every
  // heart looks unliked even when the viewer has tapped it elsewhere.
  const enrichWithViewerInteractions = async (rows: PostWithAuthor[]) => {
    if (!user || rows.length === 0) return rows;
    const { likedPostIds, bookmarkedPostIds, repostedPostIds } =
      await checkUserInteractions(
        user.id,
        rows.map((r) => r.id),
      );
    return rows.map((r) => ({
      ...r,
      user_has_liked: likedPostIds.has(r.id),
      user_has_bookmarked: bookmarkedPostIds.has(r.id),
      user_has_reposted: repostedPostIds.has(r.id),
    }));
  };

  const { data: pinnedPosts = [] } = useQuery({
    queryKey: ["user-pinned-posts", profile.id, user?.id],
    queryFn: async () =>
      enrichWithViewerInteractions(await getUserPinnedPosts(profile.id)),
    staleTime: 1000 * 60 * 2,
  });

  const { data: posts = [] } = useQuery({
    queryKey: ["user-posts", profile.id, user?.id],
    queryFn: async () =>
      enrichWithViewerInteractions(await getUserPosts(profile.id)),
    staleTime: 1000 * 60 * 2,
  });

  const { data: clips = [], isLoading: loadingClips } = useQuery({
    queryKey: ["user-clips", profile.id, user?.id],
    queryFn: async () =>
      enrichWithViewerInteractions(await getUserClips(profile.id)),
    enabled: activeTab === "clips",
    staleTime: 1000 * 60 * 2,
  });

  const { data: likedPosts = [], isLoading: loadingLikes } = useQuery({
    queryKey: ["user-liked-posts", profile.id, user?.id],
    queryFn: async () =>
      enrichWithViewerInteractions(await getUserLikedPosts(profile.id)),
    enabled: activeTab === "likes",
    staleTime: 1000 * 60,
  });

  const { data: repostedPosts = [], isLoading: loadingReposts } = useQuery({
    queryKey: ["user-reposted-posts", profile.id, user?.id],
    queryFn: async () =>
      enrichWithViewerInteractions(await getUserRepostedPosts(profile.id)),
    enabled: activeTab === "reposts",
    staleTime: 1000 * 60,
  });

  const { data: savedPosts = [], isLoading: loadingSaved } = useQuery({
    queryKey: ["user-saved-posts", profile.id, user?.id],
    queryFn: async () =>
      enrichWithViewerInteractions(await getUserBookmarkedPosts(profile.id)),
    enabled: activeTab === "saved" && isOwnProfile,
    staleTime: 1000 * 60,
  });

  const { data: vods = [] } = useQuery({
    queryKey: ["user-vods", profile.id],
    queryFn: () => getUserVods(profile.id),
    staleTime: 1000 * 60 * 2,
  });

  const { data: taggedPosts = [], isLoading: loadingTagged } = useQuery({
    queryKey: ["user-tagged-posts", profile.id, user?.id],
    queryFn: async () =>
      enrichWithViewerInteractions(await getUserTaggedPosts(profile.id)),
    enabled: activeTab === "tagged",
    staleTime: 1000 * 60,
  });

  // Drives which tabs show up. Seeded from the SSR-computed counts so
  // the strip renders correctly on first paint and doesn't flash from
  // "all on" → "real shape" once the client query resolves.
  const { data: tabCounts } = useQuery({
    queryKey: ["profile-tab-counts", profile.id, user?.id],
    queryFn: () => getProfileTabCounts(profile.id, user?.id),
    staleTime: 1000 * 30,
    initialData: initialTabCounts,
  });

  const handleFollow = async () => {
    if (!requireAuth() || !user) return;
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);

    if (wasFollowing) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", profile.id);
      if (error) {
        setIsFollowing(true);
        toast.error("Failed to unfollow");
      }
    } else {
      const { error } = await supabase.from("follows").insert({
        follower_id: user.id,
        following_id: profile.id,
      });
      if (error) {
        setIsFollowing(false);
        toast.error("Failed to follow");
      }
    }
  };

  const visibleTabs = useMemo(() => {
    const counts = tabCounts;
    // While counts are loading, fall back to the always-on set so the
    // tab strip doesn't flicker from "Posts only" to the full set.
    const has = (n: number | undefined) => (n ?? 0) > 0;
    return ALL_TABS.filter((t) => {
      switch (t.value) {
        case "posts":
          return true;
        case "tagged":
          return counts ? has(counts.tagged) : true;
        case "likes":
          if (!isOwnProfile && profile.private_likes) return false;
          if (isOwnProfile) return true;
          return counts ? has(counts.likes) : true;
        case "saved":
          return isOwnProfile && (counts ? has(counts.saved) : true);
        case "clips":
          return counts ? has(counts.clips) : false;
        case "reposts":
          return counts ? has(counts.reposts) : false;
      }
    });
  }, [isOwnProfile, profile.private_likes, tabCounts]);

  // If the active tab gets hidden (e.g. someone toggles privacy mid-view),
  // snap back to Posts so we never render a non-existent state.
  useEffect(() => {
    if (!visibleTabs.some((t) => t.value === activeTab)) {
      setActiveTab("posts");
    }
  }, [visibleTabs, activeTab]);

  const themeAccent = normalizeAccent(profile.theme_color);
  const accent = themeAccent || "var(--primary)";
  const { first, rest } = splitName(profile.display_name);
  const avatarBorder = (profile.avatar_border || "none") as AvatarBorderStyle;

  return (
    <div className="flex flex-col gap-[18px] text-foreground">

      {/* HERO PANEL */}
      <div className="relative rounded-xl border border-border bg-surface">
        {/* Floating back button, sits on top of the banner so it doesn't
            occupy its own row above the panel. */}
        <button
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) {
              router.back();
            } else {
              router.push("/feed");
            }
          }}
          aria-label="Back"
          className="absolute top-3.5 left-3.5 z-[5] inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-black/60 text-white"
        >
          <ArrowLeft className="h-[15px] w-[15px]" strokeWidth={2} />
        </button>

        {/* Banner, clipped to top radius only */}
        <div className="overflow-hidden rounded-t-xl">
          {profile.cover_url ? (
            <div
              className="relative h-[200px] bg-cover bg-center"
              style={{ backgroundImage: `url(${profile.cover_url})` }}
            />
          ) : (
            <div className="h-[200px] bg-surface-elevated" />
          )}
        </div>

        {/* Identity row: content flows BELOW the banner, only the avatar overlaps */}
        <div className="flex flex-wrap items-start gap-6 px-8 pb-6">
          {/* Avatar, accent ring and decorative avatar_border are mutually
              exclusive. When a decorative border is set, the wrapper hugs
              the avatar so the dark panel doesn't show through as a gap.
              The accent ring rides the dynamic per-profile color, so it
              stays an inline box-shadow. */}
          <div
            className={
              avatarBorder === "none"
                ? "relative z-[1] -mt-[68px] h-[136px] w-[136px] shrink-0 rounded-full bg-background p-[5px]"
                : "relative z-[1] -mt-[68px] inline-block shrink-0 rounded-full leading-none shadow-[0_16px_40px_rgba(0,0,0,0.5)]"
            }
            style={
              avatarBorder === "none"
                ? { boxShadow: `0 16px 40px rgba(0,0,0,0.5), 0 0 0 2px ${accent}` }
                : undefined
            }
          >
            <UserAvatar
              src={profile.avatar_url}
              fallback={profile.display_name}
              size="xl"
              avatarBorder={avatarBorder}
            />
          </div>

          <div className="min-w-0 flex-1 pt-4">
            <div className="flex flex-wrap items-baseline gap-2.5">
              <h1
                className="text-[32px] font-bold leading-none tracking-[-0.03em]"
                style={themeAccent ? { color: themeAccent } : undefined}
              >
                {rest ? (
                  <>
                    {first}{" "}
                    <span
                      className={themeAccent ? undefined : "text-primary"}
                      style={themeAccent ? { color: themeAccent } : undefined}
                    >
                      {rest}
                    </span>
                  </>
                ) : (
                  first || profile.username
                )}
              </h1>
              {profile.is_verified && <VerifiedStar size={18} />}
            </div>
            <div className="mt-1 font-mono text-[13px] uppercase tracking-[0.04em] text-muted-foreground">
              @{profile.username}
              {profile.location && ` · ${profile.location}`} · IN ORBIT SINCE{" "}
              {joinedYear(profile.created_at)}
            </div>
            {profile.bio && (
              <p className="mt-3 max-w-[580px] text-[14.5px] leading-[1.55] text-text-secondary">
                {profile.bio}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-4">
            {!isOwnProfile && (
              <Button
                variant={isFollowing ? "outline" : "default"}
                onClick={handleFollow}
              >
                {isFollowing ? "Following" : "Follow"}
              </Button>
            )}
            {!isOwnProfile && (
              <Button
                variant="outline"
                disabled={openingDm}
                onClick={async () => {
                  if (!requireAuth() || !user) return;
                  setOpeningDm(true);
                  try {
                    const conversationId = await getOrCreateDMConversation(
                      user.id,
                      profile.id,
                    );
                    router.push(`/messages/${conversationId}`);
                  } catch {
                    toast.error("Couldn't open conversation");
                    setOpeningDm(false);
                  }
                }}
              >
                {openingDm ? <Loader2 className="h-4 w-4 animate-spin" /> : "Message"}
              </Button>
            )}
            {isOwnProfile && (
              <Link href="/settings/profile">
                <Button>Edit profile</Button>
              </Link>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="More options"
                className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors hover:bg-muted"
              >
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-2xl">
                <DropdownMenuItem
                  className="cursor-pointer rounded-lg"
                  onClick={() => {
                    const url = `${window.location.origin}/${profile.username}`;
                    void navigator.clipboard.writeText(url);
                    toast.success("Profile link copied");
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy profile link
                </DropdownMenuItem>
                {!isOwnProfile && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer rounded-lg"
                      onClick={() => {
                        if (!requireAuth()) return;
                        setBlockMuteAction("mute");
                      }}
                    >
                      <VolumeX className="mr-2 h-4 w-4" />
                      Mute @{profile.username}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer rounded-lg"
                      onClick={() => {
                        if (!requireAuth()) return;
                        setBlockMuteAction("block");
                      }}
                    >
                      <UserX className="mr-2 h-4 w-4" />
                      Block @{profile.username}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer rounded-lg"
                      onClick={() => {
                        if (!requireAuth()) return;
                        setReportOpen(true);
                      }}
                    >
                      <Flag className="mr-2 h-4 w-4" />
                      Report
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Stats strip */}
        <div className="flex flex-wrap items-end gap-[18px] gap-y-3.5 border-t border-border px-8 pb-6 pt-5">
          <StatCluster
            items={[
              { n: profile.post_count, label: "posts" },
              {
                n: liveCounts.followers,
                label: "followers",
                onClick:
                  isOwnProfile ||
                  (!profile.private_followers &&
                    !(profile.is_private === true && !isFollowing))
                    ? () => setFollowListOpen("followers")
                    : undefined,
              },
              {
                n: liveCounts.following,
                label: "following",
                onClick:
                  isOwnProfile ||
                  (!profile.private_followers &&
                    !(profile.is_private === true && !isFollowing))
                    ? () => setFollowListOpen("following")
                    : undefined,
              },
            ]}
          />
          {profile.website && (
            <div className="ml-auto flex items-center gap-2">
              <span className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground">
                ALSO ON
              </span>
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-[11px] py-[5px] text-[11px] font-medium text-text-secondary no-underline"
              >
                <ExternalLink className="h-[11px] w-[11px]" />
                {(() => {
                  try {
                    return new URL(profile.website).hostname.replace(/^www\./, "");
                  } catch {
                    return profile.website;
                  }
                })()}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* PRIVATE LOCK, Instagram-style. When the profile is private and the
          viewer isn't the owner or a follower, swap the entire tabs+content
          block for a lock card. Use explicit === true so a column that
          arrives as null/undefined doesn't accidentally unlock the profile. */}
      {profile.is_private === true && !isOwnProfile && !isFollowing ? (
        <div className="rounded-xl border border-border bg-surface px-6 py-11 text-center text-text-secondary">
          <div className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-surface-elevated">
            <Lock className="h-[22px] w-[22px] text-muted-foreground" strokeWidth={1.6} />
          </div>
          <p className="m-0 text-[15px] font-semibold text-foreground">
            This account is private.
          </p>
          <p className="mb-0 mt-1.5 text-[13px] leading-normal text-muted-foreground">
            Follow @{profile.username} to see their posts, clips, and likes.
          </p>
        </div>
      ) : (
      <>
      {/* TABS */}
      <div className="flex gap-1 rounded-xl border border-border bg-surface p-[5px]">
        {visibleTabs.map((t) => {
          const isActive = activeTab === t.value;
          return (
            <button
              key={t.value}
              onClick={() => setActiveTab(t.value)}
              className={`flex-1 cursor-pointer rounded-lg border py-2.5 text-center text-[13px] font-semibold transition-all duration-150 ${
                isActive
                  ? "border-border bg-primary/10 text-foreground"
                  : "border-transparent bg-transparent text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* CONTENT */}
      <div>
        {activeTab === "posts" && (
          <>
            {pinnedPosts.length > 0 && (
              <div className="mb-4 flex flex-col gap-2">
                <div className="pl-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-amber-300">
                  ◇&nbsp;&nbsp;Pinned
                </div>
                {pinnedPosts.map((p: any) => (
                  <PostCard key={p.id} post={p} />
                ))}
              </div>
            )}
            {posts.length === 0 && pinnedPosts.length === 0 ? (
              <EmptyTab />
            ) : (
              <div className="flex flex-col gap-2">
                {posts.map((p: any) => (
                  <PostCard key={p.id} post={p} />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "clips" &&
          (loadingClips ? (
            <ListSkeleton />
          ) : clips.length === 0 ? (
            <EmptyTab />
          ) : (
            <ProfileClipsFeed clips={clips} />
          ))}

        {activeTab === "likes" &&
          (loadingLikes ? (
            <ListSkeleton />
          ) : likedPosts.length === 0 ? (
            <EmptyTab />
          ) : (
            <div className="flex flex-col gap-2">
              {likedPosts.map((p: any) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          ))}

        {activeTab === "reposts" &&
          (loadingReposts ? (
            <ListSkeleton />
          ) : repostedPosts.length === 0 ? (
            <EmptyTab />
          ) : (
            <div className="flex flex-col gap-2">
              {repostedPosts.map((p: any) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          ))}

        {activeTab === "tagged" &&
          (loadingTagged ? (
            <ListSkeleton />
          ) : taggedPosts.length === 0 ? (
            <EmptyTab />
          ) : (
            <div className="flex flex-col gap-2">
              {taggedPosts.map((p: any) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          ))}

        {activeTab === "saved" &&
          isOwnProfile &&
          (loadingSaved ? (
            <ListSkeleton />
          ) : savedPosts.length === 0 ? (
            <EmptyTab />
          ) : (
            <div className="flex flex-col gap-2">
              {savedPosts.map((p: any) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          ))}
      </div>
      </>
      )}

      {vods.length > 0 && !(profile.is_private === true && !isOwnProfile && !isFollowing) && (
        <PastStreamsSection vods={vods} isOwner={isOwnProfile} />
      )}

      {!isOwnProfile && user && (
        <>
          <BlockMuteDialog
            open={blockMuteAction !== null}
            onOpenChange={(o) => {
              if (!o) setBlockMuteAction(null);
            }}
            actionType={blockMuteAction ?? "mute"}
            currentUserId={user.id}
            targetUserId={profile.id}
            targetUsername={profile.username}
          />
          <ReportDialog
            open={reportOpen}
            onOpenChange={setReportOpen}
            entityType="profile"
            entityId={profile.id}
            reportedUserId={profile.id}
          />
        </>
      )}

      <FollowListDialog
        open={
          followListOpen !== null &&
          (isOwnProfile ||
            (!profile.private_followers &&
              !(profile.is_private === true && !isFollowing)))
        }
        onOpenChange={(o) => {
          if (!o) setFollowListOpen(null);
        }}
        userId={profile.id}
        kind={followListOpen ?? "followers"}
      />
    </div>
  );
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s
      .toString()
      .padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  const y = Math.floor(d / 365);
  return `${y}y ago`;
}

function PastStreamsSection({
  vods,
  isOwner,
}: {
  vods: VodRow[];
  isOwner: boolean;
}) {
  return (
    <div className="mt-1 rounded-xl border border-border bg-surface p-6">
      <div className="mb-[18px]">
        <div className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-primary">
          ◇&nbsp;&nbsp;PAST STREAMS
        </div>
        <h2 className="mt-2 text-[22px] font-bold leading-none tracking-[-0.03em] text-foreground">
          On the <span className="text-primary">record</span>
        </h2>
      </div>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
        {vods.map((vod) => (
          <VodCard key={vod.id} vod={vod} isOwner={isOwner} />
        ))}
      </div>
    </div>
  );
}

function VodCard({ vod, isOwner }: { vod: VodRow; isOwner: boolean }) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteVod(vod.id);
      queryClient.setQueryData<VodRow[]>(
        ["user-vods", vod.user_id],
        (prev) => (prev ?? []).filter((v) => v.id !== vod.id),
      );
      queryClient.invalidateQueries({ queryKey: ["user-vods", vod.user_id] });
      toast.success("VOD deleted");
      setConfirmOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't delete VOD");
    } finally {
      setDeleting(false);
    }
  };

  // Self-heal a wrong stored duration without making the user open the
  // player first. The webhook stores `duration` from the asset Mux fires
  // ready for, which on reconnects is sometimes just a tail segment. We
  // fetch the authoritative duration from the Mux REST API server-side
  // (the client doesn't have credentials) and write it back. Only fires
  // for VODs whose stored duration looks suspect.
  const refreshedRef = useRef(false);
  useEffect(() => {
    if (refreshedRef.current) return;
    const stored = vod.duration_seconds ?? 0;
    // Only probe rows that look broken (≤ 30s). Real short clips also
    // pass through this gate, the endpoint is idempotent and a no-op if
    // the durations already match.
    if (stored > 30) return;
    refreshedRef.current = true;
    void fetch("/api/mux/refresh-vod", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vodId: vod.id }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res?.ok && !res.unchanged) {
          queryClient.invalidateQueries({
            queryKey: ["user-vods", vod.user_id],
          });
        }
      })
      .catch(() => {});
  }, [vod.id, vod.duration_seconds, vod.user_id, queryClient]);

  return (
    <>
      <Link
        href={`/vod/${vod.id}`}
        className="flex flex-col gap-2.5 text-inherit no-underline"
      >
        <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-surface-elevated">
          {vod.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={vod.thumbnail_url}
              alt={vod.title ?? "Past stream"}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-primary/10" />
          )}
          {isOwner && (
            <button
              type="button"
              aria-label="Delete VOD"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setConfirmOpen(true);
              }}
              className="absolute right-2 top-2 inline-flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-full border border-white/15 bg-black/60 p-0 text-white transition-colors hover:bg-black/80"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          {vod.duration_seconds ? (
            <span className="absolute bottom-2 right-2 rounded-lg bg-black/70 px-2 py-[3px] font-mono text-[11px] font-semibold tracking-[0.02em] text-white">
              {formatDuration(vod.duration_seconds)}
            </span>
          ) : null}
        </div>
        <div>
          <div className="line-clamp-2 text-sm font-semibold leading-[1.35] text-foreground">
            {vod.title ?? "Untitled stream"}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {vod.category && (
              <span className="rounded-full border border-border bg-surface-elevated px-2 py-0.5 text-[10.5px] font-medium text-text-secondary">
                {vod.category}
              </span>
            )}
            <span className="font-mono text-[11.5px] tracking-[0.04em] text-muted-foreground">
              {fmtNumber(vod.view_count)} views · {timeAgo(vod.created_at)}
            </span>
          </div>
        </div>
      </Link>

      <DeleteVodDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleDelete}
        deleting={deleting}
      />
    </>
  );
}

function DeleteVodDialog({
  open,
  onOpenChange,
  onConfirm,
  deleting,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Delete this VOD?</DialogTitle>
          <DialogDescription>
            The recording will be removed from your profile and from Mux. This
            cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={deleting}>
            {deleting && <Loader2 className="animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Tabbed clip viewer for the profile Clips tab, same vertical
// snap-mandatory player layout the global /clips feed uses, but scoped
// to one user's reels. We sit the scroller inside a tall fixed-aspect
// frame so it doesn't blow up the surrounding profile page layout.
function ProfileClipsFeed({ clips }: { clips: PostWithAuthor[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const scrollByOne = (dir: 1 | -1) => {
    const s = scrollerRef.current;
    if (!s) return;
    s.scrollBy({ top: dir * s.clientHeight, behavior: "smooth" });
  };
  return (
    <div className="h-[min(80vh,720px)] overflow-hidden rounded-2xl border border-border bg-background">
      <div
        ref={scrollerRef}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide bg-background"
      >
        {clips.map((clip) => (
          <ClipPlayer key={clip.id} clip={clip} onNavigate={scrollByOne} />
        ))}
      </div>
    </div>
  );
}

// Instagram-Reels-style 3-up grid of vertical clip thumbnails.
function ClipsGrid({
  clips,
}: {
  clips: Array<{
    id: string;
    post_media?: Array<{
      type: string;
      url: string;
      thumbnail_url?: string | null;
    }> | null;
    view_count?: number | null;
  }>;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {clips.map((clip) => {
        const video = clip.post_media?.find((m) => m.type === "video");
        const thumb = video?.thumbnail_url ?? null;
        return (
          <Link
            key={clip.id}
            href={`/post/${clip.id}`}
            className="relative block aspect-[9/16] overflow-hidden rounded-lg border border-border bg-surface no-underline"
          >
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt="" className="h-full w-full object-cover" />
            ) : video?.url ? (
              <video
                src={video.url}
                muted
                playsInline
                preload="metadata"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-primary/10" />
            )}
            {(clip.view_count ?? 0) > 0 && (
              <div className="absolute bottom-1.5 left-2 text-[11px] font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
                ▶ {fmtNumber(clip.view_count ?? 0)}
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}

function EmptyTab() {
  return (
    <div className="px-5 py-[60px] text-center">
      <div className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        ◇&nbsp;&nbsp;NOTHING HERE YET
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex gap-3 rounded-xl border border-border bg-surface p-4"
        >
          <Skeleton className="h-10 w-10 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
