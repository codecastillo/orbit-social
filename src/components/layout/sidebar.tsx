"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import {
  Home,
  Film,
  Compass,
  Globe,
  Play,
  Calendar,
  MessageCircle,
  Bell,
  LogOut,
  Settings,
  MoreHorizontal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useUnreadCount, useUnreadMessagesCount } from "@/lib/hooks/use-notifications";
import { useCurrentProfile, type CurrentProfile } from "@/lib/hooks/use-profile";
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
import { O, aurora, auroraSoft, panel } from "@/lib/design/orbit";
import { PillBtn } from "@/components/orbit/primitives";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { label: "Home", href: "/feed", icon: Home },
  { label: "Clips", href: "/clips", icon: Film },
  { label: "Discover", href: "/explore", icon: Compass },
  { label: "Rooms", href: "/communities", icon: Globe },
  { label: "Live", href: "/live", icon: Play },
  { label: "Events", href: "/events", icon: Calendar },
  { label: "Messages", href: "/messages", icon: MessageCircle },
  { label: "Notifications", href: "/notifications", icon: Bell },
];

export function Sidebar({
  initialProfile,
}: {
  initialProfile?: CurrentProfile | null;
}) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const setComposeOpen = useUIStore((s) => s.setComposeOpen);
  const { data: unreadCount } = useUnreadCount();
  const { data: unreadMessages } = useUnreadMessagesCount();
  const { data: liveProfile } = useCurrentProfile();
  // Use the server-prefetched profile until live data arrives. This makes
  // the sidebar render the real avatar/name on the very first paint.
  const profile = liveProfile ?? initialProfile ?? null;

  const activeHref = useMemo(
    () =>
      NAV.find((n) => pathname === n.href || pathname.startsWith(n.href + "/"))
        ?.href ?? "",
    [pathname],
  );

  return (
    <aside
      className="fixed left-6 top-6 bottom-6 w-[260px] z-40 hidden lg:flex flex-col"
      style={{ ...panel(), padding: "24px 18px", gap: 4 }}
    >
      {/* Logo block */}
      <Link
        href="/feed"
        className="flex items-center gap-[10px] px-2 pb-[18px] pt-1"
      >
        <div
          className="relative"
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: aurora,
            boxShadow: `0 4px 14px -2px ${O.a2}80, inset 0 1px 0 rgba(255,255,255,0.3)`,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 4,
              borderRadius: 6,
              border: "1.5px solid rgba(255,255,255,0.5)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 9,
              left: 9,
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: "white",
            }}
          />
        </div>
        <div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: O.ink,
            }}
          >
            Orbit
          </div>
          <div
            style={{
              fontSize: 9.5,
              color: O.ink3,
              fontFamily: O.mono,
              letterSpacing: "0.14em",
              marginTop: -2,
            }}
          >
            EVERYONE&apos;S RADIUS
          </div>
        </div>
      </Link>

      {/* Nav */}
      <nav className="flex flex-col gap-1 flex-1">
        {NAV.map((item) => {
          const isActive = activeHref === item.href;
          const Icon = item.icon;
          const badge =
            item.label === "Notifications" && unreadCount && unreadCount > 0
              ? unreadCount
              : item.label === "Messages" && unreadMessages && unreadMessages > 0
                ? unreadMessages
                : null;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "11px 14px",
                borderRadius: 14,
                fontSize: 14,
                fontWeight: isActive ? 600 : 500,
                background: isActive ? auroraSoft : "transparent",
                border: isActive
                  ? `1px solid ${O.hair2}`
                  : "1px solid transparent",
                color: isActive ? O.ink : O.ink2,
                boxShadow: isActive
                  ? "inset 0 1px 0 rgba(255,255,255,0.06)"
                  : "none",
              }}
            >
              <Icon style={{ width: 18, height: 18 }} strokeWidth={1.8} />
              <span>{item.label}</span>
              {badge && (
                <span
                  style={{
                    marginLeft: "auto",
                    background: O.a2,
                    color: "white",
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 7px",
                    borderRadius: 99,
                  }}
                >
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
              {isActive && (
                <span
                  style={{
                    position: "absolute",
                    left: -19,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 3,
                    height: 18,
                    borderRadius: 2,
                    background: aurora,
                    boxShadow: `0 0 12px ${O.a2}`,
                  }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer block — compose + user */}
      <div
        style={{
          marginTop: 18,
          paddingTop: 18,
          borderTop: `1px solid ${O.hair}`,
        }}
      >
        <PillBtn
          primary
          size="lg"
          onClick={() => setComposeOpen(true)}
          style={{ width: "100%", justifyContent: "center" }}
        >
          Compose
        </PillBtn>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 4px 0",
            width: "100%",
          }}
        >
          {/* Avatar + name go to the user's profile page directly. While
              the profile is hydrating we render a transparent placeholder
              of the same dimensions to avoid the 'You / @you' flash. */}
          {profile ? (
            <Link
              href={`/${profile.username}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flex: 1,
                minWidth: 0,
                color: O.ink,
                textDecoration: "none",
              }}
            >
              <Avatar className="h-9 w-9 rounded-full">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback
                  style={{
                    background: aurora,
                    color: "white",
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  {profile.display_name?.[0]?.toUpperCase() ||
                    user?.email?.[0]?.toUpperCase() ||
                    "U"}
                </AvatarFallback>
              </Avatar>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: O.ink,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {profile.display_name || profile.username}
                </div>
                <div style={{ fontSize: 11, color: O.ink3 }}>
                  @{profile.username}
                </div>
              </div>
            </Link>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flex: 1,
                minWidth: 0,
                opacity: 0,
                pointerEvents: "none",
              }}
              aria-hidden
            >
              <div className="h-9 w-9 rounded-full" />
              <div style={{ flex: 1 }}>
                <div style={{ height: 16 }} />
                <div style={{ height: 14 }} />
              </div>
            </div>
          )}

          {/* 3-dots opens the settings/sign-out menu. */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="cursor-pointer shrink-0"
              aria-label="Account menu"
              style={{
                width: 30,
                height: 30,
                display: "grid",
                placeItems: "center",
                background: "transparent",
                border: 0,
                color: O.ink3,
                borderRadius: 999,
              }}
            >
              <MoreHorizontal style={{ width: 16, height: 16 }} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-56 rounded-2xl">
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
        </div>
      </div>
    </aside>
  );
}
