"use client";

import { useState, useMemo } from "react";
import { Calendar, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  ModalShell,
  Field,
  Input,
  TextArea,
  Toggle,
} from "@/components/orbit/forms";
import { DateTimePicker } from "@/components/orbit/datetime-picker";
import { useAuth } from "@/lib/hooks/use-auth";
import { createEvent } from "@/lib/queries/events";
import { zonedLocalToUTCISO, COMMON_TIMEZONES, browserTimezone } from "@/lib/utils/timezone";

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function CreateEventDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateEventDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const defaultTz = useMemo(() => browserTimezone(), []);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [timezone, setTimezone] = useState<string>(defaultTz);
  const [location, setLocation] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  const [onlineUrl, setOnlineUrl] = useState("");

  // Build the dropdown options: user's detected zone first (so it's always
  // top of the list), then the curated common zones excluding any duplicate.
  const tzOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [];
    if (defaultTz && !seen.has(defaultTz)) {
      opts.push({ value: defaultTz, label: `${defaultTz} (your timezone)` });
      seen.add(defaultTz);
    }
    for (const tz of COMMON_TIMEZONES) {
      if (!seen.has(tz.value)) {
        opts.push(tz);
        seen.add(tz.value);
      }
    }
    return opts;
  }, [defaultTz]);

  const reset = () => {
    setTitle("");
    setDescription("");
    setStartAt("");
    setEndAt("");
    setTimezone(defaultTz);
    setLocation("");
    setIsOnline(false);
    setOnlineUrl("");
  };

  const canSubmit = title.trim().length > 0 && startAt.length > 0 && !loading;

  const handleSubmit = async () => {
    if (!user || !canSubmit) return;
    setLoading(true);
    try {
      await createEvent(user.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        start_at: zonedLocalToUTCISO(startAt, timezone),
        end_at: endAt ? zonedLocalToUTCISO(endAt, timezone) : undefined,
        location: location.trim() || undefined,
        is_online: isOnline,
        online_url: isOnline && onlineUrl.trim() ? onlineUrl.trim() : undefined,
      });
      reset();
      onOpenChange(false);
      onCreated?.();
      toast.success("Event created");
    } catch (err) {
      console.error("Failed to create event:", err);
      toast.error("Failed to create event");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 border-0 bg-transparent shadow-none max-w-none w-auto ring-0"
      >
        <ModalShell
          title="Create an event"
          subtitle="Meetups, launches, listening sessions."
          icon={<Calendar className="h-[17px] w-[17px]" strokeWidth={1.8} />}
          width={560}
          primaryLabel={loading ? "Creating…" : "Create"}
          secondaryLabel="Cancel"
          canSubmit={canSubmit}
          loading={loading}
          onPrimary={handleSubmit}
          onSecondary={() => onOpenChange(false)}
          onClose={() => onOpenChange(false)}
        >
          <Field label="Title">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Film night · zine launch"
              autoFocus
            />
          </Field>
          <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
            <Field label="Starts" hint={timezone.replace("_", " ")}>
              <DateTimePicker
                value={startAt}
                onChange={setStartAt}
                placeholder="Pick a start"
              />
            </Field>
            <Field label="Ends">
              <DateTimePicker
                value={endAt}
                onChange={setEndAt}
                placeholder="Pick an end"
              />
            </Field>
          </div>
          <Field label="Timezone">
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full cursor-pointer appearance-none rounded-lg border border-border bg-surface px-3.5 py-[11px] text-[13.5px] text-foreground outline-none"
            >
              {tzOptions.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Where">
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Venue or address"
              prefix={<MapPin className="h-3.5 w-3.5" />}
            />
          </Field>
          <div className="mb-[18px] flex items-center gap-3 rounded-xl border border-border bg-surface-elevated px-3.5 py-3">
            <Toggle on={isOnline} onChange={setIsOnline} />
            <div className="flex-1">
              <div className="text-[13px] font-medium text-foreground">
                Online event
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                we&apos;ll generate a video link
              </div>
            </div>
          </div>
          {isOnline && (
            <Field label="Meeting URL">
              <Input
                value={onlineUrl}
                onChange={(e) => setOnlineUrl(e.target.value)}
                placeholder="https://meet.google.com/..."
                type="url"
              />
            </Field>
          )}
          <Field label="Description">
            <TextArea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell people what to show up for."
              rows={3}
            />
          </Field>
        </ModalShell>
      </DialogContent>
    </Dialog>
  );
}
