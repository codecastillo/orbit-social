"use client";

import { useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { HeroPost } from "./hero-post";
import { PostGridCard } from "./post-grid-card";
import { ClipsCarousel } from "./clips-carousel";
// SpacesCarousel removed — Spaces feature deprecated
import { EmptyState } from "@/components/shared/empty-state";
import { useFeed } from "@/lib/hooks/use-feed";

const syne = { fontFamily: "var(--font-syne), sans-serif" };

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="px-4 pb-4"
    >
      <h2 className="text-lg font-bold tracking-tight" style={syne}>
        {title}
      </h2>
      {subtitle && (
        <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
      )}
    </motion.div>
  );
}

function MagazineSkeleton() {
  return (
    <div className="space-y-6 p-4">
      <Skeleton className="w-full h-[420px] rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-xl" />
        ))}
      </div>
      <div className="flex gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="w-[130px] aspect-[9/16] rounded-2xl shrink-0" />
        ))}
      </div>
    </div>
  );
}

export function MagazineFeed() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useFeed("foryou");

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node) return;
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        },
        { rootMargin: "400px" }
      );
      observerRef.current.observe(node);
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  );

  if (isLoading) return <MagazineSkeleton />;

  if (isError) {
    return (
      <EmptyState
        title="Something went wrong"
        description="Failed to load your feed."
        action={
          <button onClick={() => refetch()} className="text-primary text-sm font-medium hover:underline">
            Retry
          </button>
        }
      />
    );
  }

  const allPosts = data?.pages.flatMap((p) => p.posts) || [];

  if (allPosts.length === 0) {
    return (
      <EmptyState
        title="Your magazine is empty"
        description="Follow people or explore to fill your feed with content."
      />
    );
  }

  const heroPost = allPosts[0];
  const gridPosts1 = allPosts.slice(1, 7);
  const gridPosts2 = allPosts.slice(7);

  return (
    <div className="space-y-8 pb-8">
      {/* Hero Post */}
      <div className="px-4 pt-4">
        <HeroPost post={heroPost} isLiked={heroPost.user_has_liked} />
      </div>

      {/* For You Grid */}
      {gridPosts1.length > 0 && (
        <section>
          <SectionHeader title="For You" subtitle="Posts we think you'll love" />
          <div className="grid grid-cols-2 gap-3 px-4">
            {gridPosts1.map((post, i) => (
              <PostGridCard key={post.id} post={post} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* Trending Clips */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
      >
        <SectionHeader title="Trending Clips" subtitle="Popular short videos" />
        <ClipsCarousel />
      </motion.section>

      {/* More Posts */}
      {gridPosts2.length > 0 && (
        <section>
          <SectionHeader title="More For You" />
          <div className="grid grid-cols-2 gap-3 px-4">
            {gridPosts2.map((post, i) => (
              <PostGridCard key={post.id} post={post} index={i + gridPosts1.length} />
            ))}
          </div>
        </section>
      )}

      {/* Infinite scroll trigger */}
      <div ref={loadMoreRef} className="h-1" />
      {isFetchingNextPage && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
