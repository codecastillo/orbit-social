"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InlineComposer } from "@/components/feed/post-composer";
import { PostComposer } from "@/components/feed/post-composer";
import { FeedList } from "@/components/feed/feed-list";
import { StoryBar } from "@/components/stories/story-bar";
import { useQueryClient } from "@tanstack/react-query";
import { PeopleYouMayKnow } from "@/components/shared/people-you-may-know";

export default function FeedPage() {
  const [tab, setTab] = useState<"foryou" | "following">("foryou");
  const queryClient = useQueryClient();

  return (
    <div className="min-h-screen">
      <PostComposer />

      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-2xl bg-background/80">
        <div className="relative flex flex-col items-center justify-center py-4 shadow-[0_1px_0_oklch(1_0_0_/_0.06)]">
          <h1
            className="text-lg font-extrabold tracking-tight"
            style={{
              fontFamily: "var(--font-syne), sans-serif",
              background: "linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.6) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Orbit
          </h1>
          <div className="mt-1.5 h-[2px] w-10 rounded-full bg-gradient-to-r from-primary/0 via-primary to-primary/0 shadow-[0_0_12px_oklch(0.623_0.214_259_/_0.6)]" />
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
          <TabsList className="w-full rounded-none bg-transparent h-auto px-2 py-2 gap-1 justify-center border-b border-white/[0.06]">
            <TabsTrigger
              value="foryou"
              className="flex-1 rounded-full px-4 py-2 text-sm font-semibold text-zinc-500 border-none transition-all duration-200 data-[state=active]:text-zinc-100 data-[state=active]:bg-white/[0.08] data-[state=active]:shadow-sm hover:text-zinc-300"
            >
              For You
            </TabsTrigger>
            <TabsTrigger
              value="following"
              className="flex-1 rounded-full px-4 py-2 text-sm font-semibold text-zinc-500 border-none transition-all duration-200 data-[state=active]:text-zinc-100 data-[state=active]:bg-white/[0.08] data-[state=active]:shadow-sm hover:text-zinc-300"
            >
              Following
            </TabsTrigger>
          </TabsList>

          <TabsContent value="foryou" className="mt-0">
            <div className="border-b border-white/[0.06] py-1">
              <PeopleYouMayKnow />
            </div>
            <FeedList tab="foryou" />
          </TabsContent>

          <TabsContent value="following" className="mt-0 pt-1">
            <FeedList tab="following" />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
