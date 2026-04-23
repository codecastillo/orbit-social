"use client";

import Link from "next/link";
import {
  User,
  Shield,
  Bell,
  Settings,
  BarChart3,
  ChevronRight,
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
  },
  {
    href: "/settings/privacy",
    icon: Shield,
    title: "Privacy",
    description: "Control who can see your content and activity",
  },
  {
    href: "/settings/notifications",
    icon: Bell,
    title: "Notifications",
    description: "Choose what notifications you receive",
  },
  {
    href: "/settings/account",
    icon: Settings,
    title: "Account",
    description: "Manage your email, password, and account",
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
    <div className="border-x border-border min-h-screen">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold">Settings</h2>
      </div>

      <div className="p-4 space-y-2">
        {settingsItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-4 p-4 rounded-xl glass hover:bg-white/5 transition-colors group"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
              <item.icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground">{item.title}</p>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </Link>
        ))}

        {isCreator && (
          <Link
            href="/settings/creator"
            className="flex items-center gap-4 p-4 rounded-xl glass hover:bg-white/5 transition-colors group"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/20">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground">Creator Analytics</p>
              <p className="text-sm text-muted-foreground">
                View your content performance and audience insights
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </Link>
        )}
      </div>
    </div>
  );
}
