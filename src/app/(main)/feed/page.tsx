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
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-zinc-900/80 border-b border-zinc-700/50">
        <div className="px-5 pt-4 pb-1">
          <h1 className="text-xl font-bold text-zinc-100">Home</h1>
        </div>

        {/* Pill/Chip Tab Switcher */}
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "foryou" | "following")}
          className="w-full"
        >
          <TabsList className="w-full rounded-none bg-transparent h-auto px-4 py-2.5 gap-2 justify-start">
            <TabsTrigger
              value="foryou"
              className="rounded-full px-5 py-1.5 font-semibold text-sm bg-zinc-800 text-zinc-400 border border-zinc-700/50 transition-all data-[state=active]:bg-violet-600 data-[state=active]:text-white data-[state=active]:border-violet-500 data-[state=active]:shadow-md data-[state=active]:shadow-violet-500/20 hover:bg-zinc-700"
            >
              For You
            </TabsTrigger>
            <TabsTrigger
              value="following"
              className="rounded-full px-5 py-1.5 font-semibold text-sm bg-zinc-800 text-zinc-400 border border-zinc-700/50 transition-all data-[state=active]:bg-violet-600 data-[state=active]:text-white data-[state=active]:border-violet-500 data-[state=active]:shadow-md data-[state=active]:shadow-violet-500/20 hover:bg-zinc-700"
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
            <div className="px-3 pt-3">
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
