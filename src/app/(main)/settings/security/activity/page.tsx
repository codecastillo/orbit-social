"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Monitor,
  Smartphone,
  Loader2,
  Check,
  AlertTriangle,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  getLoginHistory,
  flagLoginEvent,
  parseUserAgent,
  type LoginEvent,
} from "@/lib/queries/security";
import { SettingsHeader } from "@/components/settings/settings-header";

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
      <div className="flex justify-center p-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[22px] text-foreground">
      <SettingsHeader section="Activity" glyph="◈" />

      <div>
        <h1 className="mt-1 text-5xl font-bold leading-none tracking-[-0.035em] text-foreground">
          Recent <span className="text-primary">activity</span>.
        </h1>
        <p className="mt-2.5 max-w-[560px] text-[14.5px] leading-[1.55] text-muted-foreground">
          Sign-ins to your account, newest first.
        </p>
      </div>

      {events.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-5 py-10 text-center text-muted-foreground">
          <div className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface">
            <Activity className="h-5 w-5 text-text-faint" />
          </div>
          <p className="m-0 font-semibold text-text-secondary">No activity yet</p>
          <p className="mt-1 text-[12.5px] text-text-faint">
            Your login history will appear here.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-2">
          {events.map((event, i) => {
            const { browser, os } = parseUserAgent(event.user_agent);
            const DeviceIcon = getDeviceIcon(event.user_agent);
            const isCurrentSession =
              typeof navigator !== "undefined" &&
              event.user_agent === navigator.userAgent &&
              new Date(event.created_at).getTime() > Date.now() - 60 * 60 * 1000;

            const accentClass =
              event.status === "failed"
                ? "border-destructive/20 bg-destructive/10 text-destructive"
                : event.flagged
                  ? "border-warning/20 bg-warning/10 text-warning"
                  : "border-border bg-surface-elevated text-muted-foreground";

            return (
              <div
                key={event.id}
                className={`flex items-start gap-3.5 p-3.5 ${
                  i ? "border-t border-border" : ""
                } ${isCurrentSession ? "rounded-xl bg-primary/10" : ""}`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${accentClass}`}
                >
                  <DeviceIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13.5px] font-semibold text-foreground">
                      {browser} · {os}
                    </span>
                    {isCurrentSession && (
                      <span className="rounded-full border border-success/25 bg-success/10 px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.12em] text-success">
                        CURRENT
                      </span>
                    )}
                    {event.status === "failed" && (
                      <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.12em] text-destructive">
                        FAILED
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2.5 font-mono text-[11px] tracking-[0.04em] text-text-faint">
                    <span>{formatDate(event.created_at)}</span>
                    {event.ip_address && (
                      <span className="inline-flex items-center gap-1">
                        <Globe className="h-[11px] w-[11px]" />
                        {event.ip_address}
                      </span>
                    )}
                  </div>
                  <div className="mt-2.5">
                    {!event.flagged ? (
                      <button
                        onClick={() => handleFlag(event.id, true)}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-destructive/30 bg-transparent px-2.5 py-[5px] text-[11.5px] font-semibold text-destructive"
                      >
                        <AlertTriangle className="h-[11px] w-[11px]" />
                        Not me
                      </button>
                    ) : (
                      <button
                        onClick={() => handleFlag(event.id, false)}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-success/30 bg-transparent px-2.5 py-[5px] text-[11.5px] font-semibold text-success"
                      >
                        <Check className="h-[11px] w-[11px]" />
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
