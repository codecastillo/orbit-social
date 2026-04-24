/**
 * Client-side feed ranking algorithm.
 * Re-sorts already-fetched posts using heuristic scoring.
 */

import type { PostWithAuthor } from "@/lib/queries/posts";

/** Map of user_id -> interaction count (likes on their posts). */
export type UserInteractions = Map<string, number>;

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

/** Exponential decay: returns 1.0 for brand-new posts, ~0 for very old ones. */
function recencyScore(createdAt: string): number {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  // Half-life of 12 hours
  return Math.pow(0.5, ageHours / 12);
}

/** Engagement rate: weighted interactions normalised by views. */
function engagementScore(post: PostWithAuthor): number {
  const weighted =
    post.like_count + post.comment_count * 2 + post.repost_count * 3;
  const views = Math.max(post.view_count, 1);
  // Cap at 1.0 to avoid outliers dominating
  return Math.min(weighted / views, 1.0);
}

/** Social proximity bonus based on how often the viewer has interacted. */
function socialProximityScore(
  post: PostWithAuthor,
  interactions: UserInteractions
): number {
  const count = interactions.get(post.user_id) ?? 0;
  if (count === 0) return 0;
  // Logarithmic scaling so diminishing returns
  return Math.min(Math.log2(count + 1) / 5, 1.0);
}

/** Small bonus for posts with media. */
function mediaBonus(post: PostWithAuthor): number {
  if (!post.post_media || post.post_media.length === 0) return 0;
  const hasVideo = post.post_media.some((m) => m.type === "video");
  return hasVideo ? 0.15 : 0.1;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Score a single post for feed ranking.
 *
 * @param post           The post to score
 * @param _userId        Current user id (reserved for future per-user tuning)
 * @param interactions   Map of author_id -> # of times user liked their posts
 * @returns A numeric score (higher = more relevant)
 */
export function scorePost(
  post: PostWithAuthor,
  _userId: string,
  interactions: UserInteractions
): number {
  const recency = recencyScore(post.created_at);
  const engagement = engagementScore(post);
  const social = socialProximityScore(post, interactions);
  const media = mediaBonus(post);

  // Weighted combination
  return recency * 0.4 + engagement * 0.25 + social * 0.25 + media * 0.1;
}

/**
 * Rank an array of posts using the scoring algorithm.
 * Also applies a diversity penalty so the same author doesn't appear
 * multiple times in a row.
 */
export function rankPosts(
  posts: PostWithAuthor[],
  userId: string,
  interactions: UserInteractions = new Map()
): PostWithAuthor[] {
  if (posts.length <= 1) return posts;

  // Score every post
  const scored = posts.map((post) => ({
    post,
    score: scorePost(post, userId, interactions),
  }));

  // Sort by raw score descending
  scored.sort((a, b) => b.score - a.score);

  // Diversity pass: penalise consecutive posts from the same author
  const result: PostWithAuthor[] = [];
  const recentAuthors: string[] = [];
  const WINDOW = 3; // look-back window

  // Greedy pick with diversity
  const remaining = [...scored];
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestAdjusted = -Infinity;

    for (let i = 0; i < Math.min(remaining.length, 10); i++) {
      let adjusted = remaining[i].score;
      // If this author appeared recently, apply a penalty
      const authorPos = recentAuthors.lastIndexOf(remaining[i].post.user_id);
      if (authorPos !== -1) {
        const distance = recentAuthors.length - authorPos;
        if (distance <= WINDOW) {
          adjusted *= 0.5 * (distance / WINDOW);
        }
      }
      if (adjusted > bestAdjusted) {
        bestAdjusted = adjusted;
        bestIdx = i;
      }
    }

    const picked = remaining.splice(bestIdx, 1)[0];
    result.push(picked.post);
    recentAuthors.push(picked.post.user_id);
    if (recentAuthors.length > WINDOW) recentAuthors.shift();
  }

  return result;
}
