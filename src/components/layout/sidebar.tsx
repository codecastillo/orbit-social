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
  Clock,
  Plus,
  Settings,
  LogOut,
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

const navItems = [
  { label: "Home", href: "/feed", icon: Home },
  { label: "Explore", href: "/explore", icon: Compass },
  { label: "Clips", href: "/reels", icon: Clapperboard },
  { label: "Messages", href: "/messages", icon: MessageCircle },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Events", href: "/events", icon: Calendar },
  { label: "Live", href: "/live", icon: Radio },
  { label: "Scheduled", href: "/scheduled", icon: Clock },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const setComposeOpen = useUIStore((s) => s.setComposeOpen);
  const { data: unreadCount } = useUnreadCount();
  const { data: profile } = useCurrentProfile();

  return (
    <aside className="fixed left-0 top-0 h-full w-[72px] glass flex flex-col items-center z-40 hidden lg:flex py-4">
      {/* Logo */}
      <Link
        href="/feed"
        className="flex items-center justify-center h-11 w-11 rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-md glow-box group mb-2"
        title="Orbit"
      >
        <span className="text-lg font-extrabold text-primary-foreground tracking-tight group-hover:scale-110 transition-transform">
          O
        </span>
      </Link>

      <div className="w-8 h-px bg-white/[0.08] my-2" />

      {/* Navigation */}
      <nav className="flex-1 flex flex-col items-center gap-1 overflow-y-auto scrollbar-hide py-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "relative flex items-center justify-center h-11 w-11 rounded-xl transition-all duration-200 group",
                isActive
                  ? "bg-primary/15 shadow-[0_0_16px_oklch(0.623_0.214_259_/_20%)]"
                  : "text-muted-foreground hover:bg-white/[0.06] hover:shadow-[0_0_12px_oklch(0.623_0.214_259_/_10%)]"
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary shadow-[0_0_8px_oklch(0.623_0.214_259_/_60%)]" />
              )}
              <span className="relative flex-shrink-0">
                <Icon
                  className={cn(
                    "h-[20px] w-[20px] transition-colors",
                    isActive ? "text-primary" : "group-hover:text-foreground"
                  )}
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
                {item.label === "Notifications" && !!unreadCount && unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 flex items-center justify-center min-w-[16px] h-[16px] px-0.5 text-[9px] font-bold leading-none text-white bg-destructive rounded-full ring-2 ring-background shadow-sm">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="w-8 h-px bg-white/[0.08] my-2" />

      {/* Compose */}
      <button
        onClick={() => setComposeOpen(true)}
        title="Compose"
        className="flex items-center justify-center h-11 w-11 rounded-full bg-primary shadow-lg glow-box hover:scale-105 hover:shadow-[0_0_24px_oklch(0.623_0.214_259_/_40%)] active:scale-95 transition-all duration-200 mb-2 cursor-pointer"
      >
        <Plus className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
      </button>

      <div className="w-8 h-px bg-white/[0.08] my-2" />

      {/* User Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex items-center justify-center rounded-xl hover:bg-white/[0.06] transition-all duration-200 p-1 group cursor-pointer"
          title={profile?.display_name || "Profile"}
        >
          <Avatar className="h-9 w-9 ring-2 ring-white/[0.08] group-hover:ring-primary/30 transition-all">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
              {profile?.display_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side="right"
          className="w-56 rounded-xl shadow-xl border-border/50 ml-2"
        >
          <div className="px-3 py-2 border-b border-border/50">
            <p className="text-sm font-semibold truncate text-foreground">
              {profile?.display_name || user?.email}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              @{profile?.username || "user"}
            </p>
          </div>
          {profile?.username && (
            <Link href={`/${profile.username}`}>
              <DropdownMenuItem className="cursor-pointer">
                View Profile
              </DropdownMenuItem>
            </Link>
          )}
          <Link href="/settings">
            <DropdownMenuItem className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
          </Link>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut} className="text-destructive cursor-pointer">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </aside>
  );
}
