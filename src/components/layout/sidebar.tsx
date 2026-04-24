"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Compass,
  Clapperboard,
  MessageCircle,
  Bell,
  Calendar,
  Radio,
  Plus,
  Settings,
  LogOut,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUnreadCount } from "@/lib/hooks/use-notifications";
import { useCurrentProfile } from "@/lib/hooks/use-profile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/hooks/use-auth";
import { useUIStore } from "@/lib/stores/ui-store";

const primaryNav = [
  { label: "Home", href: "/feed", icon: Home },
  { label: "Discover", href: "/explore", icon: Compass },
  { label: "Clips", href: "/reels", icon: Clapperboard },
  { label: "Messages", href: "/messages", icon: MessageCircle },
  { label: "Notifications", href: "/notifications", icon: Bell },
];

const secondaryNav = [
  { label: "Spaces", href: "/communities", icon: Users },
  { label: "Events", href: "/events", icon: Calendar },
  { label: "Live", href: "/live", icon: Radio },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const setComposeOpen = useUIStore((s) => s.setComposeOpen);
  const { data: unreadCount } = useUnreadCount();
  const { data: profile } = useCurrentProfile();

  return (
    <aside className="fixed left-0 top-0 h-full w-[76px] flex-col items-center z-40 hidden lg:flex py-5 bg-[oklch(0.16_0.02_270_/_0.6)] backdrop-blur-2xl border-r border-white/[0.06]">
      {/* Logo — rounded-2xl chip with primary glow */}
      <Link
        href="/feed"
        className="flex items-center justify-center h-11 w-11 rounded-2xl bg-gradient-to-br from-primary to-primary/60 shadow-[0_0_24px_oklch(0.623_0.214_259_/_0.45)] mb-4 group"
        title="Orbit"
      >
        <span className="text-lg font-extrabold text-primary-foreground tracking-tight group-hover:scale-110 transition-transform">
          O
        </span>
      </Link>

      {/* Primary nav */}
      <nav className="flex flex-col items-center gap-1.5">
        {primaryNav.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            pathname={pathname}
            badge={item.label === "Notifications" ? unreadCount : undefined}
          />
        ))}
      </nav>

      <div className="w-9 h-px bg-white/[0.06] my-4" />

      {/* Secondary nav */}
      <nav className="flex flex-col items-center gap-1.5">
        {secondaryNav.map((item) => (
          <NavItem key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>

      <div className="flex-1" />

      {/* Compose */}
      <button
        onClick={() => setComposeOpen(true)}
        title="Compose"
        className="flex items-center justify-center h-12 w-12 rounded-2xl bg-primary text-primary-foreground shadow-[0_8px_24px_oklch(0.623_0.214_259_/_0.4)] hover:shadow-[0_8px_32px_oklch(0.623_0.214_259_/_0.55)] hover:scale-105 active:scale-95 transition-all duration-200 mb-4"
      >
        <Plus className="h-5 w-5" strokeWidth={2.5} />
      </button>

      {/* User */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex items-center justify-center rounded-2xl hover:bg-white/[0.06] transition-colors p-1 group cursor-pointer"
          title={profile?.display_name || "Profile"}
        >
          <Avatar className="h-10 w-10 rounded-2xl ring-2 ring-white/[0.08] group-hover:ring-primary/40 transition-all">
            <AvatarImage src={profile?.avatar_url || undefined} className="rounded-2xl" />
            <AvatarFallback className="rounded-2xl text-sm font-semibold bg-primary/15 text-primary">
              {profile?.display_name?.[0]?.toUpperCase() ||
                user?.email?.[0]?.toUpperCase() ||
                "U"}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side="right"
          className="w-56 rounded-2xl shadow-2xl border-border/50 ml-3"
        >
          <div className="px-3 py-2.5 border-b border-border/50">
            <p className="text-sm font-semibold truncate text-foreground">
              {profile?.display_name || user?.email}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              @{profile?.username || "user"}
            </p>
          </div>
          {profile?.username && (
            <Link href={`/${profile.username}`}>
              <DropdownMenuItem className="cursor-pointer rounded-lg">
                View Profile
              </DropdownMenuItem>
            </Link>
          )}
          <Link href="/settings">
            <DropdownMenuItem className="cursor-pointer rounded-lg">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
          </Link>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={signOut}
            className="text-destructive cursor-pointer rounded-lg"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </aside>
  );
}

function NavItem({
  item,
  pathname,
  badge,
}: {
  item: { label: string; href: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> };
  pathname: string;
  badge?: number;
}) {
  const isActive =
    pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      title={item.label}
      className={cn(
        "relative flex items-center justify-center h-11 w-11 rounded-2xl transition-all duration-200 group",
        isActive
          ? "bg-primary/15"
          : "text-muted-foreground hover:bg-white/[0.06]"
      )}
    >
      {isActive && (
        <span className="absolute -left-[5px] top-1/2 -translate-y-1/2 h-7 w-[3px] rounded-full bg-primary shadow-[0_0_12px_oklch(0.623_0.214_259_/_0.7)]" />
      )}
      <span className="relative flex-shrink-0">
        <Icon
          className={cn(
            "h-[20px] w-[20px] transition-colors",
            isActive ? "text-primary" : "group-hover:text-foreground"
          )}
          strokeWidth={isActive ? 2.4 : 1.8}
        />
        {!!badge && badge > 0 && (
          <span className="absolute -top-1.5 -right-2 flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[9px] font-bold leading-none text-white bg-destructive rounded-full ring-2 ring-background">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </span>
    </Link>
  );
}
