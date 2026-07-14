/**
 * Plain-string Orbit email templates.
 *
 * Kept dep-free intentionally (no `react-email`). Each template returns
 * `{ subject, html, text }`. Visual style: dark background + aurora gradient
 * accent on the primary CTA, mono eyebrow, serif italic accent word.
 *
 * Inline styles only, many email clients strip <style> blocks.
 */

export type TemplateName =
  | "welcome"
  | "verify-email"
  | "password-reset"
  | "digest-daily"
  | "event-reminder";

export type TemplateVars = {
  welcome: { name: string };
  "verify-email": { verifyUrl: string };
  "password-reset": { resetUrl: string };
  "digest-daily": {
    name: string;
    counts: { likes: number; comments: number; follows: number; mentions: number; messages: number };
    appUrl?: string; // overrides default
  };
  "event-reminder": {
    eventTitle: string;
    eventStartsAt: string; // pre-formatted human string
    eventUrl: string;
    venueLine?: string; // e.g. "St. George, UTAH", optional
  };
};

type RenderCtx = { appUrl: string };

const COLORS = {
  bg: "#070818",
  bg2: "#0c0d22",
  ink: "#ffffff",
  ink2: "rgba(255,255,255,0.78)",
  ink3: "rgba(255,255,255,0.5)",
  ink4: "rgba(255,255,255,0.3)",
  hair: "rgba(255,255,255,0.09)",
  hair2: "rgba(255,255,255,0.14)",
  glass: "rgba(255,255,255,0.05)",
  a1: "#ff5c38",
  a2: "#ff5c38",
  a3: "#ff5c38",
};

const aurora = COLORS.a1;
const SANS =
  '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", system-ui, sans-serif';
const MONO = '"Geist Mono", ui-monospace, "SF Mono", Menlo, monospace';

function shell(opts: { preheader: string; body: string }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>Orbit</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};color:${COLORS.ink};font-family:${SANS};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.bg};padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
      <tr><td align="center" style="padding-bottom:28px;">
        <span style="font-family:${SANS};font-weight:700;font-size:32px;color:${COLORS.a2};letter-spacing:-0.02em;">orbit</span>
      </td></tr>
      <tr><td style="background:${COLORS.glass};border:1px solid ${COLORS.hair2};border-radius:24px;padding:36px 32px;">
        ${opts.body}
      </td></tr>
      <tr><td align="center" style="padding-top:22px;font-family:${MONO};font-size:11px;color:${COLORS.ink4};letter-spacing:0.12em;">
        ◇&nbsp;&nbsp;EVERYONE'S RADIUS
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function eyebrow(text: string, accent = false) {
  return `<div style="font-family:${MONO};font-size:11px;letter-spacing:0.18em;color:${accent ? COLORS.a3 : COLORS.ink3};text-transform:uppercase;">${escapeHtml(text)}</div>`;
}

function display(html: string, size = 28) {
  return `<h1 style="margin:10px 0 0;font-family:${SANS};font-weight:700;font-size:${size}px;line-height:1.05;letter-spacing:-0.02em;color:${COLORS.ink};">${html}</h1>`;
}

function acc(word: string) {
  return `<em style="font-family:${SANS};font-weight:700;font-weight:400;color:${COLORS.a2};">${escapeHtml(word)}</em>`;
}

function paragraph(html: string) {
  return `<p style="margin:14px 0 0;font-size:15px;line-height:1.55;color:${COLORS.ink2};">${html}</p>`;
}

function hairline() {
  return `<div style="height:1px;background:${COLORS.hair};margin:24px 0;"></div>`;
}

