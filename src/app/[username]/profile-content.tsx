"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MoreHorizontal, ExternalLink, Star } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  getUserPosts,
  getUserLikedPosts,
  getUserBookmarkedPosts,
  getUserRepostedPosts,
  getUserPinnedPosts,
} from "@/lib/queries/posts";
import { PostCard } from "@/components/feed/post-card";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { AvatarBorderStyle } from "@/components/shared/user-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { O, aurora, auroraSoft, panel } from "@/lib/design/orbit";
import { Display, Acc, Eyebrow, PillBtn } from "@/components/orbit/primitives";

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
  };
  isOwnProfile: boolean;
  initialIsFollowing: boolean;
}

const TABS = [
  { value: "posts", label: "Posts" },
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
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();

  const { data: pinnedPosts = [] } = useQuery({
    queryKey: ["user-pinned-posts", profile.id],
    queryFn: () => getUserPinnedPosts(profile.id),
    staleTime: 1000 * 60 * 2,
  });

  const { data: posts = [] } = useQuery({
    queryKey: ["user-posts", profile.id],
    queryFn: () => getUserPosts(profile.id),
    staleTime: 1000 * 60 * 2,
  });

  const { data: likedPosts = [], isLoading: loadingLikes } = useQuery({
    queryKey: ["user-liked-posts", profile.id],
    queryFn: () => getUserLikedPosts(profile.id),
    enabled: activeTab === "likes",
    staleTime: 1000 * 60,
  });

  const { data: repostedPosts = [], isLoading: loadingReposts } = useQuery({
    queryKey: ["user-reposted-posts", profile.id],
    queryFn: () => getUserRepostedPosts(profile.id),
    enabled: activeTab === "reposts",
    staleTime: 1000 * 60,
  });

  const { data: savedPosts = [], isLoading: loadingSaved } = useQuery({
    queryKey: ["user-saved-posts", profile.id],
    queryFn: () => getUserBookmarkedPosts(profile.id),
    enabled: activeTab === "saved" && isOwnProfile,
    staleTime: 1000 * 60,
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

  const visibleTabs = useMemo(
    () => (isOwnProfile ? TABS : TABS.filter((t) => t.value !== "saved")),
    [isOwnProfile],
  );

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
      {/* Mobile back */}
      <button
        onClick={() => router.back()}
        className="lg:hidden absolute top-3 left-3 z-20 h-10 w-10 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>

      {/* HERO PANEL */}
      <div
        style={{
          ...panel(),
          padding: 0,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Banner */}
        <div
          style={{
            height: 200,
            background: profile.cover_url
              ? `url(${profile.cover_url}) center/cover`
              : aurora,
            position: "relative",
          }}
        >
          {!profile.cover_url && (
            <>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "radial-gradient(ellipse at 30% 30%, rgba(255,255,255,0.35), transparent 60%)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "repeating-linear-gradient(135deg, transparent 0 40px, rgba(255,255,255,0.05) 40px 41px)",
                }}
              />
            </>
          )}
        </div>

        {/* Identity row */}
        <div
          style={{
            padding: "0 32px 24px",
            marginTop: -68,
            display: "flex",
            alignItems: "flex-end",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              width: 136,
              height: 136,
              borderRadius: "50%",
              padding: 5,
              background: O.bg,
              boxShadow: `0 16px 40px rgba(0,0,0,0.5), 0 0 0 2px ${accent}`,
              flexShrink: 0,
            }}
          >
            <UserAvatar
              src={profile.avatar_url}
              fallback={profile.display_name}
              size="xl"
              avatarBorder={avatarBorder}
            />
          </div>

          <div style={{ flex: 1, paddingBottom: 14, minWidth: 0 }}>
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
                    {first} <Acc>{rest}</Acc>
                  </>
                ) : (
                  first
                )}
              </Display>
              {profile.is_verified && (
                <Star
                  fill={O.a3}
                  stroke={O.a3}
                  style={{ width: 18, height: 18 }}
                />
              )}
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
              {profile.location && ` · ${profile.location}`} · ON ORBIT SINCE{" "}
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
              paddingBottom: 14,
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
            <PillBtn
              size="lg"
              style={{ width: 44, justifyContent: "center", padding: "14px 0" }}
            >
              <MoreHorizontal style={{ width: 16, height: 16 }} />
            </PillBtn>
          </div>
        </div>

        {/* Stats strip */}
        <div
          style={{
            display: "flex",
            gap: 0,
            padding: "0 32px 24px",
            borderTop: `1px solid ${O.hair}`,
            paddingTop: 20,
            flexWrap: "wrap",
            rowGap: 14,
          }}
        >
          {[
            ["posts", profile.post_count],
            ["orbit", profile.follower_count],
            ["mutuals", profile.following_count],
          ].map(([label, n], i) => (
            <div
              key={label as string}
              style={{
                flex: 1,
                minWidth: 90,
                paddingLeft: i ? 24 : 0,
                borderLeft: i ? `1px solid ${O.hair}` : "none",
              }}
            >
              <div
                style={{
                  fontFamily: O.serif,
                  fontStyle: "italic",
                  fontSize: 30,
                  fontWeight: 400,
                  lineHeight: 1,
                  background: aurora,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {fmtNumber(n as number)}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: O.ink3,
                  marginTop: 4,
                  fontFamily: O.mono,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                {label as string}
              </div>
            </div>
          ))}
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
              <EmptyTab label="No posts yet" />
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

        {activeTab === "likes" &&
          (loadingLikes ? (
            <ListSkeleton />
          ) : likedPosts.length === 0 ? (
            <EmptyTab label="No likes yet" />
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
            <EmptyTab label="No reposts yet" />
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
            <EmptyTab label="Nothing saved yet" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {savedPosts.map((p: any) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}

function EmptyTab({ label }: { label: string }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "60px 20px",
        color: O.ink3,
      }}
    >
      <Eyebrow>◇&nbsp;&nbsp;NOTHING HERE YET</Eyebrow>
      <p style={{ fontSize: 14, marginTop: 12 }}>{label}</p>
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
