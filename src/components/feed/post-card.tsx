"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
  Trash2,
  Flag,
  Repeat2,
  Pencil,
  Check,
  X,
  Pin,
  PinOff,
  Rocket,
  Sparkles,
  MapPin,
  AlertTriangle,
  Eye,
  Users,
  ShieldBan,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/shared/user-avatar";
import { formatTimeAgo, formatNumber } from "@/lib/utils/format";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  toggleLike,
  toggleBookmark,
  deletePost,
  createRepost,
  undoRepost,
  updatePost,
  votePoll,
  getUserPollVote,
  getOriginalPost,
  pinPost,
  unpinPost,
  type PostWithAuthor,
  type PollData,
} from "@/lib/queries/posts";
import {
  addReaction,
  removeReaction,
  getUserReaction,
  getPostReactions,
  REACTION_EMOJI,
  type ReactionType,
  type ReactionCount,
} from "@/lib/queries/reactions";
import { boostPost } from "@/lib/queries/boost";
import { ShareDialog } from "@/components/shared/share-dialog";
import { BlockMuteDialog } from "@/components/shared/block-mute-dialog";
import { ReportDialog } from "@/components/shared/report-dialog";
import { ReactionPicker, ReactionCountsDisplay } from "./reaction-picker";
import { PostInsights, computeUserAverages } from "./post-insights";
import { AudioPlayer } from "@/components/feed/audio-player";
import { isAudioMediaItem } from "@/lib/utils/audio";
import { O, panel } from "@/lib/design/orbit";
import { VerifiedStar } from "@/components/orbit/verified-star";

interface PostCardProps {
  post: PostWithAuthor;
  isLiked?: boolean;
  isBookmarked?: boolean;
  isReposted?: boolean;
  repostedByUsername?: string;
  onUpdate?: () => void;
  compact?: boolean;
  /** All posts in the current feed — used to compute user averages for insights. */
  allUserPosts?: PostWithAuthor[];
}

