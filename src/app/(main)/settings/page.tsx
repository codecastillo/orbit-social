"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  User,
  Shield,
  Bell,
  Settings as SettingsIcon,
  BarChart3,
  ChevronRight,
  KeyRound,
  Filter,
  Users,
  Radio,
} from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";

type Item = {
  href: string;
  icon: React.ComponentType<{
    className?: string;
    style?: React.CSSProperties;
    strokeWidth?: number;
  }>;
  title: string;
  description: string;
  hue: string;
};

type Section = {
  label: string;
  eyebrow: string;
  items: Item[];
};

const sections: Section[] = [
  {
    label: "Account",
    eyebrow: "◇  ACCOUNT",
    items: [
      {
        href: "/settings/profile",
        icon: User,
        title: "Profile",
        description: "Edit your avatar, display name, bio, and more",
        hue: "var(--primary)",
      },
      {
        href: "/settings/account",
        icon: SettingsIcon,
        title: "Account",
        description: "Manage your email, password, and account",
        hue: "var(--primary)",
      },
    ],
  },
  {
    label: "Privacy & Safety",
    eyebrow: "◆  PRIVACY & SAFETY",
    items: [
      {
        href: "/settings/privacy",
        icon: Shield,
        title: "Privacy",
        description: "Control who can see your content and activity",
        hue: "var(--primary)",
      },
      {
        href: "/settings/security",
        icon: KeyRound,
        title: "Security",
        description: "Two-factor authentication, login activity, and more",
        hue: "#ff8a5a",
      },
      {
        href: "/settings/filters",
        icon: Filter,
        title: "Word Filters",
        description: "Hide posts containing specific words from your feed",
        hue: "var(--primary)",
      },
    ],
  },
  {
    label: "Content & People",
    eyebrow: "◈  CONTENT & PEOPLE",
    items: [
      {
        href: "/settings/notifications",
        icon: Bell,
        title: "Notifications",
        description: "Choose what notifications you receive",
        hue: "#ffd76a",
      },
      {
        href: "/settings/close-friends",
        icon: Users,
        title: "Close Friends",
        description: "Manage your close friends list for private sharing",
        hue: "#7dffa3",
      },
    ],
  },
  {
    label: "Broadcasting",
    eyebrow: "◇  BROADCASTING",
    items: [
      {
        href: "/settings/streaming",
        icon: Radio,
        title: "Streaming",
        description: "Get your OBS / Belabox / mobile stream credentials",
        hue: "#ff5a6a",
      },
    ],
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
    <div className="flex flex-col gap-[22px] text-foreground">
      {/* Editorial hero */}
      <div>
        <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-primary">
          ◇&nbsp;&nbsp;SETTINGS
        </p>
        <h1 className="mt-2 text-[48px] font-bold leading-none tracking-[-0.035em]">
          Tune your <span className="text-primary">orbit</span>.
        </h1>
        <p className="mt-2.5 max-w-[520px] text-[14.5px] leading-[1.55] text-muted-foreground">
          Preferences, privacy, and the people you keep close.
        </p>
      </div>

      {sections.map((section) => (
        <SettingsSection key={section.label} section={section} />
      ))}

      {isCreator && (
        <SettingsSection
          section={{
            label: "Creator",
            eyebrow: "◇  CREATOR",
            items: [
              {
                href: "/settings/creator",
                icon: BarChart3,
                title: "Creator Analytics",
                description:
                  "View your content performance and audience insights",
                hue: "#7dffa3",
              },
            ],
          }}
        />
      )}
    </div>
  );
}

function SettingsSection({ section }: { section: Section }) {
  return (
    <div>
      <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {section.eyebrow}
      </p>
      <div className="mt-3 rounded-xl border border-border bg-surface px-[22px] py-1.5">
        {section.items.map((item, i) => (
          <SettingsRow key={item.href} item={item} isFirst={i === 0} />
        ))}
      </div>
    </div>
  );
}

function SettingsRow({ item, isFirst }: { item: Item; isFirst: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`group flex items-center gap-3.5 py-4 text-foreground no-underline ${
        isFirst ? "" : "border-t border-border"
      }`}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
        style={{
          background: `color-mix(in oklab, ${item.hue} 10%, transparent)`,
          borderColor: `color-mix(in oklab, ${item.hue} 20%, transparent)`,
        }}
      >
        <Icon
          className="h-[18px] w-[18px]"
          style={{ color: item.hue }}
          strokeWidth={1.8}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] font-semibold text-foreground">
          {item.title}
        </div>
        <div className="mt-0.5 text-[12.5px] leading-[1.4] text-muted-foreground">
          {item.description}
        </div>
      </div>
      <ChevronRight
        className="h-[18px] w-[18px] shrink-0 text-text-faint transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-text-secondary"
        strokeWidth={1.8}
      />
    </Link>
  );
}
