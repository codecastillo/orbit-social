"use client";

import { FadeInImage as Image } from "@/components/shared/fade-in-image";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/shared/user-avatar";
import { VerifiedStar } from "@/components/orbit/verified-star";
import { formatTimeAgo } from "@/lib/utils/format";
import { isAudioMediaItem } from "@/lib/utils/audio";
import type { PostWithAuthor } from "@/lib/queries/posts";

interface QuotedPostCardProps {
  post: PostWithAuthor;
  onOpen?: () => void;
  className?: string;
}

// Quiet inset card embedded in quote posts (feed render) and the composer's
// quote preview. Renders only its own subject: a quote of a quote shows the
// quoted quote's text, never recurses into that post's own parent.
export function QuotedPostCard({ post, onOpen, className }: QuotedPostCardProps) {
  const profile = post.profiles;
  const mediaThumb = post.post_media?.find((m) => !isAudioMediaItem(m.url));

  return (
    <div
      role={onOpen ? "link" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={
        onOpen
          ? (e) => {
              e.stopPropagation();
              onOpen();
            }
          : undefined
      }
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onOpen();
              }
            }
          : undefined
      }
      className={cn(
        "rounded-xl border border-border bg-surface p-3",
        onOpen && "cursor-pointer transition-colors hover:bg-muted/40",
        className
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <UserAvatar
          src={profile.avatar_url}
          fallback={profile.display_name}
          size="sm"
        />
        <span className="truncate text-[13px] font-semibold text-foreground">
          {profile.display_name}
        </span>
        {profile.is_verified && <VerifiedStar size={11} />}
        <span className="shrink-0 text-[11.5px] text-muted-foreground">
          @{profile.username}
        </span>
        <span className="shrink-0 text-text-faint">·</span>
        <span className="shrink-0 text-[11.5px] text-muted-foreground">
          {formatTimeAgo(post.created_at)}
        </span>
      </div>

      {post.content && (
        <p className="mt-1.5 text-[13.5px] leading-[1.55] text-text-secondary line-clamp-4 whitespace-pre-wrap break-words">
          {post.content}
        </p>
      )}

      {mediaThumb && (
        <div className="relative mt-2 h-40 overflow-hidden rounded-lg border border-border bg-black/40">
          {mediaThumb.type === "video" || mediaThumb.type === "gif" ? (
            <video
              src={mediaThumb.url}
              poster={mediaThumb.thumbnail_url || undefined}
              muted
              playsInline
              preload="metadata"
              className="h-full w-full object-cover"
            />
          ) : (
            <Image
              src={mediaThumb.url}
              alt={mediaThumb.alt_text ?? ""}
              fill
              sizes="(max-width: 640px) 90vw, 560px"
              className="object-cover"
            />
          )}
        </div>
      )}
    </div>
  );
}

// Shown when a quote's parent was deleted (parent_post_id is null via
// ON DELETE SET NULL).
export function QuotedPostUnavailable({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface p-3 text-[13px] text-muted-foreground",
        className
      )}
    >
      This post is unavailable
    </div>
  );
}
