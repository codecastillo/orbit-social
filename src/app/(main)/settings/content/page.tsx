"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { FormSection, Input, RadioRow } from "@/components/orbit/forms";
import { SettingsHeader } from "@/components/settings/settings-header";
import {
  getContentPreferences,
  getSensitiveContentLevel,
  normalizeTopic,
  removeTopicPreference,
  setSensitiveContentLevel,
  setTopicPreference,
  type ContentPreference,
  type SensitiveContentLevel,
  type TopicPreference,
} from "@/lib/queries/content-preferences";
import {
  REMINDER_OPTIONS,
  useTimeOnOrbitStats,
} from "@/lib/hooks/use-time-on-orbit";

const SENSITIVE_OPTIONS: { value: SensitiveContentLevel; label: string; hint: string }[] = [
  { value: "less", label: "Less", hint: "Filter more aggressively" },
  { value: "standard", label: "Standard", hint: "The default balance" },
  { value: "more", label: "More", hint: "Filter as little as allowed" },
];

function SegmentedPreference({
  value,
  onChange,
}: {
  value: TopicPreference;
  onChange: (v: TopicPreference) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-border">
      {(["see_more", "see_less"] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={`cursor-pointer px-3 py-1.5 text-[12px] font-semibold transition-colors ${
            value === option
              ? "bg-primary/15 text-primary"
              : "bg-surface text-muted-foreground hover:text-foreground"
          }`}
        >
          {option === "see_more" ? "See more" : "See less"}
        </button>
      ))}
    </div>
  );
}

function TimeOnOrbitSection() {
  const { todayMinutes, dailyAverageMinutes, threshold, setThreshold } =
    useTimeOnOrbitStats();

  return (
    <FormSection title="Time on Orbit" hint="stays on this device">
      <div className="flex gap-8">
        <div>
          <div className="text-2xl font-bold tabular-nums text-foreground">
            {todayMinutes} min
          </div>
          <div className="mt-0.5 text-[12px] text-muted-foreground">Today</div>
        </div>
        <div>
          <div className="text-2xl font-bold tabular-nums text-foreground">
            {dailyAverageMinutes} min
          </div>
          <div className="mt-0.5 text-[12px] text-muted-foreground">
            Daily average, last 7 days
          </div>
        </div>
      </div>
      <div className="mt-5">
        <div className="text-sm font-semibold text-foreground">Daily reminder</div>
        <p className="mb-3 mt-1 text-[12.5px] leading-[1.45] text-muted-foreground">
          One quiet heads-up per day once you pass this much active time. Never
          blocks anything.
        </p>
        <RadioRow
          options={REMINDER_OPTIONS.map((minutes) => ({
            value: String(minutes),
            label: minutes === 0 ? "Off" : `${minutes} min`,
          }))}
          value={String(threshold)}
          onChange={(v) => setThreshold(Number(v))}
        />
      </div>
    </FormSection>
  );
}

export default function ContentSettingsPage() {
  const { user, loading: authLoading } = useAuth();

  const [level, setLevel] = useState<SensitiveContentLevel>("standard");
  const [preferences, setPreferences] = useState<ContentPreference[]>([]);
  const [newTopic, setNewTopic] = useState("");
  const [adding, setAdding] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([getSensitiveContentLevel(user.id), getContentPreferences(user.id)])
      .then(([savedLevel, savedPreferences]) => {
        setLevel(savedLevel);
        setPreferences(savedPreferences);
      })
      .catch(() => toast.error("Couldn't load content settings"))
      .finally(() => setPageLoading(false));
  }, [user]);

  const handleLevelChange = async (next: SensitiveContentLevel) => {
    if (!user) return;
    const previous = level;
    setLevel(next);
    try {
      await setSensitiveContentLevel(user.id, next);
    } catch {
      setLevel(previous);
      toast.error("Couldn't update sensitive content level");
    }
  };

  const handlePreferenceChange = async (topic: string, preference: TopicPreference) => {
    if (!user) return;
    const previous = preferences;
    setPreferences((prev) =>
      prev.map((p) => (p.topic === topic ? { ...p, preference } : p)),
    );
    try {
      await setTopicPreference(user.id, topic, preference);
    } catch {
      setPreferences(previous);
      toast.error(`Couldn't update "${topic}"`);
    }
  };

  const handleRemove = async (topic: string) => {
    if (!user) return;
    const previous = preferences;
    setPreferences((prev) => prev.filter((p) => p.topic !== topic));
    try {
      await removeTopicPreference(user.id, topic);
    } catch {
      setPreferences(previous);
      toast.error(`Couldn't remove "${topic}"`);
    }
  };

  const handleAdd = async () => {
    if (!user) return;
    const topic = normalizeTopic(newTopic);
    if (!topic) return;
    if (preferences.some((p) => p.topic === topic)) {
      toast.error(`"${topic}" is already in your list`);
      return;
    }
    setAdding(true);
    try {
      await setTopicPreference(user.id, topic, "see_more");
      setPreferences((prev) =>
        [...prev, { topic, preference: "see_more" as const }].sort((a, b) =>
          a.topic.localeCompare(b.topic),
        ),
      );
      setNewTopic("");
    } catch {
      toast.error(`Couldn't add "${topic}"`);
    } finally {
      setAdding(false);
    }
  };

  if (authLoading || pageLoading) {
    return (
      <div className="flex flex-col gap-[18px]">
        <Skeleton className="h-16 w-1/2 rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[18px] text-foreground">
      <SettingsHeader section="Content" glyph="◆" />

      <div>
        <h1 className="mt-1 text-4xl sm:text-[48px] font-bold leading-none tracking-[-0.035em]">
          Tuned to <span className="text-primary">you</span>.
        </h1>
        <p className="mt-2.5 max-w-[560px] text-[14.5px] leading-[1.55] text-muted-foreground">
          What shows up, what stays out, and how much of your day it takes.
        </p>
      </div>

      <FormSection title="Sensitive content">
        <p className="mb-3 mt-0 text-[12.5px] leading-[1.45] text-muted-foreground">
          How much potentially sensitive content can appear in your feeds.
        </p>
        <RadioRow
          options={SENSITIVE_OPTIONS}
          value={level}
          onChange={handleLevelChange}
        />
      </FormSection>

      <FormSection title="Topic preferences">
        <p className="mb-3 mt-0 text-[12.5px] leading-[1.45] text-muted-foreground">
          Topics you add here nudge your For You ranking toward or away from them.
        </p>
        {preferences.length === 0 ? (
          <p className="m-0 py-1 text-[12.5px] text-muted-foreground">
            No topics yet. Add one below.
          </p>
        ) : (
          <div>
            {preferences.map((pref, index) => (
              <div
                key={pref.topic}
                className={`flex items-center gap-3 py-2.5 ${index > 0 ? "border-t border-border" : ""}`}
              >
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                  {pref.topic}
                </span>
                <SegmentedPreference
                  value={pref.preference}
                  onChange={(preference) =>
                    handlePreferenceChange(pref.topic, preference)
                  }
                />
                <button
                  type="button"
                  aria-label={`Remove ${pref.topic}`}
                  onClick={() => handleRemove(pref.topic)}
                  className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center gap-2.5 border-t border-border pt-3.5">
          <div className="flex-1">
            <Input
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
              placeholder="Add a topic, like photography"
              aria-label="Add a topic"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAdd}
            disabled={adding || !newTopic.trim()}
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>
      </FormSection>

      <TimeOnOrbitSection />
    </div>
  );
}
