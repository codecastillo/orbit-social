"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Radio, Copy, Eye, EyeOff, ExternalLink, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { O, panel } from "@/lib/design/orbit";
import { Display, Acc, Eyebrow } from "@/components/orbit/primitives";

interface Credentials {
  streamId: string;
  rtmpsUrl: string;
  srtUrl: string;
  streamKey: string;
  playbackId: string;
  status: "idle" | "live" | "ended";
}

export default function StreamingSettingsPage() {
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/live/me", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.detail ?? json.error ?? `http_${res.status}`);
        if (!cancelled) setCreds(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      style={{
        color: O.ink,
        fontFamily: O.sans,
        display: "flex",
        flexDirection: "column",
        gap: 22,
      }}
    >
      <div>
        <Link
          href="/settings"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 12,
            color: O.ink3,
            textDecoration: "none",
            marginBottom: 8,
          }}
        >
          <ChevronLeft style={{ width: 14, height: 14 }} />
          Settings
        </Link>
        <Eyebrow accent>◇&nbsp;&nbsp;STREAMING</Eyebrow>
        <Display size={44} style={{ marginTop: 8 }}>
          Your <Acc>broadcast</Acc> credentials.
        </Display>
        <p
          style={{
            fontSize: 14.5,
            color: O.ink3,
            marginTop: 10,
            lineHeight: 1.55,
            maxWidth: 560,
          }}
        >
          Plug these into OBS, Streamlabs, or your IRL backpack once. Whenever
          you go live, your stream automatically appears in the Live feed.
          You don&apos;t need to do anything on this site &mdash; just hit
          <em> Start Streaming</em> in your software.
        </p>
      </div>

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      )}

      {error && (
        <div
          style={{
            ...panel(),
            padding: 18,
            color: "#ff8a8a",
            fontSize: 13,
          }}
        >
          Failed to load credentials: {error}
        </div>
      )}

      {creds && (
        <>
          {creds.status === "live" && (
            <div
              style={{
                ...panel(),
                padding: 14,
                display: "flex",
                alignItems: "center",
                gap: 10,
                borderColor: "rgba(255,90,106,0.4)",
                background: "rgba(255,90,106,0.08)",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#ff5a6a",
                  boxShadow: "0 0 12px #ff5a6a",
                }}
              />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#ff5a6a",
                  letterSpacing: "0.04em",
                }}
              >
                You are live right now.
              </span>
              <Link
                href={`/live/${creds.streamId}`}
                style={{
                  marginLeft: "auto",
                  fontSize: 12,
                  color: O.ink2,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  textDecoration: "none",
                }}
              >
                Open viewer <ExternalLink style={{ width: 12, height: 12 }} />
              </Link>
            </div>
          )}

          <div style={{ ...panel(), padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
            <CredField label="OBS — Server URL (RTMPS)" value={creds.rtmpsUrl} />
            <CredField label="OBS — Stream Key" value={creds.streamKey} secret />
            <CredField label="Belabox / SRT (single URL, key embedded)" value={creds.srtUrl} secret />
          </div>

          <SetupGuide />
        </>
      )}
    </div>
  );
}

function CredField({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  const [revealed, setRevealed] = useState(!secret);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied");
    } catch {
      toast.error("Copy failed");
    }
  };
  const display = revealed ? value : "•".repeat(Math.min(value.length, 40));
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: O.ink3,
          fontFamily: O.mono,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          borderRadius: 10,
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${O.hair2}`,
          fontFamily: O.mono,
          fontSize: 12.5,
        }}
      >
        <code
          style={{
            flex: 1,
            color: O.ink,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {display}
        </code>
        {secret && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            style={{
              color: O.ink3,
              padding: 4,
              borderRadius: 6,
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
            aria-label={revealed ? "Hide" : "Reveal"}
          >
            {revealed ? <EyeOff style={{ width: 14, height: 14 }} /> : <Eye style={{ width: 14, height: 14 }} />}
          </button>
        )}
        <button
          type="button"
          onClick={handleCopy}
          style={{
            color: O.ink2,
            padding: 4,
            borderRadius: 6,
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
          aria-label="Copy"
        >
          <Copy style={{ width: 14, height: 14 }} />
        </button>
      </div>
    </div>
  );
}

function SetupGuide() {
  return (
    <div style={{ ...panel(), padding: 22 }}>
      <Eyebrow>◆&nbsp;&nbsp;SETUP GUIDE</Eyebrow>

      <Section title="OBS Studio (desktop)">
        <Step n={1}>
          Open OBS &rarr; <strong>Settings</strong> &rarr; <strong>Stream</strong>.
        </Step>
        <Step n={2}>
          Service: <code style={code}>Custom...</code>
        </Step>
        <Step n={3}>Server: paste the RTMPS URL above.</Step>
        <Step n={4}>Stream Key: paste your Stream Key above.</Step>
        <Step n={5}>
          Click <strong>OK</strong>, then <strong>Start Streaming</strong> in
          the main window. You go live automatically.
        </Step>
      </Section>

      <Section title="Belabox / IRL Toolkit (cellular)">
        <Step n={1}>
          In your Belabox Cloud / IRLToolkit dashboard, set the destination URL
          to the SRT URL above (it includes your stream key).
        </Step>
        <Step n={2}>Start the encoder. Mux ingest accepts SRT-bonded streams.</Step>
      </Section>

      <Section title="Mobile (iOS/Android)">
        <Step n={1}>
          Install <strong>Larix Broadcaster</strong> (free, RTMPS support).
        </Step>
        <Step n={2}>Add a new connection &rarr; URL: paste the RTMPS URL.</Step>
        <Step n={3}>Stream key: paste your Stream Key. Save.</Step>
        <Step n={4}>Tap the broadcast button. Live within ~5s.</Step>
      </Section>

      <p
        style={{
          fontSize: 12,
          color: O.ink3,
          marginTop: 12,
          fontStyle: "italic",
          lineHeight: 1.5,
        }}
      >
        Your stream key never expires. Don&apos;t share it &mdash; anyone with
        it can broadcast as you. If it leaks, contact support to rotate.
      </p>
    </div>
  );
}

const code: React.CSSProperties = {
  fontFamily: O.mono,
  fontSize: 11,
  padding: "1px 6px",
  borderRadius: 4,
  background: "rgba(255,255,255,0.06)",
  border: `1px solid ${O.hair2}`,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: O.ink,
          marginBottom: 8,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Radio style={{ width: 14, height: 14, color: "#ff5a6a" }} />
        {title}
      </div>
      <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
        {children}
      </ol>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        fontSize: 13,
        color: O.ink2,
        lineHeight: 1.5,
      }}
    >
      <span
        style={{
          flexShrink: 0,
          width: 20,
          height: 20,
          borderRadius: 6,
          background: "rgba(255,255,255,0.06)",
          border: `1px solid ${O.hair2}`,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontFamily: O.mono,
          color: O.ink3,
        }}
      >
        {n}
      </span>
      <span style={{ paddingTop: 1 }}>{children}</span>
    </li>
  );
}
