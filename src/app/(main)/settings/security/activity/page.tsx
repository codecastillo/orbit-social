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
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  getLoginHistory,
  flagLoginEvent,
  parseUserAgent,
  type LoginEvent,
} from "@/lib/queries/security";

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
      toast.success(flagged ? "Flagged as suspicious" : "Marked as safe");
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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-950/60 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="flex items-center gap-3 px-5 py-4">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
            <Activity className="h-4.5 w-4.5 text-purple-400" />
          </div>
          <h1
            className="text-xl font-bold tracking-tight text-zinc-100"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            Login Activity
          </h1>
        </div>
      </div>

      <div className="p-5">
        {events.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
              <Activity className="h-6 w-6 text-zinc-500" />
            </div>
            <p className="text-zinc-300 font-medium">No login events</p>
            <p className="text-sm text-zinc-500 mt-1">
              Your login history will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => {
              const { browser, os } = parseUserAgent(event.user_agent);
              const DeviceIcon = getDeviceIcon(event.user_agent);
              const isCurrentSession =
                event.user_agent === navigator.userAgent &&
                new Date(event.created_at).getTime() >
                  Date.now() - 60 * 60 * 1000;

              return (
                <div
                  key={event.id}
                  className={`rounded-2xl border p-4 transition-colors ${
                    event.flagged
                      ? "bg-red-500/[0.04] border-red-500/20"
                      : "bg-white/[0.03] border-white/[0.06]"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${
                        event.status === "failed"
                          ? "bg-red-500/10"
                          : event.flagged
                            ? "bg-amber-500/10"
                            : "bg-white/[0.06]"
                      }`}
                    >
                      <DeviceIcon
                        className={`h-5 w-5 ${
                          event.status === "failed"
                            ? "text-red-400"
                            : event.flagged
                              ? "text-amber-400"
                              : "text-zinc-400"
                        }`}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-zinc-200">
                          {browser} on {os}
                        </p>
                        {isCurrentSession && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
                            Current
                          </span>
                        )}
                        {event.status === "failed" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/10 text-red-400 ring-1 ring-red-500/20">
                            Failed
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                        <span>{formatDate(event.created_at)}</span>
                        {event.ip_address && (
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {event.ip_address}
                          </span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 mt-3">
                        {!event.flagged ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-3 text-xs rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={() => handleFlag(event.id, true)}
                          >
                            <AlertTriangle className="h-3 w-3 mr-1.5" />
                            Not me
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-3 text-xs rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                            onClick={() => handleFlag(event.id, false)}
                          >
                            <Check className="h-3 w-3 mr-1.5" />
                            This was me
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
