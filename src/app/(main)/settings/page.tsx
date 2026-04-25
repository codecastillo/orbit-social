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
} from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import { O, panel } from "@/lib/design/orbit";
import { Display, Acc, Eyebrow } from "@/components/orbit/primitives";

type Item = {
  href: string;
  icon: React.ComponentType<{ style?: React.CSSProperties; strokeWidth?: number }>;
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
        hue: O.a1,
      },
      {
        href: "/settings/account",
        icon: SettingsIcon,
        title: "Account",
        description: "Manage your email, password, and account",
        hue: O.a3,
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
        hue: O.a3,
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
        hue: O.a2,
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
    <div
      style={{
        color: O.ink,
        fontFamily: O.sans,
        display: "flex",
        flexDirection: "column",
        gap: 22,
      }}
    >
      {/* Editorial hero */}
      <div>
        <Eyebrow accent>◇&nbsp;&nbsp;SETTINGS</Eyebrow>
        <Display size={48} style={{ marginTop: 8 }}>
          Tune your <Acc>orbit</Acc>.
        </Display>
        <p
          style={{
            fontSize: 14.5,
            color: O.ink3,
            marginTop: 10,
            lineHeight: 1.55,
            maxWidth: 520,
          }}
        >
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
      <Eyebrow>{section.eyebrow}</Eyebrow>
      <div
        style={{
          ...panel({ borderRadius: 22 }),
          padding: "6px 22px",
          marginTop: 12,
        }}
      >
        {section.items.map((item, i) => (
          <SettingsRow key={item.href} item={item} isFirst={i === 0} />
        ))}
      </div>
    </div>
  );
}

function SettingsRow({ item, isFirst }: { item: Item; isFirst: boolean }) {
  const [hovered, setHovered] = useState(false);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "16px 0",
        borderTop: isFirst ? "none" : `1px solid ${O.hair}`,
        textDecoration: "none",
        color: O.ink,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: `${item.hue}1a`,
          border: `1px solid ${item.hue}33`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon
          style={{ width: 18, height: 18, color: item.hue }}
          strokeWidth={1.8}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: O.ink }}>
          {item.title}
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: O.ink3,
            marginTop: 2,
            lineHeight: 1.4,
          }}
        >
          {item.description}
        </div>
      </div>
      <ChevronRight
        style={{
          width: 18,
          height: 18,
          color: hovered ? O.ink2 : O.ink4,
          transform: hovered ? "translateX(2px)" : "none",
          transition: "all 150ms cubic-bezier(0.16,1,0.3,1)",
          flexShrink: 0,
        }}
        strokeWidth={1.8}
      />
    </Link>
  );
}
