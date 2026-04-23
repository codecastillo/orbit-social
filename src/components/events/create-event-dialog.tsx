"use client";

import { useState } from "react";
import { Loader2Icon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

  function resetForm() {
    setTitle("");
    setDescription("");
    setStartAt("");
    setEndAt("");
    setLocation("");
    setIsOnline(false);
    setOnlineUrl("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !title.trim() || !startAt) return;

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

      resetForm();
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      console.error("Failed to create event:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Event</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">
              Title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event name"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">
              Start Date & Time
            </label>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              required
              className="w-full h-8 rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 [color-scheme:dark]"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">
              End Date & Time
            </label>
            <input
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className="w-full h-8 rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 [color-scheme:dark]"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">
              Location
            </label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Venue or address"
            />
          </div>

          {/* Online toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={isOnline}
              onClick={() => setIsOnline((v) => !v)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                isOnline ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  isOnline ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
            <span className="text-sm text-muted-foreground">Online event</span>
          </div>

          {isOnline && (
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">
                Meeting URL
              </label>
              <Input
                value={onlineUrl}
                onChange={(e) => setOnlineUrl(e.target.value)}
                placeholder="https://meet.google.com/..."
                type="url"
              />
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">
              Description
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell people about your event..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading || !title.trim() || !startAt}>
              {loading && <Loader2Icon className="h-4 w-4 animate-spin" />}
              {loading ? "Creating..." : "Create Event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
