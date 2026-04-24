"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, FileText, Pencil, MapPin } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useDraftsStore, type Draft } from "@/lib/stores/drafts-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { formatTimeAgo } from "@/lib/utils/format";

export default function DraftsPage() {
  const router = useRouter();
  const { drafts, hydrate, hydrated, deleteDraft } = useDraftsStore();
  const setComposeOpen = useUIStore((s) => s.setComposeOpen);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const handleEdit = (draft: Draft) => {
    // Open the composer with draft content pre-filled
    // We store the draft content in sessionStorage for the composer to pick up
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
      <div className="min-h-screen">
        <div className="sticky top-0 z-10 backdrop-blur-2xl bg-background/80 border-b border-white/[0.06]">
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="h-5 w-5 rounded bg-muted animate-pulse" />
            <div className="h-5 w-24 rounded bg-muted animate-pulse" />
          </div>
        </div>
        <div className="p-5 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-2xl bg-background/80 border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-slate-500/20 to-zinc-500/20 flex items-center justify-center">
              <FileText className="h-4.5 w-4.5 text-slate-400" />
            </div>
            <h1 className="text-xl font-extrabold tracking-tight">Drafts</h1>
          </div>
          {drafts.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {drafts.length} draft{drafts.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {drafts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-16 w-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-5">
            <FileText className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <p className="text-base font-semibold text-muted-foreground">
            No drafts yet
          </p>
          <p className="text-sm text-muted-foreground/60 mt-1.5 max-w-xs text-center">
            When you save a post as a draft, it will appear here so you can
            finish and publish it later.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.06]">
          {drafts.map((draft) => (
            <div
              key={draft.id}
              className="p-4 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  {/* Draft content preview */}
                  {draft.content ? (
                    <p className="text-[14px] text-zinc-200 line-clamp-3 whitespace-pre-wrap">
                      {draft.content}
                    </p>
                  ) : (
                    <p className="text-[14px] text-zinc-500 italic">
                      No text content
                    </p>
                  )}

                  {/* Location tag */}
                  {draft.location && (
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground/60">
                      <MapPin className="h-3 w-3" />
                      {draft.location}
                    </div>
                  )}

                  {/* Media previews */}
                  {draft.media.length > 0 && (
                    <div className="flex gap-1.5 mt-2">
                      {draft.media.map((m, i) => (
                        <div
                          key={i}
                          className="h-12 w-12 rounded-md bg-zinc-800 border border-white/[0.06] overflow-hidden"
                        >
                          <img
                            src={m.preview}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Timestamp */}
                  <p className="text-[11px] text-muted-foreground/50 mt-2">
                    Saved {formatTimeAgo(draft.createdAt)}
                    {draft.updatedAt !== draft.createdAt &&
                      ` · Edited ${formatTimeAgo(draft.updatedAt)}`}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleEdit(draft)}
                    className="h-8 w-8 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
                    title="Edit and publish"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(draft.id)}
                    className="h-8 w-8 flex items-center justify-center rounded-full text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Delete draft"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
