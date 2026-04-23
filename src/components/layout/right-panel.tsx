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
    <aside className="fixed right-0 top-0 h-full w-[320px] py-5 px-4 space-y-4 overflow-y-auto hidden xl:block">
      {/* Search */}
      <div className="relative group">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-muted-foreground group-focus-within:text-primary transition-colors" />
        <Input
          placeholder="Search Orbit..."
          className="pl-11 h-11 bg-accent/50 rounded-full border-border/40 shadow-sm focus:shadow-md focus:bg-background focus:border-primary/30 transition-all duration-200"
        />
      </div>

      {/* Trending */}
      <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 pt-4 pb-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <h3 className="font-semibold text-[15px]">Trending</h3>
        </div>
        <div className="px-1 pb-1">
          {trendingTopics.map((topic) => (
            <div
              key={topic.tag}
              className="flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer hover:bg-accent/70 transition-colors duration-150 group"
            >
              <div>
                <p className="text-sm font-semibold group-hover:text-primary transition-colors">
                  #{topic.tag}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {topic.posts} posts
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Who to Follow */}
      <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
        <div className="px-4 pt-4 pb-3">
          <h3 className="font-semibold text-[15px]">Who to follow</h3>
        </div>
        <div className="px-4 pb-4">
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            Follow people to see their posts in your feed.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-2 pt-2">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground/70">
          <span className="hover:underline cursor-pointer hover:text-muted-foreground transition-colors">Terms</span>
          <span className="hover:underline cursor-pointer hover:text-muted-foreground transition-colors">Privacy</span>
          <span className="hover:underline cursor-pointer hover:text-muted-foreground transition-colors">Cookies</span>
        </div>
        <p className="text-[11px] text-muted-foreground/50 mt-2">&copy; 2026 Orbit</p>
      </div>
    </aside>
  );
}
