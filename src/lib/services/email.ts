import { Resend } from "resend";
import { renderTemplate, type TemplateName, type TemplateVars } from "./email-templates";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || "Orbit <onboarding@resend.dev>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

let resend: Resend | null = null;
function client() {
  if (!RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(RESEND_API_KEY);
  return resend;
}

type SendArgs<T extends TemplateName> = {
  to: string | string[];
  template: T;
  vars: TemplateVars[T];
  // Optional Resend overrides
  replyTo?: string;
  tags?: { name: string; value: string }[];
};

type SendResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Send a templated transactional email via Resend.
 * Returns { ok: false } when RESEND_API_KEY is unset (dev convenience,
 * logs the would-have-been email instead of throwing).
 */
export async function sendTemplated<T extends TemplateName>(
  args: SendArgs<T>
): Promise<SendResult> {
  const c = client();
  const { subject, html, text } = renderTemplate(args.template, args.vars, { appUrl: APP_URL });

  if (!c) {
    // Dev fallback: log to stdout so you can still see emails were "sent" locally.
    console.warn(
      `[email] RESEND_API_KEY missing, skipping send to ${Array.isArray(args.to) ? args.to.join(",") : args.to}\n` +
        `[email] Subject: ${subject}\n` +
        `[email] Template: ${args.template}`
    );
    return { ok: false, error: "RESEND_API_KEY missing" };
  }

  // Single retry on network errors / 5xx, Resend's own client doesn't retry.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data, error } = await c.emails.send({
        from: RESEND_FROM,
        to: args.to,
        subject,
        html,
        text,
        replyTo: args.replyTo,
        tags: args.tags,
      });
      if (error) {
        if (attempt === 0 && (error as { statusCode?: number }).statusCode && (error as { statusCode?: number }).statusCode! >= 500) {
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }
        return { ok: false, error: error.message || "send failed" };
      }
      return { ok: true, id: data?.id || "" };
    } catch (err) {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 600));
        continue;
      }
      return {
        ok: false,
        error: err instanceof Error ? err.message : "unknown error",
      };
    }
  }
  return { ok: false, error: "exhausted retries" };
}

/** Convenience helpers: typed call sites for each template. */
export const Email = {
  welcome: (to: string, vars: TemplateVars["welcome"]) =>
    sendTemplated({ to, template: "welcome", vars }),
  verifyEmail: (to: string, vars: TemplateVars["verify-email"]) =>
    sendTemplated({ to, template: "verify-email", vars }),
  passwordReset: (to: string, vars: TemplateVars["password-reset"]) =>
    sendTemplated({ to, template: "password-reset", vars }),
  digestDaily: (to: string, vars: TemplateVars["digest-daily"]) =>
    sendTemplated({ to, template: "digest-daily", vars }),
  eventReminder: (to: string, vars: TemplateVars["event-reminder"]) =>
    sendTemplated({ to, template: "event-reminder", vars }),
};
