import {
  Bell,
  Calendar,
  Compass,
  Film,
  Globe,
  Home,
  MessageCircle,
  Play,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Which unread counter badges this item, if any. */
  badge?: "notifications" | "messages";
}

/** Primary app navigation. The sidebar renders all of it; the mobile bottom
 *  nav derives its five slots (plus compose/auth swaps) from a subset. */
export const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/feed", icon: Home },
  { label: "Clips", href: "/clips", icon: Film },
  { label: "Discover", href: "/explore", icon: Compass },
  { label: "Rooms", href: "/communities", icon: Globe },
  { label: "Live", href: "/live", icon: Play },
  { label: "Events", href: "/events", icon: Calendar },
  { label: "Messages", href: "/messages", icon: MessageCircle, badge: "messages" },
  { label: "Notifications", href: "/notifications", icon: Bell, badge: "notifications" },
];
