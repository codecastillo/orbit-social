export default function BookmarksPage() {
  return (
    <div className="border-x border-border min-h-screen">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold">Bookmarks</h2>
      </div>
      <div className="p-6 text-center text-muted-foreground">
        <p className="text-lg font-medium">No bookmarks yet</p>
        <p className="text-sm mt-1">Save posts to read later.</p>
      </div>
    </div>
  );
}
