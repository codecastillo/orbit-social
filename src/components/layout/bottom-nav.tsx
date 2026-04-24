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
  { label: "Clips", href: "/reels", icon: Clapperboard },
  { label: "Profile", href: "/profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const setComposeOpen = useUIStore((s) => s.setComposeOpen);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 glass lg:hidden">
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
                <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shadow-[0_0_12px_oklch(0.623_0.214_259_/_20%)]">
                  <Icon className="h-6 w-6 text-primary" strokeWidth={2} />
                </div>
              </button>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1.5 p-2 transition-all duration-200 active:scale-90",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon
                className={cn(
                  "h-6 w-6 transition-all duration-200",
                  isActive && "text-primary drop-shadow-[0_0_8px_oklch(0.623_0.214_259_/_50%)]"
                )}
                strokeWidth={isActive ? 2.5 : 1.8}
                fill={isActive ? "currentColor" : "none"}
              />
              {isActive && (
                <span className="h-1 w-1 rounded-full bg-primary shadow-[0_0_6px_oklch(0.623_0.214_259_/_80%)]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
