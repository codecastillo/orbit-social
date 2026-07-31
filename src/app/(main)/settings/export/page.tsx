"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormSection } from "@/components/orbit/forms";
import { SettingsHeader } from "@/components/settings/settings-header";

const INCLUDED = [
  "Your profile",
  "Your posts, with media links",
  "Who you follow and who follows you",
  "Bookmarks and likes",
  "Muted and blocked accounts",
];

export default function ExportSettingsPage() {
  const [generating, setGenerating] = useState(false);

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/export", { method: "POST" });
      if (res.status === 429) {
        toast.error("You can request one export every 10 minutes.");
        return;
      }
      if (!res.ok) {
        toast.error("Couldn't build your export. Try again in a moment.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `orbit-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch {
      toast.error("Couldn't build your export. Try again in a moment.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-col gap-[18px] text-foreground">
      <SettingsHeader section="Export" glyph="◆" />

      <div>
        <h1 className="mt-1 text-4xl sm:text-[48px] font-bold leading-none tracking-[-0.035em]">
          Yours to <span className="text-primary">keep</span>.
        </h1>
        <p className="mt-2.5 max-w-[560px] text-[14.5px] leading-[1.55] text-muted-foreground">
          A copy of what you&apos;ve put into Orbit, as one JSON file.
        </p>
      </div>

      <FormSection title="Download your data">
        <p className="m-0 text-[13px] leading-[1.55] text-muted-foreground">
          The archive includes:
        </p>
        <ul className="mb-0 mt-2 list-disc pl-5 text-[13px] leading-[1.7] text-muted-foreground">
          {INCLUDED.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mb-0 mt-3 text-[12.5px] leading-[1.5] text-muted-foreground">
          Direct messages are not included: conversations belong to everyone in
          them, not just you. You can request one export every 10 minutes.
        </p>
        <div className="mt-4">
          <Button onClick={handleDownload} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generating archive...
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                Download your data
              </>
            )}
          </Button>
        </div>
      </FormSection>
    </div>
  );
}
