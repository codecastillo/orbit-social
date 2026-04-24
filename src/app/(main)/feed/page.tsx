"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { InlineComposer } from "@/components/feed/post-composer";
import { PostComposer } from "@/components/feed/post-composer";
import { FeedList } from "@/components/feed/feed-list";
import { StoryBar } from "@/components/stories/story-bar";
import { PeopleYouMayKnow } from "@/components/shared/people-you-may-know";

const tabs = [
  { value: "foryou", label: "For you" },
  { value: "following", label: "Following" },
] as const;

type TabValue = (typeof tabs)[number]["value"];

export default function FeedPage() {
  const [tab, setTab] = useState<TabValue>("foryou");
  const queryClient = useQueryClient();

  return (
    <div className="min-h-screen">
      <PostComposer />

      {/* Frosted header */}
      <div
        className="sticky top-0 z-10"
        style={{
          background: "oklch(0.14 0.02 270 / 0.7)",
          backdropFilter: "blur(40px) saturate(2)",
          WebkitBackdropFilter: "blur(40px) saturate(2)",
          borderBottom: "1px solid oklch(1 0 0 / 0.05)",
        }}
      >
        {/* Editorial brand row + segmented tabs */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 gap-4 flex-wrap">
          <div>
            <h1 className="hero-display-sm">
              The <em>internet</em>, but smaller.
            </h1>
            <p className="text-[12px] text-muted-foreground mt-2 font-medium">
              <Sparkles className="inline h-3 w-3 mr-1 text-primary -mt-0.5" />
              Personalised for you
            </p>
          </div>
          <SegmentedTabs value={tab} onChange={setTab} />
        </div>

        {/* Moments / stories */}
        <div className="border-t border-white/[0.04]">
          <StoryBar />
        </div>

        {/* Inline composer (desktop only) */}
        <div className="hidden lg:block border-t border-white/[0.04]">
          <InlineComposer
            onSuccess={() =>
              queryClient.invalidateQueries({ queryKey: ["feed"] })
            }
          />
        </div>
      </div>

      {/* Feed */}
      {tab === "foryou" ? (
        <>
          <div className="border-b border-white/[0.05]">
            <PeopleYouMayKnow />
          </div>
          <FeedList tab="foryou" />
        </>
      ) : (
        <FeedList tab="following" />
      )}
    </div>
  );
}

function SegmentedTabs({
  value,
  onChange,
}: {
  value: TabValue;
  onChange: (v: TabValue) => void;
}) {
  return (
    <div className="flex items-center p-1 rounded-2xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-xl">
      {tabs.map((t) => {
        const isActive = value === t.value;
        return (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            className={cn(
              "relative px-4 h-8 text-[13px] font-semibold rounded-xl transition-all duration-200",
              isActive
                ? "bg-primary text-primary-foreground shadow-[0_4px_16px_oklch(0.623_0.214_259_/_0.4)]"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