function primaryButton(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;">
    <tr><td style="border-radius:99px;background:${aurora};">
      <a href="${href}" style="display:inline-block;padding:14px 28px;font-family:${SANS};font-size:15px;font-weight:600;color:#0c0a17;text-decoration:none;border-radius:99px;">
        ${escapeHtml(label)}
      </a>
    </td></tr>
  </table>`;
}

function secondaryLink(href: string, label: string) {
  return `<a href="${href}" style="color:${COLORS.a3};text-decoration:none;font-weight:600;">${escapeHtml(label)} →</a>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ─── templates ──────────────────────────────────────────────── */

function welcome(vars: TemplateVars["welcome"]) {
  const subject = `Welcome to Orbit, ${vars.name.split(" ")[0]}.`;
  const body = `
${eyebrow("◇  WELCOME · ORBIT")}
${display(`Glad you're <em style="font-family:${SANS};font-weight:700;font-weight:400;color:${COLORS.a2};">here</em>.`, 32)}
${paragraph(`Hey ${escapeHtml(vars.name.split(" ")[0])}, Orbit is small on purpose. Tighter circles, fewer signals, more of what you actually came for.`)}
${paragraph(`Three things to do first:`)}
<ol style="margin:14px 0 0;padding-left:22px;font-size:14.5px;line-height:1.6;color:${COLORS.ink2};">
  <li>Add a profile photo and a one-liner.</li>
  <li>Follow a few people whose work you actually like.</li>
  <li>Post the thing you've been meaning to say.</li>
</ol>
${primaryButton("{{APP_URL}}/feed", "Open your orbit")}
${hairline()}
<p style="margin:0;font-size:12px;color:${COLORS.ink4};line-height:1.5;">If you didn't sign up for Orbit, you can ignore this email. We won't email you again unless you opt in.</p>
`;
  const text = `Welcome to Orbit, ${vars.name}.

Add a profile photo and one-liner.
Follow a few people whose work you actually like.
Post the thing you've been meaning to say.

Open Orbit: {{APP_URL}}/feed`;
  return { subject, html: shell({ preheader: `Welcome, your orbit is open.`, body }), text };
}

function verifyEmail(vars: TemplateVars["verify-email"]) {
  const subject = "Verify your Orbit email";
  const body = `
${eyebrow("◇  VERIFY · EMAIL", true)}
${display(`One ${acc("tap")}.`, 32)}
${paragraph(`Click the button below to confirm this is your email and finish setting up your Orbit account.`)}
${primaryButton(vars.verifyUrl, "Verify email")}
${paragraph(`Or paste this link into your browser:`)}
<p style="margin:6px 0 0;font-size:12.5px;color:${COLORS.ink3};font-family:${MONO};word-break:break-all;">${escapeHtml(vars.verifyUrl)}</p>
${hairline()}
<p style="margin:0;font-size:12px;color:${COLORS.ink4};line-height:1.5;">This link expires in 24 hours. If you didn't request this, ignore the email.</p>
`;
  const text = `Verify your Orbit email.\n\nLink: ${vars.verifyUrl}\n\nExpires in 24 hours.`;
  return { subject, html: shell({ preheader: `Verify your email to finish signing up.`, body }), text };
}

function passwordReset(vars: TemplateVars["password-reset"]) {
  const subject = "Reset your Orbit password";
  const body = `
${eyebrow("◆  RESET · PASSWORD", true)}
${display(`Pick a new ${acc("password")}.`, 32)}
${paragraph(`Click below to set a new password. The link expires in 1 hour.`)}
${primaryButton(vars.resetUrl, "Reset password")}
<p style="margin:6px 0 0;font-size:12.5px;color:${COLORS.ink3};font-family:${MONO};word-break:break-all;">${escapeHtml(vars.resetUrl)}</p>
${hairline()}
<p style="margin:0;font-size:12px;color:${COLORS.ink4};line-height:1.5;">If you didn't request this, ignore it. Your password stays the same.</p>
`;
  const text = `Reset your Orbit password.\n\nLink: ${vars.resetUrl}\n\nExpires in 1 hour.`;
  return { subject, html: shell({ preheader: `Reset your password.`, body }), text };
}

function digestDaily(vars: TemplateVars["digest-daily"], ctx: RenderCtx) {
  const url = vars.appUrl || ctx.appUrl;
  const subject = `Your Orbit yesterday`;
  const total =
    vars.counts.likes +
    vars.counts.comments +
    vars.counts.follows +
    vars.counts.mentions +
    vars.counts.messages;
  const body = `
${eyebrow("◈  ORBIT · DAILY")}
${display(`What you ${acc("missed")}.`, 32)}
${paragraph(`Hey ${escapeHtml(vars.name.split(" ")[0])}, ${total} signals from your orbit since yesterday.`)}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:18px;border-top:1px solid ${COLORS.hair};">
  ${[
    ["Likes", vars.counts.likes],
    ["Replies", vars.counts.comments],
    ["New followers", vars.counts.follows],
    ["Mentions", vars.counts.mentions],
    ["Direct messages", vars.counts.messages],
  ]
    .map(
      ([label, n]) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid ${COLORS.hair};font-size:14px;color:${COLORS.ink2};">${label}</td>
      <td align="right" style="padding:12px 0;border-bottom:1px solid ${COLORS.hair};font-family:${SANS};font-weight:700;font-size:24px;color:${COLORS.a2};">${n}</td>
    </tr>`
    )
    .join("")}
</table>
${primaryButton(`${url}/notifications`, "Open notifications")}
${hairline()}
<p style="margin:0;font-size:12px;color:${COLORS.ink4};line-height:1.5;">Don't want these? <a href="${url}/settings/notifications" style="color:${COLORS.ink3};text-decoration:underline;">Mute the daily digest</a>.</p>
`;
  const text = `Orbit daily: ${total} signals since yesterday.

Likes: ${vars.counts.likes}
Replies: ${vars.counts.comments}
Followers: ${vars.counts.follows}
Mentions: ${vars.counts.mentions}
Messages: ${vars.counts.messages}

Open: ${url}/notifications`;
  return { subject, html: shell({ preheader: `${total} signals, open Orbit to catch up.`, body }), text };
}

function eventReminder(vars: TemplateVars["event-reminder"]) {
  const subject = `Starting soon: ${vars.eventTitle}`;
  const body = `
${eyebrow("◆  EVENT · STARTING SOON", true)}
${display(`See you ${acc("there")}.`, 28)}
${paragraph(`<strong style="color:${COLORS.ink};">${escapeHtml(vars.eventTitle)}</strong> kicks off ${escapeHtml(vars.eventStartsAt)}${vars.venueLine ? ` · ${escapeHtml(vars.venueLine)}` : ""}.`)}
${primaryButton(vars.eventUrl, "Open event")}
`;
  const text = `Starting soon: ${vars.eventTitle}\n${vars.eventStartsAt}${vars.venueLine ? " · " + vars.venueLine : ""}\n\nOpen: ${vars.eventUrl}`;
  return { subject, html: shell({ preheader: `${vars.eventTitle} starts ${vars.eventStartsAt}.`, body }), text };
}

/* ─── dispatcher ─────────────────────────────────────────────── */

export function renderTemplate<T extends TemplateName>(
  name: T,
  vars: TemplateVars[T],
  ctx: RenderCtx
): { subject: string; html: string; text: string } {
  let result: { subject: string; html: string; text: string };
  switch (name) {
    case "welcome":
      result = welcome(vars as TemplateVars["welcome"]);
      break;
    case "verify-email":
      result = verifyEmail(vars as TemplateVars["verify-email"]);
      break;
    case "password-reset":
      result = passwordReset(vars as TemplateVars["password-reset"]);
      break;
    case "digest-daily":
      result = digestDaily(vars as TemplateVars["digest-daily"], ctx);
      break;
    case "event-reminder":
      result = eventReminder(vars as TemplateVars["event-reminder"]);
      break;
    default: {
      // Exhaustive check: TS will error if a new template is added but not handled.
      const _exhaustive: never = name;
      throw new Error(`Unknown template: ${_exhaustive as string}`);
    }
  }
  // Inject APP_URL into welcome template (only one with a placeholder)
  result.html = result.html.replaceAll("{{APP_URL}}", ctx.appUrl);
  result.text = result.text.replaceAll("{{APP_URL}}", ctx.appUrl);
  return result;
}
