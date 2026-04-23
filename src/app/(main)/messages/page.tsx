export default function MessagesPage() {
  return (
    <div className="border-x border-border min-h-screen">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold">Messages</h2>
      </div>
      <div className="p-6 text-center text-muted-foreground">
        <p className="text-lg font-medium">No conversations yet</p>
        <p className="text-sm mt-1">Start a conversation with someone.</p>
      </div>
    </div>
  );
}
