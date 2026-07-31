"use client";

import { useEffect, useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Flag,
  Loader2,
  MessageSquareWarning,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  getViolationHistory,
  getContentFlags,
  getFiledReports,
  getAppeals,
  submitAppeal,
  type Violation,
  type ContentFlag,
  type FiledReport,
  type Appeal,
} from "@/lib/queries/moderation";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/orbit/forms";
import { SettingsHeader } from "@/components/settings/settings-header";
import { formatDate } from "@/lib/utils/format";

const APPEAL_MAX_LENGTH = 2000;

const APPEAL_STATUS_STYLES: Record<Appeal["status"], string> = {
  pending: "border-warning/30 bg-warning/10 text-warning",
  upheld: "border-border bg-surface-elevated text-muted-foreground",
  reversed: "border-success/30 bg-success/10 text-success",
};

const REPORT_STATUS_STYLES: Record<FiledReport["status"], string> = {
  pending: "border-warning/30 bg-warning/10 text-warning",
  reviewed: "border-primary/30 bg-primary/10 text-primary",
  actioned: "border-success/30 bg-success/10 text-success",
  dismissed: "border-border bg-surface-elevated text-muted-foreground",
};

function StatusPill({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] ${className}`}
    >
      {label}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </p>
  );
}

function AppealBlock({
  violation,
  appeal,
  onSubmitted,
}: {
  violation: Violation;
  appeal: Appeal | undefined;
  onSubmitted: (appeal: Appeal) => void;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (appeal) {
    return (
      <div className="mt-3 flex items-center gap-2.5">
        <Button variant="outline" size="sm" disabled>
          Appeal submitted
        </Button>
        <StatusPill
          label={appeal.status}
          className={APPEAL_STATUS_STYLES[appeal.status]}
        />
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!user || !message.trim()) return;
    setSubmitting(true);
    try {
      const created = await submitAppeal(violation.id, user.id, message.trim());
      onSubmitted(created);
      toast.success("Appeal submitted");
    } catch {
      toast.error("Couldn't submit appeal");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <div className="mt-3">
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          Appeal
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-2.5">
      <TextArea
        rows={3}
        maxLength={APPEAL_MAX_LENGTH}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Tell us why this action was a mistake."
        counter={`${message.length}/${APPEAL_MAX_LENGTH}`}
      />
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!message.trim() || submitting}
        >
          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Submit appeal
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
          disabled={submitting}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

export default function AccountStatusPage() {
  const { user } = useAuth();
  const [violations, setViolations] = useState<Violation[]>([]);
  const [flags, setFlags] = useState<ContentFlag[]>([]);
  const [filed, setFiled] = useState<FiledReport[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getViolationHistory(user.id),
      getContentFlags(user.id),
      getFiledReports(user.id),
      getAppeals(user.id),
    ])
      .then(([v, f, r, a]) => {
        setViolations(v);
        setFlags(f);
        setFiled(r);
        setAppeals(a);
      })
      .catch(() => toast.error("Couldn't load account status"))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const allClear = violations.length === 0;

  return (
    <div className="flex flex-col gap-[22px] text-foreground">
      <SettingsHeader section="Account status" glyph="◈" />

      <div>
        <h1 className="mt-1 text-4xl sm:text-5xl font-bold leading-none tracking-[-0.035em] text-foreground">
          Where you <span className="text-primary">stand</span>.
        </h1>
        <p className="mt-2.5 max-w-[560px] text-[14.5px] leading-[1.55] text-muted-foreground">
          Every action taken on your account, listed here. Nothing happens
          silently.
        </p>
      </div>

      <div>
        <SectionLabel>Current standing</SectionLabel>
        {allClear ? (
          <div className="flex items-center gap-3.5 rounded-xl border border-success/25 bg-success/10 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-success/25 bg-success/10">
              <ShieldCheck className="h-4 w-4 text-success" />
            </div>
            <div>
              <div className="text-sm font-semibold">In good standing</div>
              <div className="mt-0.5 text-[12.5px] text-muted-foreground">
                No actions have been taken on your account.
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3.5 rounded-xl border border-warning/25 bg-warning/10 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-warning/25 bg-warning/10">
              <ShieldAlert className="h-4 w-4 text-warning" />
            </div>
            <div>
              <div className="text-sm font-semibold">
                {violations.length === 1
                  ? "1 action on your account"
                  : `${violations.length} actions on your account`}
              </div>
              <div className="mt-0.5 text-[12.5px] text-muted-foreground">
                Details are listed below. You can appeal any of them.
              </div>
            </div>
          </div>
        )}
      </div>

      <div>
        <SectionLabel>Violation history</SectionLabel>
        {violations.length === 0 && flags.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface px-5 py-10 text-center text-muted-foreground">
            <div className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface">
              <ShieldCheck className="h-5 w-5 text-text-faint" />
            </div>
            <p className="m-0 font-semibold text-text-secondary">
              Nothing on record
            </p>
            <p className="mt-1 text-[12.5px] text-text-faint">
              Violations and flagged content would appear here.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface p-2">
            {violations.map((violation, i) => (
              <div
                key={violation.id}
                className={`p-3.5 ${i ? "border-t border-border" : ""}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <ShieldAlert className="h-3.5 w-3.5 text-warning" />
                  <span className="text-[13.5px] font-semibold">
                    {violation.reason}
                  </span>
                </div>
                {violation.action_taken && (
                  <p className="mt-1.5 text-[12.5px] text-muted-foreground">
                    Action taken: {violation.action_taken}
                  </p>
                )}
                <p className="mt-1 font-mono text-[11px] tracking-[0.04em] text-text-faint">
                  {formatDate(violation.reviewed_at ?? violation.created_at)}
                </p>
                <AppealBlock
                  violation={violation}
                  appeal={appeals.find((a) => a.report_id === violation.id)}
                  onSubmitted={(appeal) =>
                    setAppeals((prev) => [...prev, appeal])
                  }
                />
              </div>
            ))}
            {flags.map((flag, i) => (
              <div
                key={flag.id}
                className={`p-3.5 ${
                  i || violations.length ? "border-t border-border" : ""
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <MessageSquareWarning className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[13.5px] font-semibold">
                    Content flagged
                  </span>
                  <StatusPill
                    label={flag.severity}
                    className="border-border bg-surface-elevated text-muted-foreground"
                  />
                </div>
                <p className="mt-1.5 text-[12.5px] text-muted-foreground">
                  {flag.reason}
                  {flag.auto_flagged ? " (automatic filter)" : ""}
                </p>
                <p className="mt-1 font-mono text-[11px] tracking-[0.04em] text-text-faint">
                  {formatDate(flag.created_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <SectionLabel>Your reports</SectionLabel>
        {filed.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface px-5 py-10 text-center text-muted-foreground">
            <div className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface">
              <Flag className="h-5 w-5 text-text-faint" />
            </div>
            <p className="m-0 font-semibold text-text-secondary">
              No reports filed
            </p>
            <p className="mt-1 text-[12.5px] text-text-faint">
              Reports you file and their outcomes will appear here.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface p-2">
            {filed.map((report, i) => (
              <div
                key={report.id}
                className={`flex items-start justify-between gap-3 p-3.5 ${
                  i ? "border-t border-border" : ""
                }`}
              >
                <div className="min-w-0">
                  <span className="text-[13.5px] font-semibold">
                    {report.reason}
                  </span>
                  <p className="mt-1 font-mono text-[11px] tracking-[0.04em] text-text-faint">
                    {report.entity_type} · {formatDate(report.created_at)}
                  </p>
                </div>
                <StatusPill
                  label={report.status}
                  className={REPORT_STATUS_STYLES[report.status]}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
