"use client";

import { useState, useEffect } from "react";
import { Filter, Plus, X, Search } from "lucide-react";
import { toast } from "sonner";
import { useFilterStore } from "@/lib/stores/filter-store";
import { O, panel } from "@/lib/design/orbit";
import { Display, Acc, PillBtn } from "@/components/orbit/primitives";
import { FormSection, Input } from "@/components/orbit/forms";
import { SettingsHeader } from "@/components/settings/settings-header";

export default function FiltersPage() {
  const {
    blockedWords,
    addBlockedWord,
    removeBlockedWord,
    loadFromStorage,
  } = useFilterStore();
  const [newWord, setNewWord] = useState("");

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  const handleAdd = () => {
    const trimmed = newWord.trim().toLowerCase();
    if (!trimmed) return;
    if (blockedWords.includes(trimmed)) {
      toast.error("Already filtered");
      return;
    }
    addBlockedWord(trimmed);
    setNewWord("");
    toast.success(`Muted "${trimmed}"`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleRemove = (word: string) => {
    removeBlockedWord(word);
    toast.success(`Unmuted "${word}"`);
  };

  return (
    <div style={{ color: O.ink, fontFamily: O.sans, display: "flex", flexDirection: "column", gap: 18 }}>
      <SettingsHeader section="Filters" glyph="◆" />

      <div>
        <Display size={48} style={{ marginTop: 4 }}>
          Mute <Acc>noise</Acc>.
        </Display>
        <p style={{ fontSize: 14.5, color: O.ink3, marginTop: 10, lineHeight: 1.55, maxWidth: 560 }}>
          Words you don&apos;t want to read. Hidden from feeds on this device.
        </p>
      </div>

      <FormSection title="Muted words" hint={`${blockedWords.length} on this device`}>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Input
              type="text"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a word to mute…"
              prefix={<Search style={{ width: 14, height: 14 }} />}
            />
          </div>
          <PillBtn primary onClick={handleAdd} disabled={!newWord.trim()} size="md">
            <Plus style={{ width: 14, height: 14 }} />
            Add
          </PillBtn>
        </div>

        {blockedWords.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "32px 0 16px",
              color: O.ink3,
              fontSize: 13,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                margin: "0 auto 14px",
                borderRadius: 14,
                background: O.glass,
                border: `1px solid ${O.hair}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Filter style={{ width: 20, height: 20, color: O.ink4 }} />
            </div>
            <p style={{ margin: 0, fontWeight: 600, color: O.ink2 }}>Nothing muted yet.</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: O.ink4 }}>
              Add a word above to filter it from your feed.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginTop: 18,
            }}
          >
            {blockedWords.map((word) => (
              <div
                key={word}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  borderRadius: 99,
                  background: O.glass,
                  border: `1px solid ${O.hair2}`,
                  fontSize: 12,
                  fontFamily: O.mono,
                  letterSpacing: "0.02em",
                  color: O.ink2,
                }}
              >
                {word}
                <button
                  onClick={() => handleRemove(word)}
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    border: "none",
                    background: "transparent",
                    color: O.ink3,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X style={{ width: 10, height: 10 }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </FormSection>

      <div
        style={{
          ...panel({ borderRadius: 18 }),
          padding: 18,
          marginTop: 8,
          fontSize: 12.5,
          color: O.ink3,
          lineHeight: 1.55,
        }}
      >
        <strong style={{ color: O.ink2, fontWeight: 600 }}>How this works:</strong>{" "}
        Posts containing your muted words are hidden from every feed (Home, Discover,
        Hashtag, Location). This list is stored on your device and doesn't sync across
        other browsers.
      </div>
    </div>
  );
}
