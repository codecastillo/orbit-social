"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, PlusSquare, Clapperboard, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/lib/stores/ui-store";

const items = [
  { label: "Home", href: "/feed", icon: Home },
  { label: "Explore", href: "/explore", icon: Compass },
  { label: "Create", href: "#compose", icon: PlusSquare },
  { label: "Reels", href: "/reels", icon: Clapperboard },
  { label: "Profile", href: "/profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const setComposeOpen = useUIStore((s) => s.setComposeOpen);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background/85 backdrop-blur-2xl border-t border-border/40 lg:hidden shadow-[0_-1px_12px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-around h-16 px-2 pb-[env(safe-area-inset-bottom)]">
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
                className="flex flex-col items-center justify-center gap-1 p-2 text-muted-foreground active:scale-90 transition-transform duration-150"
              >
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Icon className="h-[22px] w-[22px] text-primary" strokeWidth={2} />
                </div>
              </button>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 p-2 transition-all duration-200 active:scale-90",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon
                className={cn(
                  "h-[22px] w-[22px] transition-all duration-200",
                  isActive && "text-primary"
                )}
                strokeWidth={isActive ? 2.5 : 1.8}
                fill={isActive ? "currentColor" : "none"}
              />
              {isActive && (
                <span className="h-1 w-1 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
