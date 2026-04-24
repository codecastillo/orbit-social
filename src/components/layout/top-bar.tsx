"use client";

import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { O, aurora, panel } from "@/lib/design/orbit";
import { NotificationBell } from "@/components/notifications/notification-bell";

export function TopBar() {
  return (
    <header
      className="sticky top-0 z-30 lg:hidden"
      style={{
        padding: "12px 16px 14px",
        background: `linear-gradient(180deg, ${O.bg}cc, ${O.bg}00)`,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        color: O.ink,
        fontFamily: O.sans,
      }}
    >
      <Link
        href="/feed"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          textDecoration: "none",
          color: O.ink,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: "relative",
            width: 28,
            height: 28,
            borderRadius: 8,
            background: aurora,
            boxShadow: `0 4px 14px -2px ${O.a2}80, inset 0 1px 0 rgba(255,255,255,0.3)`,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 3,
              borderRadius: 5,
              border: "1.5px solid rgba(255,255,255,0.5)",
            }}
          />
        </div>
        <span
          style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          Orbit
        </span>
      </Link>

      <div style={{ flex: 1 }} />

      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <Link
          href="/explore"
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            ...panel({ borderRadius: 12 }),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: O.ink2,
            textDecoration: "none",
          }}
        >
          <Search style={{ width: 16, height: 16 }} />
        </Link>
        <NotificationBell />
      </div>
    </header>
  );
}
