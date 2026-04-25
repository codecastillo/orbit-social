"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Monitor,
  Smartphone,
  Loader2,
  Check,
  AlertTriangle,
  Globe,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  getLoginHistory,
  flagLoginEvent,
  parseUserAgent,
  type LoginEvent,
} from "@/lib/queries/security";
import { O, panel } from "@/lib/design/orbit";
import { Display, Acc, Eyebrow } from "@/components/orbit/primitives";

export default function LoginActivityPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<LoginEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getLoginHistory(user.id)
      .then(setEvents)
      .catch(() => toast.error("Failed to load login history"))
      .finally(() => setLoading(false));
  }, [user]);

  const handleFlag = async (eventId: string, flagged: boolean) => {
    try {
      await flagLoginEvent(eventId, flagged);
      setEvents((prev) =>
        prev.map((e) => (e.id === eventId ? { ...e, flagged } : e))
      );
      toast.success(flagged ? "Flagged" : "Marked safe");
    } catch {
      toast.error("Failed to update event");
    }
  };

  const getDeviceIcon = (ua: string | null) => {
    if (!ua) return Monitor;
    if (ua.includes("Mobile") || ua.includes("Android") || ua.includes("iPhone"))
      return Smartphone;
    return Monitor;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  };

  if (loading) {
    return (
      <div style={{ padding: 48, display: "flex", justifyContent: "center" }}>
        <Loader2 style={{ width: 20, height: 20, color: O.ink3 }} className="animate-spin" />
      </div>
    );
  }

  return (
    <div style={{ color: O.ink, fontFamily: O.sans, display: "flex", flexDirection: "column", gap: 22 }}>
      <Link
        href="/settings/security"
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
        BACK · SECURITY
      </Link>

      <div>
        <Eyebrow accent>◇&nbsp;&nbsp;SECURITY · ACTIVITY</Eyebrow>
        <Display size={48} style={{ marginTop: 8 }}>
          Recent <Acc>activity</Acc>.
        </Display>
        <p style={{ fontSize: 14.5, color: O.ink3, marginTop: 10, lineHeight: 1.55, maxWidth: 560 }}>
          Sign-ins to your account, newest first.
        </p>
      </div>

      {events.length === 0 ? (
        <div
          style={{
            ...panel({ borderRadius: 18 }),
            padding: "40px 20px",
            textAlign: "center",
            color: O.ink3,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              margin: "0 auto 14px",
              borderRadius: 12,
              background: O.glass,
              border: `1px solid ${O.hair}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Activity style={{ width: 20, height: 20, color: O.ink4 }} />
          </div>
          <p style={{ fontWeight: 600, color: O.ink2, margin: 0 }}>No activity yet</p>
          <p style={{ fontSize: 12.5, color: O.ink4, margin: "4px 0 0" }}>
            Your login history will appear here.
          </p>
        </div>
      ) : (
        <div
          style={{
            ...panel({ borderRadius: 18 }),
            padding: 8,
          }}
        >
          {events.map((event, i) => {
            const { browser, os } = parseUserAgent(event.user_agent);
            const DeviceIcon = getDeviceIcon(event.user_agent);
            const isCurrentSession =
              typeof navigator !== "undefined" &&
              event.user_agent === navigator.userAgent &&
              new Date(event.created_at).getTime() > Date.now() - 60 * 60 * 1000;

            const accent =
              event.status === "failed"
                ? "#ff7a85"
                : event.flagged
                  ? "#ffd76a"
                  : O.ink3;

            return (
              <div
                key={event.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  padding: "14px 14px",
                  borderTop: i ? `1px solid ${O.hair}` : "none",
                  ...(isCurrentSession
                    ? {
                        background: `linear-gradient(135deg, ${O.a1}1a 0%, ${O.a2}0e 50%, ${O.a3}14 100%)`,
                        borderRadius: 12,
                      }
                    : {}),
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: `${accent}1a`,
                    border: `1px solid ${accent}33`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <DeviceIcon style={{ width: 16, height: 16, color: accent }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: O.ink }}>
                      {browser} · {os}
                    </span>
                    {isCurrentSession && (
                      <span
                        style={{
                          fontSize: 10,
                          fontFamily: O.mono,
                          fontWeight: 700,
                          letterSpacing: "0.12em",
                          padding: "2px 8px",
                          borderRadius: 99,
                          background: "rgba(125,255,163,0.12)",
                          border: "1px solid rgba(125,255,163,0.25)",
                          color: "#7dffa3",
                        }}
                      >
                        CURRENT
                      </span>
                    )}
                    {event.status === "failed" && (
                      <span
                        style={{
                          fontSize: 10,
                          fontFamily: O.mono,
                          fontWeight: 700,
                          letterSpacing: "0.12em",
                          padding: "2px 8px",
                          borderRadius: 99,
                          background: "rgba(255,122,133,0.1)",
                          border: "1px solid rgba(255,122,133,0.3)",
                          color: "#ff9aa3",
                        }}
                      >
                        FAILED
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginTop: 6,
                      fontSize: 11,
                      color: O.ink4,
                      fontFamily: O.mono,
                      letterSpacing: "0.04em",
                    }}
                  >
                    <span>{formatDate(event.created_at)}</span>
                    {event.ip_address && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Globe style={{ width: 11, height: 11 }} />
                        {event.ip_address}
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    {!event.flagged ? (
                      <button
                        onClick={() => handleFlag(event.id, true)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "5px 10px",
                          borderRadius: 99,
                          background: "transparent",
                          border: "1px solid rgba(255,122,133,0.3)",
                          color: "#ff9aa3",
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: O.sans,
                        }}
                      >
                        <AlertTriangle style={{ width: 11, height: 11 }} />
                        Not me
                      </button>
                    ) : (
                      <button
                        onClick={() => handleFlag(event.id, false)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "5px 10px",
                          borderRadius: 99,
                          background: "transparent",
                          border: "1px solid rgba(125,255,163,0.3)",
                          color: "#7dffa3",
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: O.sans,
                        }}
                      >
                        <Check style={{ width: 11, height: 11 }} />
                        This was me
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
