"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InlineComposer } from "@/components/feed/post-composer";
import { PostComposer } from "@/components/feed/post-composer";
import { FeedList } from "@/components/feed/feed-list";
import { StoryBar } from "@/components/stories/story-bar";
import { useQueryClient } from "@tanstack/react-query";

export default function FeedPage() {
  const [tab, setTab] = useState<"foryou" | "following">("foryou");
  const queryClient = useQueryClient();

  return (
    <div className="min-h-screen">
      <PostComposer />

      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-2xl bg-background/80">
        <div className="flex items-center justify-center py-3 border-b border-white/[0.06]">
          <h1
            className="text-lg font-bold tracking-tight"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            Orbit
          </h1>
        </div>

        {/* Moments */}
        <div className="border-b border-white/[0.06]">
          <StoryBar />
        </div>

        {/* Inline Composer */}
        <div className="hidden lg:block">
          <InlineComposer
            onSuccess={() =>
              queryClient.invalidateQueries({ queryKey: ["feed"] })
            }
          />
        </div>

        {/* Tabs */}
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "foryou" | "following")}
          className="w-full"
        >
          <TabsList className="w-full rounded-none bg-transparent h-auto px-0 gap-0 justify-center border-b border-white/[0.06]">
            <TabsTrigger
              value="foryou"
              className="flex-1 rounded-none px-4 py-3 text-sm font-semibold text-zinc-500 border-b-2 border-transparent transition-all duration-200 data-[state=active]:text-zinc-100 data-[state=active]:border-zinc-100"
            >
              For You
            </TabsTrigger>
            <TabsTrigger
              value="following"
              className="flex-1 rounded-none px-4 py-3 text-sm font-semibold text-zinc-500 border-b-2 border-transparent transition-all duration-200 data-[state=active]:text-zinc-100 data-[state=active]:border-zinc-100"
            >
              Following
            </TabsTrigger>
          </TabsList>

          <TabsContent value="foryou" className="mt-0">
            <FeedList tab="foryou" />
          </TabsContent>

          <TabsContent value="following" className="mt-0">
            <FeedList tab="following" />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
