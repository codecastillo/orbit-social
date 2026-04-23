"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InlineComposer } from "@/components/feed/post-composer";
import { PostComposer } from "@/components/feed/post-composer";
import { FeedList } from "@/components/feed/feed-list";
import { useQueryClient } from "@tanstack/react-query";

export default function FeedPage() {
  const [tab, setTab] = useState<"foryou" | "following">("foryou");
  const queryClient = useQueryClient();

  return (
    <div className="border-x border-border min-h-screen">
      {/* Modal Composer */}
      <PostComposer />

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "foryou" | "following")}
        className="w-full"
      >
        <TabsList className="w-full rounded-none border-b border-border bg-transparent h-12 sticky top-0 z-10 backdrop-blur-xl bg-background/80">
          <TabsTrigger
            value="foryou"
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            For You
          </TabsTrigger>
          <TabsTrigger
            value="following"
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
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
          <FeedList tab="foryou" />
        </TabsContent>

        <TabsContent value="following" className="mt-0">
          <FeedList tab="following" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
