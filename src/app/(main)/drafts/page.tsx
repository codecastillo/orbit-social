"use client";

import { useEffect } from "react";
import { Trash2, FileText, Pencil, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useDraftsStore, type Draft } from "@/lib/stores/drafts-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { formatTimeAgo } from "@/lib/utils/format";
import { O, panel } from "@/lib/design/orbit";
import { Display, Acc, Eyebrow, PillBtn } from "@/components/orbit/primitives";
import { OrbitEmptyState } from "@/components/orbit/empty-state";

const DRAFT_ACCENT = "#ff9a3d";

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
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ height: 68, borderRadius: 16, background: O.glass }} className="animate-pulse" />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              style={{ height: 100, borderRadius: 18, background: "rgba(255,255,255,0.03)" }}
              className="animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ color: O.ink, fontFamily: O.sans, display: "flex", flexDirection: "column", gap: 18 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 18,
          flexWrap: "wrap",
        }}
      >
        <div>
          <Eyebrow accent>◇&nbsp;&nbsp;COMPOSE · DRAFTS · {drafts.length}</Eyebrow>
          <Display size={48} style={{ marginTop: 8 }}>
            Unfinished <Acc>thoughts</Acc>.
          </Display>
          <p style={{ fontSize: 14.5, color: O.ink3, marginTop: 10, lineHeight: 1.55, maxWidth: 540 }}>
            Picked back up when you&apos;re ready. Nothing posted, nothing lost.
          </p>
        </div>
        <PillBtn primary size="lg" onClick={() => setComposeOpen(true)}>
          <Pencil style={{ width: 14, height: 14 }} />
          New draft
        </PillBtn>
      </div>

      {drafts.length === 0 ? (
        <OrbitEmptyState
          icon={FileText}
          accent={DRAFT_ACCENT}
          headline="Nothing"
          accentWord="half-written"
          sub="Save a post as a draft and it'll show up here. Nothing posted until you say so."
          ctaLabel="Start a post"
          ctaIcon={<Pencil style={{ width: 12, height: 12 }} />}
          onCta={() => setComposeOpen(true)}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {drafts.map((draft) => (
            <div
              key={draft.id}
              style={{
                ...panel({ borderRadius: 18 }),
                padding: 18,
                position: "relative",
                display: "flex",
                gap: 16,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: 3,
                  background: DRAFT_ACCENT,
                  boxShadow: `0 0 14px color-mix(in oklab, ${DRAFT_ACCENT} 50%, transparent)`,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: O.mono,
                    fontSize: 10.5,
                    letterSpacing: "0.12em",
                    color: DRAFT_ACCENT,
                    marginBottom: 10,
                  }}
                >
                  ◆&nbsp;&nbsp;DRAFT · {formatTimeAgo(draft.updatedAt || draft.createdAt).toUpperCase()}
                </div>

                {draft.content ? (
                  <p
                    style={{
                      fontSize: 14.5,
                      color: O.ink,
                      margin: 0,
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.5,
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {draft.content}
                  </p>
                ) : (
                  <p style={{ fontSize: 14, color: O.ink4, margin: 0, fontStyle: "italic" }}>
                    No text yet, media only.
                  </p>
                )}

                {draft.location && (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      marginTop: 10,
                      fontSize: 11,
                      color: O.ink3,
                      fontFamily: O.mono,
                      letterSpacing: "0.04em",
                    }}
                  >
                    <MapPin style={{ width: 11, height: 11 }} />
                    {draft.location}
                  </div>
                )}

                {draft.media.length > 0 && (
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    {draft.media.map((m, i) => (
                      <div
                        key={i}
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 8,
                          overflow: "hidden",
                          border: `1px solid ${O.hair}`,
                        }}
                      >
                        <img
                          src={m.preview}
                          alt=""
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
                <PillBtn primary size="sm" onClick={() => handleEdit(draft)}>
                  <Pencil style={{ width: 12, height: 12 }} />
                  Keep writing
                </PillBtn>
                <button
                  onClick={() => handleDelete(draft.id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "7px 14px",
                    borderRadius: 99,
                    background: "transparent",
                    border: `1px solid ${O.hair2}`,
                    color: "#ff9aa3",
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: O.sans,
                    cursor: "pointer",
                  }}
                >
                  <Trash2 style={{ width: 12, height: 12 }} />
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
