"use client";

import { useState } from "react";
import { Calendar } from "lucide-react";
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
import { O } from "@/lib/design/orbit";
import { useAuth } from "@/lib/hooks/use-auth";
import { createEvent } from "@/lib/queries/events";

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

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [location, setLocation] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  const [onlineUrl, setOnlineUrl] = useState("");

  const reset = () => {
    setTitle("");
    setDescription("");
    setStartAt("");
    setEndAt("");
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
        start_at: new Date(startAt).toISOString(),
        end_at: endAt ? new Date(endAt).toISOString() : undefined,
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
        style={{ boxShadow: "none" }}
      >
        <ModalShell
          title="Create an event"
          subtitle="Meetups, launches, listening sessions."
          icon={<Calendar style={{ width: 17, height: 17 }} strokeWidth={1.8} />}
          accent={O.a3}
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
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            <Field label="Starts" hint="local">
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
          <Field label="Where">
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Venue or address"
              prefix="📍"
            />
          </Field>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.025)",
              border: `1px solid ${O.hair2}`,
              marginBottom: 18,
            }}
          >
            <Toggle on={isOnline} onChange={setIsOnline} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: O.ink }}>
                Online event
              </div>
              <div style={{ fontSize: 11, color: O.ink3, marginTop: 2 }}>
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
