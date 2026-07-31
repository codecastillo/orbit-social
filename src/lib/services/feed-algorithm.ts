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

const RECENCY_HALF_LIFE_HOURS = 12;
// Weighted engagement at which the log-dampened score saturates at 1.0.
const ENGAGEMENT_SATURATION = 500;
const BOOST_BONUS = 0.35;
// Cold start: authors below these thresholds get a decaying newness bonus
// for their first posts, so a first post is guaranteed distribution even
// with zero followers. Distribution is the creator-acquisition product.
const COLD_START_WINDOW_HOURS = 48;
const COLD_START_FOLLOWER_CEILING = 100;
const COLD_START_POST_CEILING = 5;
const COLD_START_MAX_BONUS = 0.3;
// content_preferences topic adjustments and the demotion applied to
// content-warning posts for viewers with sensitive_content_level "less".
const TOPIC_SEE_LESS_PENALTY = -0.2;
const TOPIC_SEE_MORE_BOOST = 0.1;
const SENSITIVE_DEMOTION = -0.25;

/** Viewer signals from content_preferences and the profile sensitivity level. */
export interface RankingSignals {
  seeMoreTopics: Set<string>;
  seeLessTopics: Set<string>;
  demoteSensitive: boolean;
}

function ageHours(createdAt: string): number {
  return (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
}

/** Exponential decay: returns 1.0 for brand-new posts, ~0 for very old ones. */
function recencyScore(createdAt: string): number {
  return Math.pow(0.5, ageHours(createdAt) / RECENCY_HALF_LIFE_HOURS);
}

/** Log-dampened weighted interactions so viral outliers cannot dominate. */
function engagementScore(post: PostWithAuthor): number {
  const weighted =
    post.like_count + post.comment_count * 2 + post.repost_count * 3;
  return Math.min(
    Math.log1p(weighted) / Math.log1p(ENGAGEMENT_SATURATION),
    1.0
  );
}

/**
 * Newness bonus for small authors' fresh posts. Fades linearly to zero over
 * the first 48 hours so it never pins a stale post to the top.
 */
function coldStartBonus(post: PostWithAuthor): number {
  const age = ageHours(post.created_at);
  if (age >= COLD_START_WINDOW_HOURS) return 0;

  const followers = post.profiles?.follower_count ?? 0;
  const authored = post.profiles?.post_count ?? 0;
  const isSmallAuthor =
    followers < COLD_START_FOLLOWER_CEILING || authored <= COLD_START_POST_CEILING;
  if (!isSmallAuthor) return 0;

  return COLD_START_MAX_BONUS * (1 - age / COLD_START_WINDOW_HOURS);
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

/**
 * Additive adjustment from the viewer's content preferences: a see_less
 * hashtag outweighs any see_more match, and sensitive (content-warning)
 * posts are demoted for viewers who chose to see less sensitive content.
 */
function preferenceAdjustment(
  post: PostWithAuthor,
  signals?: RankingSignals
): number {
  if (!signals) return 0;
  let adjustment = 0;
  const tags = (post.content?.match(/#(\w+)/g) ?? []).map((t) =>
    t.slice(1).toLowerCase()
  );
  if (tags.some((t) => signals.seeLessTopics.has(t))) {
    adjustment += TOPIC_SEE_LESS_PENALTY;
  } else if (tags.some((t) => signals.seeMoreTopics.has(t))) {
    adjustment += TOPIC_SEE_MORE_BOOST;
  }
  if (signals.demoteSensitive && post.content_warning) {
    adjustment += SENSITIVE_DEMOTION;
  }
  return adjustment;
}

/** Boost bonus: if the post is currently boosted, add a significant score bump. */
function boostBonus(post: PostWithAuthor): number {
  if (!post.boosted_until) return 0;
  if (new Date(post.boosted_until) <= new Date()) return 0;
  return BOOST_BONUS;
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
 * @param signals        Viewer content preferences; omitted for anon feeds
 * @returns A numeric score (higher = more relevant)
 */
export function scorePost(
  post: PostWithAuthor,
  _userId: string,
  interactions: UserInteractions,
  signals?: RankingSignals
): number {
  const recency = recencyScore(post.created_at);
  const engagement = engagementScore(post);
  const social = socialProximityScore(post, interactions);
  const media = mediaBonus(post);
  const boost = boostBonus(post);
  const coldStart = coldStartBonus(post);

  // Recency carries the largest weight so the feed still feels fresh; boost
  // and cold start are additive so promoted and first posts always surface.
  return (
    recency * 0.5 +
    engagement * 0.2 +
    social * 0.15 +
    media * 0.05 +
    boost +
    coldStart +
    preferenceAdjustment(post, signals)
  );
}

/**
 * Rank an array of posts using the scoring algorithm.
 * Also applies a diversity penalty so the same author doesn't appear
 * multiple times in a row.
 *
 * Callers rank one fetched page at a time: re-ranking already-delivered
 * pages would reorder content under the user's thumb.
 */
export function rankPosts(
  posts: PostWithAuthor[],
  userId: string,
  interactions: UserInteractions = new Map(),
  signals?: RankingSignals
): PostWithAuthor[] {
  if (posts.length <= 1) return posts;

  // Score every post
  const scored = posts.map((post) => ({
    post,
    score: scorePost(post, userId, interactions, signals),
  }));

  // Sort by raw score descending; created_at desc breaks ties so equal
  // scores keep a stable order across re-renders.
  scored.sort(
    (a, b) =>
      b.score - a.score || b.post.created_at.localeCompare(a.post.created_at)
  );

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
