import { BookmarkIcon } from "lucide-react";

export default function BookmarksPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-950/60 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
              <BookmarkIcon className="h-4.5 w-4.5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-100">Saved</h1>
              <p className="text-sm text-zinc-500">Posts you have saved for later</p>
            </div>
          </div>
        </div>
      </div>

      {/* Empty state */}
      <div className="p-5">
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-xl p-10 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
            <BookmarkIcon className="h-5 w-5 text-amber-400" />
          </div>
          <p className="text-lg font-semibold text-zinc-200">No saved posts yet</p>
          <p className="text-sm text-zinc-500 mt-1.5 max-w-xs mx-auto">
            Tap the bookmark icon on any post to save it here.
          </p>
        </div>
      </div>
    </div>
  );
}
