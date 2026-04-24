"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Plus, Clapperboard, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/lib/stores/ui-store";
import { useAuth } from "@/lib/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";

export function BottomNav() {
  const pathname = usePathname();
  const setComposeOpen = useUIStore((s) => s.setComposeOpen);
  const { user } = useAuth();
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

  const items = [
    { label: "Home", href: "/feed", icon: Home },
    { label: "Discover", href: "/explore", icon: Compass },
    { label: "Create", href: "#compose", icon: Plus, primary: true },
    { label: "Clips", href: "/reels", icon: Clapperboard },
    { label: "You", href: profileHref, icon: User },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden"
      style={{
        background: "oklch(0.14 0.02 270 / 0.7)",
        backdropFilter: "blur(40px) saturate(2)",
        WebkitBackdropFilter: "blur(40px) saturate(2)",
        borderTop: "1px solid oklch(1 0 0 / 0.06)",
      }}
    >
      <div className="flex items-center justify-around h-[68px] px-3 pb-[env(safe-area-inset-bottom)]">
        {items.map((item) => {
          const isCompose = item.href === "#compose";
          const isActive =
            !isCompose &&
            (pathname === item.href || pathname.startsWith(item.href + "/"));
          const Icon = item.icon;

          if (isCompose) {
            return (
              <button
                key={item.label}
                onClick={() => setComposeOpen(true)}
                className="flex flex-col items-center justify-center active:scale-90 transition-transform duration-150 -mt-2"
              >
                <div className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-[0_8px_24px_oklch(0.623_0.214_259_/_0.5)]">
                  <Icon className="h-6 w-6" strokeWidth={2.4} />
                </div>
              </button>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 px-3 py-2 transition-colors duration-200 active:scale-90",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon
                className={cn(
                  "h-[22px] w-[22px] transition-all",
                  isActive && "drop-shadow-[0_0_10px_oklch(0.623_0.214_259_/_0.7)]"
                )}
                strokeWidth={isActive ? 2.4 : 1.8}
                fill={isActive ? "currentColor" : "none"}
              />
              <span
                className={cn(
                  "text-[10px] font-semibold tracking-wide leading-none transition-opacity",
                  isActive ? "opacity-100" : "opacity-60"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
