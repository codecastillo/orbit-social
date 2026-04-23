"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function FeedPage() {
  return (
    <div className="border-x border-border min-h-screen">
      <Tabs defaultValue="foryou" className="w-full">
        <TabsList className="w-full rounded-none border-b border-border bg-transparent h-12">
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

        <TabsContent value="foryou" className="mt-0">
          {/* Story bar will go here */}
          <div className="p-6 text-center text-muted-foreground">
            <p className="text-lg font-medium">Your feed is empty</p>
            <p className="text-sm mt-1">
              Follow people or explore to discover content.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="following" className="mt-0">
          <div className="p-6 text-center text-muted-foreground">
            <p className="text-lg font-medium">No posts yet</p>
            <p className="text-sm mt-1">
              Posts from people you follow will appear here.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
