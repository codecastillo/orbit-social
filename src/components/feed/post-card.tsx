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
import { ReactionPicker, ReactionCountsDisplay } from "./reaction-picker";
import { PostInsights, computeUserAverages } from "./post-insights";
import { AudioPlayer } from "@/components/feed/audio-player";
import { isAudioMediaItem } from "@/lib/utils/audio";

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
  const [animateHeart, setAnimateHeart] = useState(false);

  // Sync interaction state when props change (e.g., when interactions load async)
  useEffect(() => { setIsLiked(initialIsLiked); }, [initialIsLiked]);
  useEffect(() => { setIsBookmarked(initialIsBookmarked); }, [initialIsBookmarked]);
  useEffect(() => { setIsReposted(initialIsReposted); }, [initialIsReposted]);
  const [shareOpen, setShareOpen] = useState(false);
  const [blockMuteOpen, setBlockMuteOpen] = useState(false);
  const [blockMuteAction, setBlockMuteAction] = useState<"block" | "mute">("block");
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
    try { await toggleBookmark(user.id, post.id, was); }
    catch { setIsBookmarked(was); }
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
      className="p-4 transition-colors hover:bg-white/[0.02]"
    >
      {/* Boosted indicator */}
      {isBoosted && (
        <div className="flex items-center gap-1.5 ml-10 mb-1 text-[11px] text-amber-400/80 font-medium">
          <Sparkles className="h-3 w-3" />
          <span>Promoted</span>
        </div>
      )}

      {/* Repost indicator */}
      {(isRepostType || repostedByUsername) && (
        <div className="flex items-center gap-2 ml-10 mb-1 text-[13px] text-muted-foreground">
          <Repeat2 className="h-3.5 w-3.5" />
          <span>
            Reposted by @{repostedByUsername || profile.username}
          </span>
        </div>
      )}

      {/* Pinned indicator */}
      {post.is_pinned && (
        <div className="flex items-center gap-1.5 ml-10 mb-1 text-[11px] text-muted-foreground font-medium">
          <Pin className="h-3 w-3" />
          <span>Pinned</span>
        </div>
      )}

      <div className="flex gap-3">
        {/* Avatar */}
        <Link href={`/${displayProfile.username}`} onClick={(e) => e.stopPropagation()} className="shrink-0 pt-0.5">
          <UserAvatar src={displayProfile.avatar_url} fallback={displayProfile.display_name} size="md" />
        </Link>

        <div className="flex-1 min-w-0">
          {/* Header: name, username, time, menu */}
          <div className="flex items-center gap-1.5">
            <Link href={`/${displayProfile.username}`} onClick={(e) => e.stopPropagation()} className="font-bold text-[15px] hover:underline truncate">
              {displayProfile.display_name}
            </Link>
            <span className="text-muted-foreground text-[13px] truncate">@{displayProfile.username}</span>
            {displayPost.location && (
              <Link
                href={`/location/${encodeURIComponent(displayPost.location)}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-0.5 text-muted-foreground/60 text-[12px] hover:text-muted-foreground transition-colors shrink-0"
              >
                <MapPin className="h-3 w-3" />
                <span className="truncate max-w-[100px]">{displayPost.location}</span>
              </Link>
            )}
            <span className="text-muted-foreground/50 text-[13px] shrink-0">· {formatTimeAgo(post.created_at)}</span>

            <div className="ml-auto shrink-0">
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
                      <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
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

          {/* Content area — click navigates to post detail (not on comments) */}
          <div
            className={compact ? undefined : "cursor-pointer"}
            onClick={compact ? undefined : () => router.push(`/post/${displayPost.id}`)}
          >
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
          {(!displayPost.content_warning || spoilerRevealed) && displayHasMedia && displayPost.post_media.some((m) => !isAudioMediaItem(m.url)) && (
            <div
              className={cn(
                "mt-3 rounded-xl overflow-hidden border border-white/[0.06]",
                displayPost.post_media.filter((m) => !isAudioMediaItem(m.url)).length > 1 && "grid gap-0.5",
                displayPost.post_media.filter((m) => !isAudioMediaItem(m.url)).length === 2 && "grid-cols-2",
                displayPost.post_media.filter((m) => !isAudioMediaItem(m.url)).length >= 3 && "grid-cols-2 grid-rows-2",
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {displayPost.post_media
                .filter((m) => !isAudioMediaItem(m.url))
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((m, i) => {
                  const visualMedia = displayPost.post_media.filter((mm) => !isAudioMediaItem(mm.url));
                  return (
                    <div key={m.id} className={cn("overflow-hidden", visualMedia.length === 3 && i === 0 && "row-span-2")}>
                      <img src={m.url} alt="" className="w-full h-full object-cover max-h-[400px]" loading="lazy" />
                    </div>
                  );
                })}
            </div>
          )}

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

          {/* Actions */}
          <div className="flex items-center justify-between mt-3 -ml-2">
            {/* Left actions */}
            <div className="flex items-center gap-1">
              {/* Like */}
              <div className="relative" onMouseEnter={() => {}} onMouseLeave={() => {}}>
                {!compact && <ReactionPicker onSelect={handleReaction} currentReaction={userReaction} />}
                <button onClick={handleLike} className={cn("flex items-center gap-1.5 px-2 py-1.5 rounded-full text-[13px] transition-colors", userReaction ? "text-rose-500" : isLiked ? "text-rose-500" : "text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10")}>
                  <motion.span animate={animateHeart ? { scale: [1, 1.3, 1] } : {}} transition={{ duration: 0.3 }}>
                    {userReaction ? (
                      <span className="text-[16px] leading-none">{REACTION_EMOJI[userReaction]}</span>
                    ) : (
                      <Heart className={cn("h-[18px] w-[18px]", isLiked && "fill-current")} />
                    )}
                  </motion.span>
                  {likeCount > 0 && <span>{formatNumber(likeCount)}</span>}
                </button>
              </div>

              {/* Comment / Reply count */}
              <button onClick={(e) => { e.stopPropagation(); if (!compact) router.push(`/post/${displayPost.id}`); }} className="flex items-center gap-1.5 px-2 py-1.5 rounded-full text-[13px] text-muted-foreground hover:text-sky-400 hover:bg-sky-500/10 transition-colors">
                <MessageCircle className="h-[18px] w-[18px]" />
                {post.comment_count > 0 && <span>{formatNumber(post.comment_count)}</span>}
              </button>

              {/* Repost — only on full posts, not comments */}
              {!compact && (
                <button onClick={handleRepost} className={cn("flex items-center gap-1.5 px-2 py-1.5 rounded-full text-[13px] transition-colors", isReposted ? "text-emerald-500" : "text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10")}>
                  <Repeat2 className="h-[18px] w-[18px]" />
                  {repostCount > 0 && <span>{formatNumber(repostCount)}</span>}
                </button>
              )}

              {/* Share — only on full posts */}
              {!compact && (
                <button onClick={handleShare} className="flex items-center gap-1.5 px-2 py-1.5 rounded-full text-[13px] text-muted-foreground hover:text-sky-400 hover:bg-sky-500/10 transition-colors">
                  <Share2 className="h-[18px] w-[18px]" />
                </button>
              )}
            </div>

            {/* Bookmark — only on full posts */}
            {!compact && (
              <button onClick={handleBookmark} className={cn("p-1.5 rounded-full transition-colors", isBookmarked ? "text-amber-400" : "text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10")}>
                <Bookmark className={cn("h-[18px] w-[18px]", isBookmarked && "fill-current")} />
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
    <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
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
