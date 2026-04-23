"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Compass,
  Clapperboard,
  MessageCircle,
  Bell,
  Users,
  ShoppingBag,
  Calendar,
  Bookmark,
  PenSquare,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUnreadCount } from "@/lib/hooks/use-notifications";
import { Button } from "@/components/ui/button";
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
import { APP_NAME } from "@/lib/utils/constants";

const navItems = [
  { label: "Home", href: "/feed", icon: Home },
  { label: "Explore", href: "/explore", icon: Compass },
  { label: "Reels", href: "/reels", icon: Clapperboard },
  { label: "Messages", href: "/messages", icon: MessageCircle },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Communities", href: "/communities", icon: Users },
  { label: "Marketplace", href: "/marketplace", icon: ShoppingBag },
  { label: "Events", href: "/events", icon: Calendar },
  { label: "Bookmarks", href: "/bookmarks", icon: Bookmark },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const setComposeOpen = useUIStore((s) => s.setComposeOpen);
  const { data: unreadCount } = useUnreadCount();

  return (
    <aside className="fixed left-0 top-0 h-full w-[272px] bg-card/80 backdrop-blur-xl border-r border-border/50 flex flex-col z-40 hidden lg:flex">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5">
        <Link href="/feed" className="flex items-center gap-2.5 group">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md shadow-primary/20 group-hover:shadow-lg group-hover:shadow-primary/30 transition-shadow">
            <span className="text-lg font-extrabold text-primary-foreground tracking-tight">O</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gradient">{APP_NAME}</h1>
        </Link>
      </div>

      {/* Separator */}
      <div className="mx-4 h-px bg-border/60" />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-[14.5px] font-medium transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary font-semibold shadow-sm"
                  : "text-muted-foreground hover:bg-accent/80 hover:text-foreground"
              )}
            >
              <span className="relative flex-shrink-0">
                <Icon
                  className={cn(
                    "h-[22px] w-[22px] transition-colors",
                    isActive ? "text-primary" : ""
                  )}
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
                {item.label === "Notifications" && !!unreadCount && unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold leading-none text-white bg-destructive rounded-full ring-2 ring-card shadow-sm">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Separator */}
      <div className="mx-4 h-px bg-border/60" />

      {/* Compose Button */}
      <div className="px-4 py-4">
        <Button
          className="w-full rounded-full h-12 text-[15px] font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200"
          size="lg"
          onClick={() => setComposeOpen(true)}
        >
          <PenSquare className="h-[18px] w-[18px] mr-2.5" />
          Compose
        </Button>
      </div>

      {/* Separator */}
      <div className="mx-4 h-px bg-border/60" />

      {/* User Menu */}
      <div className="px-3 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger>
            <button className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent/80 transition-all duration-200 w-full text-left group">
              <Avatar className="h-10 w-10 ring-2 ring-border/50 group-hover:ring-primary/30 transition-all">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
                  {user?.email?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-foreground">
                  {user?.user_metadata?.display_name || user?.email}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  @{user?.user_metadata?.username || "user"}
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 rounded-xl shadow-xl border-border/50">
            <Link href="/settings">
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
            </Link>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
