"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Plus, MessageCircle, User } from "lucide-react";
import { useUIStore } from "@/lib/stores/ui-store";
import { useAuth } from "@/lib/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function BottomNav({ initialHasUser = false }: { initialHasUser?: boolean }) {
  const pathname = usePathname();
  const setComposeOpen = useUIStore((s) => s.setComposeOpen);
  const { user, loading: authLoading } = useAuth();
  // Trust the server-known auth state until useAuth has actually resolved,
  // so the Compose / Sign-up swap doesn't flash on every refresh.
  const isSignedIn = authLoading ? initialHasUser : !!user;
  const [username, setUsername] = useState<string | null>(null);

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

  const profileHref = username ? `/${username}` : "/onboarding";

  // Anon visitors don't have a Compose / Chat / You, swap those slots out
  // for an account CTA so the bottom nav stays five-wide and isn't a row of
  // dead buttons that all bounce through middleware.
  const items = isSignedIn
    ? [
        { key: "home", label: "Home", href: "/feed", icon: Home },
        { key: "discover", label: "Discover", href: "/explore", icon: Compass },
        { key: "compose", label: "Compose", href: "#compose", icon: Plus, primary: true },
        { key: "msg", label: "Chat", href: "/messages", icon: MessageCircle },
        { key: "me", label: "You", href: profileHref, icon: User },
      ]
    : [
        { key: "home", label: "Home", href: "/feed", icon: Home },
        { key: "discover", label: "Discover", href: "/explore", icon: Compass },
        { key: "signup", label: "Sign up", href: "/signup", icon: Plus, primary: true },
        { key: "signin", label: "Sign in", href: "/login", icon: User },
      ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex select-none items-center justify-around border-t border-border bg-background px-3 pb-[env(safe-area-inset-bottom)] pt-1.5 lg:hidden">
      {items.map((item) => {
        const isCompose = item.href === "#compose";
        const isPrimary = "primary" in item && item.primary;
        const isActive =
          !isCompose &&
          (pathname === item.href || pathname.startsWith(item.href + "/"));
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
            className={cn(
              "relative flex items-center justify-center p-2 pb-3 no-underline",
              isActive ? "text-foreground" : "text-muted-foreground"
            )}
          >
            <Icon className="h-6 w-6" strokeWidth={isActive ? 2.2 : 1.8} />
            {isActive && (
              <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
