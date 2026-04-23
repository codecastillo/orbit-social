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

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "foryou" | "following")}
        className="w-full"
      >
        <TabsList className="w-full rounded-none border-b border-border/60 bg-transparent h-13 sticky top-0 z-10 backdrop-blur-xl bg-background/80 px-0">
          <TabsTrigger
            value="foryou"
            className="flex-1 rounded-none h-full font-semibold text-[15px] border-b-[3px] border-transparent text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent transition-colors"
          >
            For You
          </TabsTrigger>
          <TabsTrigger
            value="following"
            className="flex-1 rounded-none h-full font-semibold text-[15px] border-b-[3px] border-transparent text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent transition-colors"
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
  );
}
