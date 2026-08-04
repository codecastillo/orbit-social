"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Compass,
  Plus,
  MessageCircle,
  User,
  Menu,
  Bookmark,
  FileText,
  Archive,
  CalendarClock,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useUIStore } from "@/lib/stores/ui-store";
import { useAuth } from "@/lib/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import { NAV_ITEMS } from "@/lib/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function BottomNav({ initialHasUser = false }: { initialHasUser?: boolean }) {
  const pathname = usePathname();
  const setComposeOpen = useUIStore((s) => s.setComposeOpen);
  const { user, loading: authLoading } = useAuth();
  // Trust the server-known auth state until useAuth has actually resolved,
  // so the Compose / Sign-up swap doesn't flash on every refresh.
  const isSignedIn = authLoading ? initialHasUser : !!user;
  const [username, setUsername] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.username) setUsername(data.username);
      });
  }, [user]);

  // Close the sheet after any navigation so it never lingers over the new page.
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const profileHref = username ? `/${username}` : "/onboarding";

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  // Anon visitors don't have a Compose / Chat / You, swap those slots out
  // for an account CTA so the bottom nav stays five-wide and isn't a row of
  // dead buttons that all bounce through middleware.
  const items = isSignedIn
    ? [
        { key: "home", label: "Home", href: "/feed", icon: Home },
        { key: "discover", label: "Discover", href: "/explore", icon: Compass },
        { key: "compose", label: "Compose", href: "#compose", icon: Plus, primary: true },
        { key: "msg", label: "Chat", href: "/messages", icon: MessageCircle },
        { key: "more", label: "More", href: "#more", icon: Menu },
      ]
    : [
        { key: "home", label: "Home", href: "/feed", icon: Home },
        { key: "discover", label: "Discover", href: "/explore", icon: Compass },
        { key: "signup", label: "Sign up", href: "/signup", icon: Plus, primary: true },
        { key: "signin", label: "Sign in", href: "/login", icon: User },
        { key: "more", label: "More", href: "#more", icon: Menu },
      ];

  // Everything the sidebar offers that the five slots above don't. This is
  // the only mobile path to Clips, Rooms, Live, Events, and the personal
  // library pages, so it must cover all of them.
  const sidebarOnly = NAV_ITEMS.filter(
    (item) => !["/feed", "/explore", "/messages"].includes(item.href),
  ).filter((item) => isSignedIn || !["/notifications"].includes(item.href));

  const personalItems: { label: string; href: string; icon: LucideIcon }[] =
    isSignedIn
      ? [
          { label: "You", href: profileHref, icon: User },
          { label: "Bookmarks", href: "/bookmarks", icon: Bookmark },
          { label: "Drafts", href: "/drafts", icon: FileText },
          { label: "Scheduled", href: "/scheduled", icon: CalendarClock },
          { label: "Moments", href: "/moments-archive", icon: Archive },
          { label: "Settings", href: "/settings", icon: Settings },
        ]
      : [];

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex select-none items-center justify-around border-t border-border bg-background px-3 pb-[env(safe-area-inset-bottom)] pt-1.5 lg:hidden">
        {items.map((item) => {
          const isCompose = item.href === "#compose";
          const isMore = item.href === "#more";
          const isPrimary = "primary" in item && item.primary;
          const active = !isCompose && !isMore && isActive(item.href);
          const Icon = item.icon;

          if (isCompose) {
            return (
              <button
                key={item.key}
                type="button"
                aria-label="Compose post"
                onClick={() => setComposeOpen(true)}
                className="mb-1.5 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground"
              >
                <Icon className="h-[22px] w-[22px]" strokeWidth={2.4} />
              </button>
            );
          }

          if (isMore) {
            return (
              <button
                key={item.key}
                type="button"
                aria-label="More destinations"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen(true)}
                className="relative flex items-center justify-center p-2 pb-3 text-muted-foreground"
              >
                <Icon className="h-6 w-6" strokeWidth={1.8} />
              </button>
            );
          }

          if (isPrimary) {
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-label={item.label}
                className="mb-1.5 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground no-underline"
              >
                <Icon className="h-[22px] w-[22px]" strokeWidth={2.4} />
              </Link>
            );
          }

          return (
            <Link
              key={item.key}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center justify-center p-2 pb-3 no-underline",
                active ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <Icon className="h-6 w-6" strokeWidth={active ? 2.2 : 1.8} />
              {active && (
                <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl border-border pb-[max(env(safe-area-inset-bottom),1rem)] lg:hidden"
        >
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-2 px-4">
            {[...sidebarOnly, ...personalItems].map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3.5 text-[12px] font-semibold no-underline",
                    active
                      ? "border-primary/25 bg-primary/10 text-foreground"
                      : "border-border bg-surface text-text-secondary"
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.8} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
