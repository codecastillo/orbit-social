"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Plus, MessageCircle, User } from "lucide-react";
import { useUIStore } from "@/lib/stores/ui-store";
import { useAuth } from "@/lib/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import { O, aurora, panel } from "@/lib/design/orbit";

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
    <nav
      className="fixed z-40 flex lg:hidden justify-around items-center"
      style={{
        left: 14,
        right: 14,
        bottom: 22,
        ...panel({ borderRadius: 28 }),
        padding: "12px 14px",
      }}
    >
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
              onClick={() => setComposeOpen(true)}
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: aurora,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 8px 22px -4px color-mix(in oklab, ${O.a2} 50%, transparent), inset 0 1px 0 rgba(255,255,255,0.3)`,
                border: "none",
                cursor: "pointer",
                color: "white",
              }}
            >
              <Icon style={{ width: 22, height: 22 }} strokeWidth={2.4} />
            </button>
          );
        }

        if (isPrimary) {
          return (
            <Link
              key={item.key}
              href={item.href}
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: aurora,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 8px 22px -4px color-mix(in oklab, ${O.a2} 50%, transparent), inset 0 1px 0 rgba(255,255,255,0.3)`,
                color: "white",
                textDecoration: "none",
              }}
            >
              <Icon style={{ width: 22, height: 22 }} strokeWidth={2.4} />
            </Link>
          );
        }

        return (
          <Link
            key={item.key}
            href={item.href}
            style={{
              position: "relative",
              padding: 8,
              color: isActive ? O.ink : O.ink3,
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon style={{ width: 24, height: 24 }} strokeWidth={isActive ? 2.2 : 1.8} />
            {isActive && (
              <span
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: aurora,
                }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
