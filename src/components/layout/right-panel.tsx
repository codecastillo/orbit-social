import { Search, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";

const trendingTopics = [
  { tag: "technology", posts: "12.4K" },
  { tag: "music", posts: "8.2K" },
  { tag: "gaming", posts: "6.7K" },
  { tag: "photography", posts: "4.1K" },
  { tag: "fitness", posts: "3.8K" },
];

export function RightPanel() {
  return (
    <aside className="fixed right-0 top-0 h-full w-[320px] border-l border-border py-6 px-4 space-y-6 overflow-y-auto hidden xl:block">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search Orbit..."
          className="pl-10 bg-secondary/50 rounded-xl border-none"
        />
      </div>

      {/* Trending */}
      <div className="glass rounded-2xl p-4 space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Trending</h3>
        </div>
        <div className="space-y-3">
          {trendingTopics.map((topic) => (
            <div
              key={topic.tag}
              className="flex items-center justify-between group cursor-pointer"
            >
              <div>
                <p className="text-sm font-medium group-hover:text-primary transition-colors">
                  #{topic.tag}
                </p>
                <p className="text-xs text-muted-foreground">
                  {topic.posts} posts
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Who to Follow */}
      <div className="glass rounded-2xl p-4 space-y-4">
        <h3 className="font-semibold text-sm">Who to follow</h3>
        <p className="text-xs text-muted-foreground">
          Follow people to see their posts in your feed.
        </p>
      </div>

      {/* Footer */}
      <div className="text-xs text-muted-foreground space-x-2">
        <span>Terms</span>
        <span>Privacy</span>
        <span>Cookies</span>
      </div>
    </aside>
  );
}
