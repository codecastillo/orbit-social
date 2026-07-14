"use client";

import { useEffect } from "react";
import { Trash2, FileText, Pencil, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useDraftsStore, type Draft } from "@/lib/stores/drafts-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { formatTimeAgo } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { OrbitEmptyState } from "@/components/orbit/empty-state";

export default function DraftsPage() {
  const { drafts, hydrate, hydrated, deleteDraft } = useDraftsStore();
  const setComposeOpen = useUIStore((s) => s.setComposeOpen);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const handleEdit = (draft: Draft) => {
    sessionStorage.setItem(
      "orbit_editing_draft",
      JSON.stringify({
        id: draft.id,
        content: draft.content,
        location: draft.location || "",
      })
    );
    setComposeOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteDraft(id);
    toast.success("Draft deleted");
  };

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-[18px]">
        <div className="h-[68px] animate-pulse rounded-xl bg-surface" />
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[100px] animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[18px] text-foreground">
      <div className="flex flex-wrap items-end justify-between gap-[18px]">
        <div>
          <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-primary">
            ◇&nbsp;&nbsp;COMPOSE · DRAFTS · {drafts.length}
          </p>
          <h1 className="mt-2 text-[48px] font-bold leading-none tracking-[-0.035em] text-foreground">
            Unfinished <span className="text-primary">thoughts</span>.
          </h1>
          <p className="mt-2.5 max-w-[540px] text-[14.5px] leading-[1.55] text-muted-foreground">
            Picked back up when you&apos;re ready. Nothing posted, nothing lost.
          </p>
        </div>
        <Button size="lg" onClick={() => setComposeOpen(true)}>
          <Pencil />
          New draft
        </Button>
      </div>

      {drafts.length === 0 ? (
        <OrbitEmptyState
          icon={FileText}
          accent="var(--primary)"
          headline="Nothing"
          accentWord="half-written"
          sub="Save a post as a draft and it'll show up here. Nothing posted until you say so."
          ctaLabel="Start a post"
          ctaIcon={<Pencil className="size-3" />}
          onCta={() => setComposeOpen(true)}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {drafts.map((draft) => (
            <div
              key={draft.id}
              className="relative flex gap-4 overflow-hidden rounded-xl border border-border bg-surface p-[18px]"
            >
              <div className="absolute inset-y-0 left-0 w-[3px] bg-primary" />
              <div className="min-w-0 flex-1">
                <div className="mb-2.5 font-mono text-[10.5px] tracking-[0.12em] text-primary">
                  ◆&nbsp;&nbsp;DRAFT · {formatTimeAgo(draft.updatedAt || draft.createdAt).toUpperCase()}
                </div>

                {draft.content ? (
                  <p className="line-clamp-3 whitespace-pre-wrap text-[14.5px] leading-normal text-foreground">
                    {draft.content}
                  </p>
                ) : (
                  <p className="text-sm italic text-text-faint">No text yet, media only.</p>
                )}

                {draft.location && (
                  <div className="mt-2.5 inline-flex items-center gap-[5px] font-mono text-[11px] tracking-[0.04em] text-muted-foreground">
                    <MapPin className="size-[11px]" />
                    {draft.location}
                  </div>
                )}

                {draft.media.length > 0 && (
                  <div className="mt-2.5 flex gap-1.5">
                    {draft.media.map((m, i) => (
                      <div
                        key={i}
                        className="h-12 w-12 overflow-hidden rounded-lg border border-border"
                      >
                        <img src={m.preview} alt="" className="h-full w-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 flex-col gap-2">
                <Button size="sm" onClick={() => handleEdit(draft)}>
                  <Pencil />
                  Keep writing
                </Button>
                <button
                  onClick={() => handleDelete(draft.id)}
                  className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full border border-border bg-transparent px-3.5 py-[7px] text-xs font-semibold text-destructive"
                >
                  <Trash2 className="size-3" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
