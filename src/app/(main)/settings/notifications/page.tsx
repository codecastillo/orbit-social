"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  UserPlus,
  AtSign,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface NotificationPref {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled: boolean;
}

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<NotificationPref[]>([
    {
      key: "likes",
      label: "Likes",
      description: "When someone likes your post",
      icon: Heart,
      enabled: true,
    },
    {
      key: "comments",
      label: "Comments",
      description: "When someone comments on your post",
      icon: MessageCircle,
      enabled: true,
    },
    {
      key: "follows",
      label: "New Followers",
      description: "When someone follows you",
      icon: UserPlus,
      enabled: true,
    },
    {
      key: "mentions",
      label: "Mentions",
      description: "When someone mentions you in a post",
      icon: AtSign,
      enabled: true,
    },
    {
      key: "messages",
      label: "Messages",
      description: "When you receive a new direct message",
      icon: Mail,
      enabled: true,
    },
  ]);

  const togglePref = (key: string) => {
    setPrefs((prev) =>
      prev.map((p) => (p.key === key ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const handleSave = () => {
    // For now, just show a toast — will wire to DB later
    toast.success("Notification preferences saved");
  };

  return (
    <div className="border-x border-border min-h-screen">
      <div className="p-4 border-b border-border flex items-center gap-3">
        <Link href="/settings" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h2 className="text-lg font-semibold">Notifications</h2>
      </div>

      <div className="p-4 space-y-2">
        {prefs.map((pref) => {
          const Icon = pref.icon;
          return (
            <div
              key={pref.key}
              className="glass rounded-xl p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">{pref.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {pref.description}
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={pref.enabled}
                onClick={() => togglePref(pref.key)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  pref.enabled ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                    pref.enabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>

      <div className="p-4 pt-2">
        <Button onClick={handleSave} className="w-full">
          Save Preferences
        </Button>
      </div>
    </div>
  );
}
