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
      <div className="border-x border-border min-h-screen">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <div className="h-5 w-5 rounded bg-muted animate-pulse" />
          <div className="h-5 w-24 rounded bg-muted animate-pulse" />
        </div>
        <div className="p-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-muted/30 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="border-x border-border min-h-screen">
      <div className="p-4 border-b border-border flex items-center gap-3">
        <Link
          href="/feed"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h2 className="text-lg font-semibold">Drafts</h2>
        {drafts.length > 0 && (
          <span className="text-sm text-muted-foreground ml-auto">
            {drafts.length} draft{drafts.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {drafts.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center px-5">
          <div className="h-14 w-14 rounded-full bg-muted/30 flex items-center justify-center mb-4">
            <FileText className="h-6 w-6 text-muted-foreground/50" />
          </div>
          <h3 className="text-base font-semibold text-zinc-300 mb-1">
            No drafts yet
          </h3>
          <p className="text-sm text-muted-foreground max-w-xs">
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
