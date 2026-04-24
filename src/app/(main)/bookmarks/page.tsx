export default function BookmarksPage() {
  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-zinc-900/80 border-b border-zinc-700/50 p-5">
        <h1 className="text-xl font-bold text-zinc-100">Saved</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Posts you have saved for later</p>
      </div>
      <div className="p-6">
        <div className="bg-zinc-800/50 rounded-2xl border border-zinc-700/40 p-8 text-center">
          <p className="text-lg font-semibold text-zinc-300">No saved posts yet</p>
          <p className="text-sm text-zinc-500 mt-1.5">Tap the bookmark icon on any post to save it here.</p>
        </div>
      </div>
    </div>
  );
}