export function PostCard({
  post,
  isLiked: initialIsLiked = false,
  isBookmarked: initialIsBookmarked = false,
  isReposted: initialIsReposted = false,
  repostedByUsername,
  onUpdate,
  compact = false,
  allUserPosts,
}: PostCardProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [isBookmarked, setIsBookmarked] = useState(initialIsBookmarked);
  const [isReposted, setIsReposted] = useState(initialIsReposted);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [repostCount, setRepostCount] = useState(post.repost_count);
  const [bookmarkCount, setBookmarkCount] = useState(post.bookmark_count);
  const [animateHeart, setAnimateHeart] = useState(false);

  // Sync interaction state when props change (e.g., when interactions load async)
  useEffect(() => { setIsLiked(initialIsLiked); }, [initialIsLiked]);
  useEffect(() => { setIsBookmarked(initialIsBookmarked); }, [initialIsBookmarked]);
  useEffect(() => { setIsReposted(initialIsReposted); }, [initialIsReposted]);
  // Keep local counts in sync when the post prop changes (e.g., refetch
  // after navigating to /post/:id). Without this, a fresh authoritative
  // count from the server would be ignored in favor of the initial
  // useState value, making the count look like it "disappeared".
  useEffect(() => { setLikeCount(post.like_count); }, [post.like_count]);
  useEffect(() => { setRepostCount(post.repost_count); }, [post.repost_count]);
  useEffect(() => { setBookmarkCount(post.bookmark_count); }, [post.bookmark_count]);
  const [shareOpen, setShareOpen] = useState(false);
  const [blockMuteOpen, setBlockMuteOpen] = useState(false);
  const [blockMuteAction, setBlockMuteAction] = useState<"block" | "mute">("block");
  const [reportOpen, setReportOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content || "");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const [displayedContent, setDisplayedContent] = useState(post.content);

  // Poll state
  const [userVote, setUserVote] = useState<number | null>(null);
  const [pollData, setPollData] = useState<PollData | null>(post.poll_data);
  const [isVoting, setIsVoting] = useState(false);

  // Reaction state
  const [userReaction, setUserReaction] = useState<ReactionType | null>(null);
  const [reactionCounts, setReactionCounts] = useState<ReactionCount[]>([]);

  // Repost: load original post if this is a repost
  const [originalPost, setOriginalPost] = useState<PostWithAuthor | null>(null);
  const isRepostType = post.type === "repost" && post.parent_post_id;

  useEffect(() => {
    if (isRepostType && post.parent_post_id) {
      getOriginalPost(post.parent_post_id).then(setOriginalPost).catch(() => {});
    }
  }, [isRepostType, post.parent_post_id]);

  // Load reactions
  useEffect(() => {
    getPostReactions(post.id).then(setReactionCounts).catch(() => {});
    if (user) {
      getUserReaction(user.id, post.id).then(setUserReaction).catch(() => {});
    }
  }, [user, post.id]);

  // Load user's poll vote
  useEffect(() => {
    if (user && post.poll_data && post.type === "poll") {
      getUserPollVote(user.id, post.id).then((vote) => {
        setUserVote(vote);
      }).catch(() => {});
    }
  }, [user, post.id, post.poll_data, post.type]);

  const isOwnPost = user?.id === post.user_id;
  const profile = post.profiles;
  const hasMedia = post.post_media && post.post_media.length > 0;
  const audioMedia = hasMedia
    ? post.post_media.filter((m) => isAudioMediaItem(m.url))
    : [];
  const nonAudioMedia = hasMedia
    ? post.post_media.filter((m) => !isAudioMediaItem(m.url))
    : [];
  const hasAudioMedia = audioMedia.length > 0;
  const hasNonAudioMedia = nonAudioMedia.length > 0;

  // For reposts, display the original post content
  const displayPost = isRepostType && originalPost ? originalPost : post;
  const displayProfile = isRepostType && originalPost ? originalPost.profiles : profile;
  const displayHasMedia = isRepostType && originalPost
    ? originalPost.post_media && originalPost.post_media.length > 0
    : hasMedia;

  // Compute averages from sibling posts by the same author for insights comparison
  const userAverages = useMemo(() => {
    if (!isOwnPost || !allUserPosts) return undefined;
    const ownPosts = allUserPosts.filter((p) => p.user_id === post.user_id);
    return computeUserAverages(ownPosts);
  }, [isOwnPost, allUserPosts, post.user_id]);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { toast.error("Sign in to like posts"); return; }
    const was = isLiked;
    setIsLiked(!was);
    setLikeCount((c) => (was ? c - 1 : c + 1));
    if (!was) { setAnimateHeart(true); setTimeout(() => setAnimateHeart(false), 400); }
    try { await toggleLike(user.id, post.id, was); }
    catch { setIsLiked(was); setLikeCount((c) => (was ? c + 1 : c - 1)); }
  };

  const handleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { toast.error("Sign in to save posts"); return; }
    const was = isBookmarked;
    setIsBookmarked(!was);
    setBookmarkCount((c) => (was ? Math.max(c - 1, 0) : c + 1));
    try { await toggleBookmark(user.id, post.id, was); }
    catch {
      setIsBookmarked(was);
      setBookmarkCount((c) => (was ? c + 1 : Math.max(c - 1, 0)));
    }
  };

  const handleDelete = async () => {
    try { await deletePost(post.id); toast.success("Post deleted"); onUpdate?.(); }
    catch { toast.error("Failed to delete post"); }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShareOpen(true);
  };

  const handleRepost = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { toast.error("Sign in to repost"); return; }
    if (isOwnPost) { toast.error("You can't repost your own post"); return; }

    const was = isReposted;
    setIsReposted(!was);
    setRepostCount((c) => (was ? c - 1 : c + 1));

    try {
      if (was) {
        await undoRepost(user.id, post.id);
        toast.success("Repost removed");
      } else {
        await createRepost(user.id, post.id);
        toast.success("Reposted!");
      }
      onUpdate?.();
    } catch (err: any) {
      setIsReposted(was);
      setRepostCount((c) => (was ? c + 1 : c - 1));
      if (err?.message === "Already reposted") {
        toast.error("You already reposted this");
      } else {
        toast.error("Failed to repost");
      }
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditContent(displayedContent || "");
    setIsEditing(true);
  };

  const handleSaveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSavingEdit) return;
    setIsSavingEdit(true);
    try {
      await updatePost(post.id, editContent.trim());
      setDisplayedContent(editContent.trim());
      setIsEditing(false);
      toast.success("Post updated");
      onUpdate?.();
    } catch {
      toast.error("Failed to update post");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
    setEditContent(displayedContent || "");
  };

  const handleReaction = async (type: ReactionType) => {
    if (!user) { toast.error("Sign in to react"); return; }

    if (userReaction === type) {
      // Remove reaction
      setUserReaction(null);
      setReactionCounts((prev) =>
        prev
          .map((r) =>
            r.reaction_type === type ? { ...r, count: r.count - 1 } : r
          )
          .filter((r) => r.count > 0)
      );
      try { await removeReaction(user.id, post.id); }
      catch {
        setUserReaction(type);
        setReactionCounts((prev) => {
          const existing = prev.find((r) => r.reaction_type === type);
          if (existing) return prev.map((r) => r.reaction_type === type ? { ...r, count: r.count + 1 } : r);
          return [...prev, { reaction_type: type, count: 1 }];
        });
      }
    } else {
      // Add/change reaction
      const prevReaction = userReaction;
      setUserReaction(type);
      setReactionCounts((prev) => {
        let updated = prev.map((r) => {
          if (r.reaction_type === prevReaction) return { ...r, count: r.count - 1 };
          if (r.reaction_type === type) return { ...r, count: r.count + 1 };
          return r;
        }).filter((r) => r.count > 0);
        if (!updated.find((r) => r.reaction_type === type)) {
          updated = [...updated, { reaction_type: type, count: 1 }];
        }
        return updated;
      });
      try { await addReaction(user.id, post.id, type); }
      catch {
        setUserReaction(prevReaction);
        getPostReactions(post.id).then(setReactionCounts).catch(() => {});
      }
    }
  };

  const handlePin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (post.is_pinned) {
        await unpinPost(post.id);
        toast.success("Post unpinned");
      } else {
        await pinPost(post.id);
        toast.success("Post pinned to profile");
      }
      onUpdate?.();
    } catch {
      toast.error("Failed to update pin");
    }
  };

  const handleBoost = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await boostPost(post.id, 24);
      toast.success("Post boosted for 24 hours!");
      onUpdate?.();
    } catch {
      toast.error("Failed to boost post");
    }
  };

  const isBoosted = !!(post as PostWithAuthor & { boosted_until?: string | null }).boosted_until &&
    new Date((post as PostWithAuthor & { boosted_until?: string | null }).boosted_until!) > new Date();

  const handlePollVote = async (e: React.MouseEvent, optionIndex: number) => {
    e.stopPropagation();
    if (!user) { toast.error("Sign in to vote"); return; }
    if (userVote !== null || isVoting) return;

    setIsVoting(true);
    try {
      await votePoll(user.id, post.id, optionIndex);
      setUserVote(optionIndex);
      if (pollData) {
        const updated = { ...pollData, options: pollData.options.map((opt, i) => ({
          ...opt,
          votes: i === optionIndex ? opt.votes + 1 : opt.votes,
        })) };
        setPollData(updated);
      }
      toast.success("Vote recorded!");
    } catch (err: any) {
      if (err?.message === "Already voted") {
        toast.error("You already voted on this poll");
      } else {
        toast.error("Failed to vote");
      }
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <article
      className={!compact ? "cursor-pointer" : undefined}
      style={{
        ...panel(),
        padding: compact ? 16 : 22,
        position: "relative",
        color: O.ink,
        fontFamily: O.sans,
      }}
      onClick={
        compact
          ? undefined
          : (e) => {
              // Ignore clicks that bubble from portaled descendants
              // (dropdown menus, dialogs). React events bubble through
              // the virtual tree even from portals — without this guard,
              // closing the Block/Mute/Report dialog navigates to the post.
              const target = e.target as Node;
              if (!e.currentTarget.contains(target)) return;
              router.push(`/post/${displayPost.id}`);
            }
      }
    >
      {/* Pinned / NEAR YOU — absolute top-right */}
      {post.is_pinned && !compact && (
        <div
          style={{
            position: "absolute",
            top: 18,
            right: 22,
            fontFamily: O.mono,
            fontSize: 10,
            letterSpacing: "0.14em",
            color: O.a3,
            fontWeight: 500,
            pointerEvents: "none",
          }}
        >
          ◆&nbsp;&nbsp;NEAR YOU
        </div>
      )}

      {/* Boosted indicator */}
      {isBoosted && (
        <div className="flex items-center gap-1.5 mb-2" style={{ color: "#ffd76a", fontFamily: O.mono, fontSize: 10.5, letterSpacing: "0.1em" }}>
          <Sparkles className="h-3 w-3" />
          <span>PROMOTED</span>
        </div>
      )}

      {/* Repost indicator */}
      {(isRepostType || repostedByUsername) && (
        <div className="flex items-center gap-2 mb-2" style={{ color: O.ink3, fontSize: 12.5 }}>
          <Repeat2 className="h-3.5 w-3.5" />
          <span>Reposted by @{repostedByUsername || profile.username}</span>
        </div>
      )}

      <div className="flex" style={{ gap: 12, marginBottom: 14 }}>
        {/* Avatar */}
        <Link href={`/${displayProfile.username}`} onClick={(e) => e.stopPropagation()} className="shrink-0">
          <UserAvatar src={displayProfile.avatar_url} fallback={displayProfile.display_name} size="md" />
        </Link>

        <div className="flex-1 min-w-0">
          {/* Header: name + verified, subline, right-side hashtag + menu */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Link
                  href={`/${displayProfile.username}`}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: O.ink,
                    textDecoration: "none",
                    letterSpacing: "-0.005em",
                  }}
                  className="truncate hover:underline"
                >
                  {displayProfile.display_name}
                </Link>
                {displayProfile.is_verified && <VerifiedStar size={12} />}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: O.ink3,
                  fontFamily: O.sans,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  flexWrap: "wrap",
                  marginTop: 2,
                }}
              >
                <span>@{displayProfile.username}</span>
                <span style={{ color: O.ink4 }}>·</span>
                <span>{formatTimeAgo(post.created_at)}</span>
                {displayPost.location && (
                  <>
                    <span style={{ color: O.ink4 }}>·</span>
                    <Link
                      href={`/location/${encodeURIComponent(displayPost.location)}`}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        color: O.ink4,
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      via {displayPost.location}
                    </Link>
                  </>
                )}
              </div>
            </div>

            <div className="shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger onClick={(e) => e.stopPropagation()}>
                  <div className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-white/[0.06] transition-colors">
                    <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isOwnPost ? (
                    <>
                      <DropdownMenuItem onClick={handleEdit}>
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      {/* Pin to Profile + Boost don't apply inside a
                          room — that's profile-level promotion that
                          would lift a private/scoped post out of its
                          room context. */}
                      {!displayPost.community_id && (
                        <>
                          <DropdownMenuItem onClick={handlePin}>
                            {post.is_pinned ? (
                              <><PinOff className="mr-2 h-4 w-4" /> Unpin from Profile</>
                            ) : (
                              <><Pin className="mr-2 h-4 w-4" /> Pin to Profile</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleBoost}>
                            <Rocket className="mr-2 h-4 w-4" /> Boost Post
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(); }} className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setBlockMuteAction("block"); setBlockMuteOpen(true); }}>
                        <ShieldBan className="mr-2 h-4 w-4" /> Block
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setBlockMuteAction("mute"); setBlockMuteOpen(true); }}>
                        <VolumeX className="mr-2 h-4 w-4" /> Mute
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setReportOpen(true);
                        }}
                      >
                        <Flag className="mr-2 h-4 w-4" /> Report
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Close Friends badge */}
          {displayPost.visibility === "close_friends" && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Users className="h-3 w-3" />
                Close Friends
              </span>
            </div>
          )}

          {/* Content Warning */}
          {displayPost.content_warning && !spoilerRevealed && (
            <div className="mt-2" onClick={(e) => e.stopPropagation()}>
              <div className="rounded-xl bg-amber-500/[0.06] border border-amber-500/20 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                  <span className="text-sm font-medium text-amber-300">
                    {displayPost.content_warning}
                  </span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setSpoilerRevealed(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 transition-colors"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Show Content
                </button>
              </div>
            </div>
          )}

          {/* Content area */}
          <div>
          {(!displayPost.content_warning || spoilerRevealed) && (
            <>
              {isEditing ? (
                <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="min-h-[60px] text-[15px] leading-relaxed bg-white/[0.04] border-white/[0.1] rounded-lg resize-none"
                    autoFocus
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={handleSaveEdit}
                      disabled={isSavingEdit || !editContent.trim()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 transition-colors"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-white hover:bg-white/[0.06] transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                (displayedContent || displayPost.content) && (
                  <div className="mt-1.5">
                    <PostContent content={displayedContent || displayPost.content || ""} />
                  </div>
                )
              )}
            </>
          )}

          {/* Poll Display (hidden behind spoiler) */}
          {(!displayPost.content_warning || spoilerRevealed) && displayPost.type === "poll" && pollData && (
            <PollDisplay
              pollData={pollData}
              userVote={userVote}
              isVoting={isVoting}
              onVote={handlePollVote}
            />
          )}

          {/* Audio Media (hidden behind spoiler) */}
          {(!displayPost.content_warning || spoilerRevealed) && displayHasMedia && displayPost.post_media.some((m) => isAudioMediaItem(m.url)) && (
            <div className="mt-3" onClick={(e) => e.stopPropagation()}>
              {displayPost.post_media
                .filter((m) => isAudioMediaItem(m.url))
                .map((m) => (
                  <AudioPlayer key={m.id} src={m.url} />
                ))}
            </div>
          )}

          {/* Image/Video Media (hidden behind spoiler) */}
          {(!displayPost.content_warning || spoilerRevealed) && displayHasMedia && displayPost.post_media.some((m) => !isAudioMediaItem(m.url)) && (() => {
            const visualMedia = displayPost.post_media
              .filter((m) => !isAudioMediaItem(m.url))
              .sort((a, b) => a.sort_order - b.sort_order);
            const isMulti = visualMedia.length > 1;
            return (
              <div
                className={cn(
                  "mt-3 rounded-2xl overflow-hidden border border-white/[0.06] shadow-md shadow-black/20",
                  isMulti && "grid gap-0.5",
                  visualMedia.length === 2 && "grid-cols-2",
                  visualMedia.length >= 3 && "grid-cols-2 grid-rows-2",
                )}
                style={!isMulti ? { background: "rgba(0,0,0,0.4)" } : undefined}
                onClick={(e) => e.stopPropagation()}
              >
                {visualMedia.map((m, i) => {
                  const isVideo = m.type === "video" || m.type === "gif";
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "overflow-hidden flex items-center justify-center",
                        visualMedia.length === 3 && i === 0 && "row-span-2",
                      )}
                      style={
                        !isMulti
                          ? { maxHeight: 520, width: "100%" }
                          : undefined
                      }
                    >
                      {isVideo ? (
                        <video
                          src={m.url}
                          poster={m.thumbnail_url || undefined}
                          controls
                          playsInline
                          preload="metadata"
                          className={
                            isMulti
                              ? "w-full h-full object-cover"
                              : "max-h-[520px] max-w-full"
                          }
                          style={
                            !isMulti
                              ? { width: "auto", height: "auto" }
                              : undefined
                          }
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.url}
                          alt=""
                          loading="lazy"
                          className={
                            isMulti
                              ? "w-full h-full object-cover"
                              : "max-h-[520px] max-w-full"
                          }
                          style={
                            !isMulti
                              ? { width: "auto", height: "auto" }
                              : undefined
                          }
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Reaction counts */}
          {reactionCounts.length > 0 && (
            <div onClick={(e) => e.stopPropagation()}>
              <ReactionCountsDisplay
                reactions={reactionCounts}
                userReaction={userReaction}
                onReactionClick={handleReaction}
              />
            </div>
          )}

          </div>{/* End of clickable content area */}

          {/* Actions — order: heart, chat, retweet, bookmark, [views] */}
          <div
            className="flex items-center"
            style={{ gap: 4, marginTop: 12, color: O.ink2, fontSize: 12.5 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Like */}
            <div className="relative">
              {!compact && <ReactionPicker onSelect={handleReaction} currentReaction={userReaction} />}
              <button
                onClick={handleLike}
                className={cn(
                  "flex items-center gap-1.5 rounded-full transition-colors",
                  userReaction || isLiked
                    ? "text-rose-400"
                    : "hover:text-rose-300 hover:bg-rose-500/10"
                )}
                style={{ padding: "6px 12px" }}
              >
                <motion.span animate={animateHeart ? { scale: [1, 1.3, 1] } : {}} transition={{ duration: 0.3 }}>
                  {userReaction ? (
                    <span style={{ fontSize: 15, lineHeight: 1 }}>{REACTION_EMOJI[userReaction]}</span>
                  ) : (
                    <Heart className={cn("h-[15px] w-[15px]", isLiked && "fill-current")} />
                  )}
                </motion.span>
                {likeCount > 0 && <span>{formatNumber(likeCount)}</span>}
              </button>
            </div>

            {/* Comment / Reply */}
            <button
              onClick={(e) => { e.stopPropagation(); if (!compact) router.push(`/post/${displayPost.id}`); }}
              className="flex items-center gap-1.5 rounded-full hover:text-sky-300 hover:bg-sky-500/10 transition-colors"
              style={{ padding: "6px 12px" }}
            >
              <MessageCircle className="h-[15px] w-[15px]" />
              {post.comment_count > 0 && <span>{formatNumber(post.comment_count)}</span>}
            </button>

            {/* Repost / Bookmark / Share — hidden inside rooms because
                room posts are scoped to that room and shouldn't be
                rebroadcast through repost or shared to outsiders. */}
            {!compact && !displayPost.community_id && (
              <button
                onClick={handleRepost}
                className={cn(
                  "flex items-center gap-1.5 rounded-full transition-colors",
                  isReposted ? "text-emerald-400" : "hover:text-emerald-300 hover:bg-emerald-500/10"
                )}
                style={{ padding: "6px 12px" }}
              >
                <Repeat2 className="h-[15px] w-[15px]" />
                {repostCount > 0 && <span>{formatNumber(repostCount)}</span>}
              </button>
            )}

            {!compact && !displayPost.community_id && (
              <button
                onClick={handleBookmark}
                className={cn(
                  "flex items-center gap-1.5 rounded-full transition-colors",
                  isBookmarked ? "text-amber-400" : "hover:text-amber-300 hover:bg-amber-500/10"
                )}
                style={{ padding: "6px 12px" }}
              >
                <Bookmark className={cn("h-[15px] w-[15px]", isBookmarked && "fill-current")} />
                {bookmarkCount > 0 && <span>{formatNumber(bookmarkCount)}</span>}
              </button>
            )}

            {!compact && !displayPost.community_id && (
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 rounded-full hover:text-sky-300 hover:bg-sky-500/10 transition-colors"
                style={{ padding: "6px 12px" }}
              >
                <Share2 className="h-[15px] w-[15px]" />
              </button>
            )}

          </div>

          {/* Post Insights — only visible to the author, not on comments */}
          {isOwnPost && !compact && (
            <PostInsights post={post} userAverages={userAverages} />
          )}
        </div>
      </div>
      <ShareDialog
        postId={displayPost.id}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
      {user && !isOwnPost && (
        <BlockMuteDialog
          open={blockMuteOpen}
          onOpenChange={setBlockMuteOpen}
          actionType={blockMuteAction}
          currentUserId={user.id}
          targetUserId={post.user_id}
          targetUsername={displayProfile.username}
          onSuccess={onUpdate}
        />
      )}
      {user && !isOwnPost && (
        <ReportDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          entityType="post"
          entityId={post.id}
          reportedUserId={post.user_id}
        />
      )}
    </article>
  );
}

function PollDisplay({
  pollData,
  userVote,
  isVoting,
  onVote,
}: {
  pollData: PollData;
  userVote: number | null;
  isVoting: boolean;
  onVote: (e: React.MouseEvent, optionIndex: number) => void;
}) {
  const totalVotes = pollData.options.reduce((sum, opt) => sum + opt.votes, 0);
  const hasVoted = userVote !== null;
  const isEnded = pollData.ends_at ? new Date(pollData.ends_at) < new Date() : false;
  const showResults = hasVoted || isEnded;

  return (
    <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
      {pollData.options.map((option, index) => {
        const percentage = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
        const isSelected = userVote === index;

        return (
          <button
            key={index}
            onClick={(e) => onVote(e, index)}
            disabled={hasVoted || isEnded || isVoting}
            className={cn(
              "relative w-full text-left rounded-lg border transition-all overflow-hidden",
              showResults
                ? "border-white/[0.08] cursor-default"
                : "border-white/[0.12] hover:border-blue-500/50 cursor-pointer",
              isSelected && "border-blue-500/40"
            )}
          >
            {showResults && (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className={cn(
                  "absolute inset-y-0 left-0 rounded-lg",
                  isSelected ? "bg-blue-500/20" : "bg-white/[0.06]"
                )}
              />
            )}

            <div className="relative flex items-center justify-between px-3 py-2.5">
              <span className={cn(
                "text-[14px]",
                isSelected ? "font-semibold text-blue-400" : "text-zinc-200"
              )}>
                {option.text}
              </span>
              {showResults && (
                <span className={cn(
                  "text-[13px] font-medium ml-2",
                  isSelected ? "text-blue-400" : "text-muted-foreground"
                )}>
                  {percentage}%
                </span>
              )}
            </div>
          </button>
        );
      })}

      <div className="flex items-center gap-2 text-[12px] text-muted-foreground pt-1">
        <span>{formatNumber(totalVotes)} vote{totalVotes !== 1 ? "s" : ""}</span>
        {pollData.ends_at && (
          <>
            <span>·</span>
            <span>{isEnded ? "Final results" : `Ends ${formatTimeAgo(pollData.ends_at)}`}</span>
          </>
        )}
      </div>
    </div>
  );
}

function PostContent({ content }: { content: string }) {
  const parts = content.split(/([@#]\w+)/g);
  return (
    <p className="text-[15px] leading-[1.6] whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        if (part.startsWith("#")) {
          const tag = part.slice(1);
          return <Link key={i} href={`/hashtag/${encodeURIComponent(tag)}`} onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">{part}</Link>;
        }
        if (part.startsWith("@")) return <Link key={i} href={`/${part.slice(1)}`} onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">{part}</Link>;
        return part;
      })}
    </p>
  );
}
