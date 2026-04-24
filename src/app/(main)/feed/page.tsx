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
        <div className="px-5 pt-5 pb-3">
          <h1
            className="text-2xl font-extrabold tracking-tight"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            Home
          </h1>
        </div>

        {/* Pill Tab Switcher */}
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "foryou" | "following")}
          className="w-full"
        >
          <TabsList className="w-full rounded-none bg-transparent h-auto px-4 pb-3 gap-2 justify-start border-b border-white/[0.06]">
            <TabsTrigger
              value="foryou"
              className="rounded-full px-6 py-2.5 font-semibold text-sm bg-white/[0.05] text-muted-foreground border border-white/[0.08] transition-all duration-200 data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:border-primary/30 data-[state=active]:shadow-md data-[state=active]:shadow-primary/20 hover:bg-white/[0.08] hover:text-foreground"
            >
              For You
            </TabsTrigger>
            <TabsTrigger
              value="following"
              className="rounded-full px-6 py-2.5 font-semibold text-sm bg-white/[0.05] text-muted-foreground border border-white/[0.08] transition-all duration-200 data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:border-primary/30 data-[state=active]:shadow-md data-[state=active]:shadow-primary/20 hover:bg-white/[0.08] hover:text-foreground"
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
