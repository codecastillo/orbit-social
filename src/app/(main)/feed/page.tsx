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
      {/* Modal Composer */}
      <PostComposer />

      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-2xl bg-zinc-950/70">
        <div className="px-5 pt-5 pb-2">
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">Home</h1>
        </div>

        {/* Pill/Chip Tab Switcher */}
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "foryou" | "following")}
          className="w-full"
        >
          <TabsList className="w-full rounded-none bg-transparent h-auto px-4 py-2.5 gap-2 justify-start border-b border-white/[0.04]">
            <TabsTrigger
              value="foryou"
              className="rounded-full px-5 py-1.5 font-semibold text-sm bg-white/[0.04] text-zinc-500 border border-white/[0.06] transition-all duration-200 data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:border-primary/30 data-[state=active]:shadow-sm data-[state=active]:shadow-primary/20 hover:bg-white/[0.06] hover:text-zinc-300"
            >
              For You
            </TabsTrigger>
            <TabsTrigger
              value="following"
              className="rounded-full px-5 py-1.5 font-semibold text-sm bg-white/[0.04] text-zinc-500 border border-white/[0.06] transition-all duration-200 data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:border-primary/30 data-[state=active]:shadow-sm data-[state=active]:shadow-primary/20 hover:bg-white/[0.06] hover:text-zinc-300"
            >
              Following
            </TabsTrigger>
          </TabsList>

          {/* Inline Composer (desktop) */}
          <div className="hidden lg:block">
            <InlineComposer
              onSuccess={() =>
                queryClient.invalidateQueries({ queryKey: ["feed"] })
              }
            />
          </div>

          <TabsContent value="foryou" className="mt-0">
            <div className="px-4 pt-4">
              <StoryBar />
            </div>
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
