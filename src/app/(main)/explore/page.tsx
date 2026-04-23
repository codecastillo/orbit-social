import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function ExplorePage() {
  return (
    <div className="border-x border-border min-h-screen">
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search posts, people, tags..."
            className="pl-10 bg-secondary/50 rounded-xl border-none"
          />
        </div>
      </div>

      <div className="p-6 text-center text-muted-foreground">
        <p className="text-lg font-medium">Explore</p>
        <p className="text-sm mt-1">Discover trending content and people.</p>
      </div>
    </div>
  );
}
