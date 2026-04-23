export default function NotificationsPage() {
  return (
    <div className="border-x border-border min-h-screen">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold">Notifications</h2>
      </div>
      <div className="p-6 text-center text-muted-foreground">
        <p className="text-lg font-medium">No notifications</p>
        <p className="text-sm mt-1">You&apos;re all caught up.</p>
      </div>
    </div>
  );
}
