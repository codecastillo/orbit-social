"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { LogOut, Settings, MoreHorizontal } from "lucide-react";
import { useUnreadCount, useUnreadMessagesCount } from "@/lib/hooks/use-notifications";
import { useCurrentProfile, type CurrentProfile } from "@/lib/hooks/use-profile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/hooks/use-auth";
import { useUIStore } from "@/lib/stores/ui-store";
import { NAV_ITEMS } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function Sidebar({
  initialProfile,
  initialHasUser = false,
}: {
  initialProfile?: CurrentProfile | null;
  initialHasUser?: boolean;
}) {
  const pathname = usePathname();
  const { user, signOut, loading: authLoading } = useAuth();
  const setComposeOpen = useUIStore((s) => s.setComposeOpen);
  const { data: unreadCount } = useUnreadCount();
  const { data: unreadMessages } = useUnreadMessagesCount();
  const { data: liveProfile } = useCurrentProfile();
  // Use the server-prefetched profile until live data arrives. This makes
  // the sidebar render the real avatar/name on the very first paint.
  const profile = liveProfile ?? initialProfile ?? null;
  // Trust the server-known auth state until useAuth has actually resolved.
  // Otherwise the initial useAuth() turn returns user=null which makes the
  // signed-in→signed-out CTAs flash for a frame on every refresh.
  const isSignedIn = authLoading ? initialHasUser : !!user;

  const activeHref = useMemo(
    () =>
      NAV_ITEMS.find(
        (n) => pathname === n.href || pathname.startsWith(n.href + "/")
      )?.href ?? "",
    [pathname],
  );

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] select-none flex-col border-r border-border bg-background px-4 py-6 lg:flex">
      {/* Logo block */}
      <Link href="/feed" className="flex items-center gap-2.5 px-2 pb-5 pt-1">
        <div className="relative h-8 w-8 shrink-0 rounded-lg bg-primary">
          <div className="absolute inset-1 rounded-md border-[1.5px] border-primary-foreground/50" />
          <div className="absolute left-[9px] top-[9px] h-1 w-1 rounded-full bg-primary-foreground" />
        </div>
        <div>
          <div className="text-lg font-bold tracking-tight text-foreground">
            Orbit
          </div>
          <div className="-mt-0.5 font-mono text-[9.5px] tracking-[0.14em] text-muted-foreground">
            EVERYONE&apos;S RADIUS
          </div>
        </div>
      </Link>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = activeHref === item.href;
          const Icon = item.icon;
          const badge =
            item.badge === "notifications" && unreadCount && unreadCount > 0
              ? unreadCount
              : item.badge === "messages" && unreadMessages && unreadMessages > 0
                ? unreadMessages
                : null;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-3.5 rounded-lg px-3.5 py-2.5 text-sm",
                isActive
                  ? "bg-primary/10 font-semibold text-foreground"
                  : "font-medium text-text-secondary hover:bg-surface hover:text-foreground"
              )}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
              <span>{item.label}</span>
              {badge && (
                <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary-foreground">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
              {isActive && (
                <span className="absolute -left-4 top-1/2 h-[18px] w-0.5 -translate-y-1/2 rounded-sm bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer block: compose + user. Signed-out viewers (browsing via
          "Explore first") get sign-up/sign-in CTAs instead. */}
      <div className="mt-4 border-t border-border pt-4">
        {isSignedIn ? (
          <Button size="lg" className="w-full" onClick={() => setComposeOpen(true)}>
            Post
          </Button>
        ) : (
          <div className="flex flex-col gap-2">
            <Button size="lg" className="w-full" render={<Link href="/signup" />}>
              Sign up
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full"
              render={<Link href="/login" />}
            >
              Sign in
            </Button>
          </div>
        )}
        {isSignedIn && (
          <div className="flex w-full items-center gap-2.5 px-1 pt-3.5">
            {/* Avatar + name go to the user's profile page directly. While
                the profile is hydrating we render a transparent placeholder
                of the same dimensions to avoid the 'You / @you' flash. */}
            {profile ? (
              <Link
                href={`/${profile.username}`}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-foreground no-underline"
              >
                {/* Plain <img> instead of Radix's Avatar so the picture is in
                    the SSR'd markup and reused from the browser cache on
                    reload, no fallback-letter flash while Radix waits for
                    the load event. */}
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt=""
                    width={36}
                    height={36}
                    className="h-9 w-9 shrink-0 rounded-full bg-surface-elevated object-cover"
                  />
                ) : (
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {profile.display_name?.[0]?.toUpperCase() ||
                      user?.email?.[0]?.toUpperCase() ||
                      "U"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-foreground">
                    {profile.display_name || profile.username}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    @{profile.username}
                  </div>
                </div>
              </Link>
            ) : (
              <div
                className="pointer-events-none flex min-w-0 flex-1 items-center gap-2.5 opacity-0"
                aria-hidden
              >
                <div className="h-9 w-9 rounded-full" />
                <div className="flex-1">
                  <div className="h-4" />
                  <div className="h-3.5" />
                </div>
              </div>
            )}

            {/* 3-dots opens the settings/sign-out menu. */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className="grid h-[30px] w-[30px] shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-muted-foreground hover:text-foreground"
                aria-label="Account menu"
              >
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-56">
                <Link href="/settings">
                  <DropdownMenuItem className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={signOut}
                  className="cursor-pointer text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </aside>
  );
}
