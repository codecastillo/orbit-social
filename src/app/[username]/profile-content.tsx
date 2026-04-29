"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MoreHorizontal, ExternalLink, Copy, Share2, UserX, VolumeX, Flag } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FollowListDialog } from "@/components/profile/follow-list-dialog";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  getUserPosts,
  getUserLikedPosts,
  getUserBookmarkedPosts,
  getUserRepostedPosts,
  getUserPinnedPosts,
  getUserClips,
  checkUserInteractions,
  type PostWithAuthor,
} from "@/lib/queries/posts";
import { getUserVods, type VodRow } from "@/lib/queries/vods";
import { PostCard } from "@/components/feed/post-card";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { AvatarBorderStyle } from "@/components/shared/user-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { O, aurora, auroraSoft, panel } from "@/lib/design/orbit";
import { Display, Acc, Eyebrow, PillBtn } from "@/components/orbit/primitives";
import { VerifiedStar } from "@/components/orbit/verified-star";
import { StatCluster } from "@/components/orbit/stat-cluster";
import { AuroraBanner } from "@/components/orbit/aurora-banner";

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
  };
  isOwnProfile: boolean;
  initialIsFollowing: boolean;
}

const TABS = [
  { value: "posts", label: "Posts" },
  { value: "clips", label: "Clips" },
  { value: "likes", label: "Likes" },
  { value: "reposts", label: "Reposts" },
  { value: "saved", label: "Saved" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

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
}: ProfileContentProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [activeTab, setActiveTab] = useState<TabValue>("posts");
  const [followListOpen, setFollowListOpen] = useState<null | "followers" | "following">(null);
  const router = useRouter();
  const { user } = useAuth();
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
          // Their orbit (followers) changed — refresh the list dialog
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
          // Their mutuals (following) changed — refresh the list dialog
          queryClient.invalidateQueries({
            queryKey: ["follow-list", profile.id, "following"],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile.id, supabase, queryClient]);

  // Stamp the viewer's like/bookmark state onto a list of posts so PostCard
  // renders the heart filled-in for posts they've already liked. Without
  // this, the profile tabs serve raw rows (no `user_has_liked`) and every
  // heart looks unliked even when the viewer has tapped it elsewhere.
  const enrichWithViewerInteractions = async (rows: PostWithAuthor[]) => {
    if (!user || rows.length === 0) return rows;
    const { likedPostIds, bookmarkedPostIds } = await checkUserInteractions(
      user.id,
      rows.map((r) => r.id),
    );
    return rows.map((r) => ({
      ...r,
      user_has_liked: likedPostIds.has(r.id),
      user_has_bookmarked: bookmarkedPostIds.has(r.id),
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

  const handleFollow = async () => {
    if (!user) {
      toast.error("Sign in to follow users");
      return;
    }
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
    return TABS.filter((t) => {
      if (t.value === "saved") return isOwnProfile;
      if (t.value === "likes") return isOwnProfile || !profile.private_likes;
      return true;
    });
  }, [isOwnProfile, profile.private_likes]);

  // If the active tab gets hidden (e.g. someone toggles privacy mid-view),
  // snap back to Posts so we never render a non-existent state.
  useEffect(() => {
    if (!visibleTabs.some((t) => t.value === activeTab)) {
      setActiveTab("posts");
    }
  }, [visibleTabs, activeTab]);

  const accent = profile.theme_color || O.a2;
  const { first, rest } = splitName(profile.display_name);
  const avatarBorder = (profile.avatar_border || "none") as AvatarBorderStyle;

  return (
    <div
      style={{
        color: O.ink,
        fontFamily: O.sans,
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >

      {/* HERO PANEL */}
      <div
        style={{
          ...panel(),
          padding: 0,
          position: "relative",
        }}
      >
        {/* Floating back button — sits on top of the banner so it doesn't
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
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            zIndex: 5,
            width: 36,
            height: 36,
            borderRadius: 999,
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            border: "1px solid rgba(255,255,255,0.14)",
            color: "white",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <ArrowLeft style={{ width: 15, height: 15 }} strokeWidth={2} />
        </button>

        {/* Banner — clipped to top radius only */}
        <div style={{ borderRadius: "24px 24px 0 0", overflow: "hidden" }}>
          {profile.cover_url ? (
            <div
              style={{
                height: 200,
                background: `url(${profile.cover_url}) center/cover`,
                position: "relative",
              }}
            />
          ) : (
            <AuroraBanner height={200} />
          )}
        </div>

        {/* Identity row — content flows BELOW the banner, only the avatar overlaps */}
        <div
          style={{
            padding: "0 32px 24px",
            display: "flex",
            alignItems: "flex-start",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          {/* Avatar — accent ring and decorative avatar_border are mutually
              exclusive. When a decorative border is set, the wrapper hugs
              the avatar so the dark panel doesn't show through as a gap. */}
          <div
            style={
              avatarBorder === "none"
                ? {
                    width: 136,
                    height: 136,
                    borderRadius: "50%",
                    padding: 5,
                    background: O.bg,
                    boxShadow: `0 16px 40px rgba(0,0,0,0.5), 0 0 0 2px ${accent}`,
                    flexShrink: 0,
                    marginTop: -68,
                    position: "relative",
                    zIndex: 1,
                  }
                : {
                    borderRadius: "50%",
                    boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
                    flexShrink: 0,
                    marginTop: -68,
                    position: "relative",
                    zIndex: 1,
                    display: "inline-block",
                    lineHeight: 0,
                  }
            }
          >
            <UserAvatar
              src={profile.avatar_url}
              fallback={profile.display_name}
              size="xl"
              avatarBorder={avatarBorder}
            />
          </div>

          <div style={{ flex: 1, paddingTop: 16, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <Display size={32}>
                {rest ? (
                  <>
                    {first}{" "}
                    <Acc color={profile.theme_color || undefined}>{rest}</Acc>
                  </>
                ) : (
                  first || profile.username
                )}
              </Display>
              {profile.is_verified && <VerifiedStar size={18} />}
            </div>
            <div
              style={{
                fontSize: 13,
                color: O.ink3,
                marginTop: 4,
                fontFamily: O.mono,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              @{profile.username}
              {profile.location && ` · ${profile.location}`} · IN ORBIT SINCE{" "}
              {joinedYear(profile.created_at)}
            </div>
            {profile.bio && (
              <p
                style={{
                  fontSize: 14.5,
                  color: O.ink2,
                  marginTop: 12,
                  maxWidth: 580,
                  lineHeight: 1.55,
                }}
              >
                {profile.bio}
              </p>
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              paddingTop: 16,
              flexWrap: "wrap",
            }}
          >
            {!isOwnProfile && (
              <PillBtn primary={!isFollowing} size="lg" onClick={handleFollow}>
                {isFollowing ? "Following ✓" : "+ Follow"}
              </PillBtn>
            )}
            {!isOwnProfile && (
              <Link href={`/messages?to=${profile.username}`}>
                <PillBtn size="lg">Message</PillBtn>
              </Link>
            )}
            {isOwnProfile && (
              <Link href="/settings/profile">
                <PillBtn primary size="lg">
                  Edit profile
                </PillBtn>
              </Link>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="More options"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 999,
                  border: `1px solid ${O.hair}`,
                  background: O.glass,
                  color: O.ink,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
                className="hover:bg-white/10 transition-colors"
              >
                <MoreHorizontal style={{ width: 16, height: 16 }} />
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
                <DropdownMenuItem
                  className="cursor-pointer rounded-lg"
                  onClick={async () => {
                    const url = `${window.location.origin}/${profile.username}`;
                    const title = profile.display_name || `@${profile.username}`;
                    if (
                      typeof navigator !== "undefined" &&
                      typeof (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }).share === "function"
                    ) {
                      try {
                        await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
                          title,
                          url,
                        });
                        return;
                      } catch {
                        /* fall through to clipboard */
                      }
                    }
                    void navigator.clipboard.writeText(url);
                    toast.success("Link copied. Paste anywhere to share");
                  }}
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Share profile
                </DropdownMenuItem>
                {!isOwnProfile && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer rounded-lg"
                      onClick={() => toast.message("Mute coming soon")}
                    >
                      <VolumeX className="mr-2 h-4 w-4" />
                      Mute @{profile.username}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer rounded-lg"
                      onClick={() => toast.message("Block coming soon")}
                    >
                      <UserX className="mr-2 h-4 w-4" />
                      Block @{profile.username}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer rounded-lg"
                      onClick={() => toast.message("Report coming soon")}
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
        <div
          style={{
            display: "flex",
            padding: "20px 32px 24px",
            borderTop: `1px solid ${O.hair}`,
            flexWrap: "wrap",
            rowGap: 14,
            alignItems: "flex-end",
            gap: 18,
          }}
        >
          <StatCluster
            items={[
              { n: profile.post_count, label: "posts" },
              {
                n: liveCounts.followers,
                label: "followers",
                onClick:
                  isOwnProfile || !profile.private_followers
                    ? () => setFollowListOpen("followers")
                    : undefined,
              },
              {
                n: liveCounts.following,
                label: "following",
                onClick:
                  isOwnProfile || !profile.private_followers
                    ? () => setFollowListOpen("following")
                    : undefined,
              },
            ]}
          />
          {profile.website && (
            <div
              style={{
                marginLeft: "auto",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: O.ink3,
                  fontFamily: O.mono,
                  letterSpacing: "0.08em",
                }}
              >
                ALSO ON
              </span>
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: "5px 11px",
                  borderRadius: 99,
                  background: O.glass,
                  border: `1px solid ${O.hair}`,
                  fontSize: 11,
                  fontWeight: 500,
                  color: O.ink2,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <ExternalLink style={{ width: 11, height: 11 }} />
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

      {/* TABS */}
      <div
        style={{
          ...panel({ borderRadius: 16 }),
          padding: 5,
          display: "flex",
          gap: 4,
        }}
      >
        {visibleTabs.map((t) => {
          const isActive = activeTab === t.value;
          return (
            <button
              key={t.value}
              onClick={() => setActiveTab(t.value)}
              style={{
                flex: 1,
                textAlign: "center",
                padding: "10px 0",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                background: isActive ? auroraSoft : "transparent",
                border: isActive
                  ? `1px solid ${O.hair2}`
                  : "1px solid transparent",
                color: isActive ? O.ink : O.ink3,
                fontFamily: "inherit",
                transition: "all 0.15s",
              }}
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
              <div
                style={{
                  marginBottom: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontFamily: O.mono,
                    letterSpacing: "0.14em",
                    color: "#ffd76a",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    paddingLeft: 8,
                  }}
                >
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
              <div
                style={{ display: "flex", flexDirection: "column", gap: 8 }}
              >
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
            <ClipsGrid clips={clips} />
          ))}

        {activeTab === "likes" &&
          (loadingLikes ? (
            <ListSkeleton />
          ) : likedPosts.length === 0 ? (
            <EmptyTab />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {repostedPosts.map((p: any) => (
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
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {savedPosts.map((p: any) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          ))}
      </div>

      {vods.length > 0 && <PastStreamsSection vods={vods} />}

      <FollowListDialog
        open={
          followListOpen !== null &&
          (isOwnProfile || !profile.private_followers)
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

function PastStreamsSection({ vods }: { vods: VodRow[] }) {
  return (
    <div style={{ ...panel(), padding: 24, marginTop: 4 }}>
      <div style={{ marginBottom: 18 }}>
        <Eyebrow accent>◇&nbsp;&nbsp;PAST STREAMS</Eyebrow>
        <Display size={22} style={{ marginTop: 8 }}>
          On the <Acc>record</Acc>
        </Display>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        {vods.map((vod) => (
          <VodCard key={vod.id} vod={vod} />
        ))}
      </div>
    </div>
  );
}

function VodCard({ vod }: { vod: VodRow }) {
  return (
    <Link
      href={`/vod/${vod.id}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "16 / 9",
          borderRadius: 14,
          overflow: "hidden",
          background: O.glass,
          border: `1px solid ${O.hair}`,
        }}
      >
        {vod.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={vod.thumbnail_url}
            alt={vod.title ?? "Past stream"}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: auroraSoft,
            }}
          />
        )}
        {vod.duration_seconds ? (
          <span
            style={{
              position: "absolute",
              bottom: 8,
              right: 8,
              padding: "3px 8px",
              borderRadius: 8,
              background: "rgba(0,0,0,0.7)",
              backdropFilter: "blur(8px)",
              color: O.ink,
              fontFamily: O.mono,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.02em",
            }}
          >
            {formatDuration(vod.duration_seconds)}
          </span>
        ) : null}
      </div>
      <div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: O.ink,
            lineHeight: 1.35,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {vod.title ?? "Untitled stream"}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            marginTop: 6,
          }}
        >
          {vod.category && (
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 99,
                background: O.glass,
                border: `1px solid ${O.hair}`,
                fontSize: 10.5,
                color: O.ink2,
                fontWeight: 500,
              }}
            >
              {vod.category}
            </span>
          )}
          <span
            style={{
              fontSize: 11.5,
              color: O.ink3,
              fontFamily: O.mono,
              letterSpacing: "0.04em",
            }}
          >
            {fmtNumber(vod.view_count)} views · {timeAgo(vod.created_at)}
          </span>
        </div>
      </div>
    </Link>
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
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 6,
      }}
    >
      {clips.map((clip) => {
        const video = clip.post_media?.find((m) => m.type === "video");
        const thumb = video?.thumbnail_url ?? null;
        return (
          <Link
            key={clip.id}
            href={`/post/${clip.id}`}
            style={{
              position: "relative",
              aspectRatio: "9 / 16",
              overflow: "hidden",
              borderRadius: 10,
              background: O.glass,
              border: `1px solid ${O.hair}`,
              display: "block",
              textDecoration: "none",
            }}
          >
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumb}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : video?.url ? (
              <video
                src={video.url}
                muted
                playsInline
                preload="metadata"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: auroraSoft,
                }}
              />
            )}
            {(clip.view_count ?? 0) > 0 && (
              <div
                style={{
                  position: "absolute",
                  bottom: 6,
                  left: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  color: "white",
                  textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                }}
              >
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
    <div
      style={{
        textAlign: "center",
        padding: "60px 20px",
        color: O.ink3,
      }}
    >
      <Eyebrow>◇&nbsp;&nbsp;NOTHING HERE YET</Eyebrow>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          style={{ ...panel(), padding: 16, display: "flex", gap: 12 }}
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
