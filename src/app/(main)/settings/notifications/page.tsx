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
import { O } from "@/lib/design/orbit";
import { Display, Acc, Eyebrow, PillBtn } from "@/components/orbit/primitives";
import { FormSection, Toggle } from "@/components/orbit/forms";

interface NotificationPref {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ style?: React.CSSProperties }>;
  hue: string;
  enabled: boolean;
}

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<NotificationPref[]>([
    { key: "likes", label: "Likes", description: "When someone likes your post.", icon: Heart, hue: O.a2, enabled: true },
    { key: "comments", label: "Comments", description: "When someone comments on your post.", icon: MessageCircle, hue: O.a3, enabled: true },
    { key: "follows", label: "New followers", description: "When someone follows you.", icon: UserPlus, hue: O.a1, enabled: true },
    { key: "mentions", label: "Mentions", description: "When someone mentions you in a post.", icon: AtSign, hue: "#ffd76a", enabled: true },
    { key: "messages", label: "Direct messages", description: "When you receive a new DM.", icon: Mail, hue: "#7dffa3", enabled: true },
  ]);

  const togglePref = (key: string) => {
    setPrefs((prev) =>
      prev.map((p) => (p.key === key ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const handleSave = () => {
    toast.success("Saved");
  };

  return (
    <div style={{ color: O.ink, fontFamily: O.sans, display: "flex", flexDirection: "column", gap: 18 }}>
      <Link
        href="/settings"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: O.ink3,
          fontFamily: O.mono,
          fontSize: 11,
          letterSpacing: "0.12em",
          textDecoration: "none",
          width: "fit-content",
        }}
      >
        <ArrowLeft style={{ width: 12, height: 12 }} />
        BACK · SETTINGS
      </Link>

      <div>
        <Eyebrow accent>◈&nbsp;&nbsp;SETTINGS · NOTIFICATIONS</Eyebrow>
        <Display size={48} style={{ marginTop: 8 }}>
          What breaks <Acc>through</Acc>.
        </Display>
        <p style={{ fontSize: 14.5, color: O.ink3, marginTop: 10, lineHeight: 1.55, maxWidth: 560 }}>
          Pick the signals you actually want. Everything else stays quiet.
        </p>
      </div>

      <FormSection title="Push notifications">
        <div>
          {prefs.map((pref, i) => {
            const Icon = pref.icon;
            return (
              <div
                key={pref.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 0",
                  borderTop: i ? `1px solid ${O.hair}` : "none",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: `${pref.hue}1a`,
                    border: `1px solid ${pref.hue}33`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon style={{ width: 16, height: 16, color: pref.hue }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: O.ink }}>{pref.label}</div>
                  <div style={{ fontSize: 12.5, color: O.ink3, marginTop: 2 }}>{pref.description}</div>
                </div>
                <Toggle on={pref.enabled} onChange={() => togglePref(pref.key)} />
              </div>
            );
          })}
        </div>
      </FormSection>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <PillBtn primary size="lg" onClick={handleSave}>
          Save changes
        </PillBtn>
      </div>
    </div>
  );
}
