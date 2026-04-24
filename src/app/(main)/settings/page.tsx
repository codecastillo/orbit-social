"use client";

import Link from "next/link";
import {
  User,
  Shield,
  Bell,
  Settings,
  BarChart3,
  ChevronRight,
  KeyRound,
  Filter,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

const settingsItems = [
  {
    href: "/settings/profile",
    icon: User,
    title: "Profile",
    description: "Edit your avatar, display name, bio, and more",
    gradient: "from-violet-500/20 to-purple-500/20",
    iconColor: "text-violet-400",
  },
  {
    href: "/settings/privacy",
    icon: Shield,
    title: "Privacy",
    description: "Control who can see your content and activity",
    gradient: "from-cyan-500/20 to-blue-500/20",
    iconColor: "text-cyan-400",
  },
  {
    href: "/settings/notifications",
    icon: Bell,
    title: "Notifications",
    description: "Choose what notifications you receive",
    gradient: "from-amber-500/20 to-orange-500/20",
    iconColor: "text-amber-400",
  },
  {
    href: "/settings/account",
    icon: Settings,
    title: "Account",
    description: "Manage your email, password, and account",
    gradient: "from-zinc-400/20 to-zinc-500/20",
    iconColor: "text-zinc-400",
  },
  {
    href: "/settings/security",
    icon: KeyRound,
    title: "Security",
    description: "Two-factor authentication, login activity, and more",
    gradient: "from-red-500/20 to-orange-500/20",
    iconColor: "text-red-400",
  },
  {
    href: "/settings/filters",
    icon: Filter,
    title: "Word Filters",
    description: "Hide posts containing specific words from your feed",
    gradient: "from-pink-500/20 to-rose-500/20",
    iconColor: "text-pink-400",
  },
  {
    href: "/settings/close-friends",
    icon: Users,
    title: "Close Friends",
    description: "Manage your close friends list for private sharing",
    gradient: "from-emerald-500/20 to-teal-500/20",
    iconColor: "text-emerald-400",
  },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [isCreator, setIsCreator] = useState(false);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("is_creator")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.is_creator) setIsCreator(true);
      });
  }, [user]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-2xl bg-background/80 border-b border-white/[0.06]">
        <div className="flex items-center gap-3 px-5 py-4">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-zinc-400/20 to-zinc-500/20 flex items-center justify-center">
            <Settings className="h-4.5 w-4.5 text-zinc-400" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight">Settings</h1>
        </div>
      </div>

      <div className="p-5 space-y-2">
        {settingsItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-xl hover:bg-white/[0.06] transition-all group"
          >
            <div className={`flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br ${item.gradient}`}>
              <item.icon className={`h-5 w-5 ${item.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-zinc-200">{item.title}</p>
              <p className="text-sm text-zinc-500">{item.description}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
          </Link>
        ))}

        {isCreator && (
          <Link
            href="/settings/creator"
            className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-xl hover:bg-white/[0.06] transition-all group"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
              <BarChart3 className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-zinc-200">Creator Analytics</p>
              <p className="text-sm text-zinc-500">
                View your content performance and audience insights
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
          </Link>
        )}
      </div>
    </div>
  );
}
