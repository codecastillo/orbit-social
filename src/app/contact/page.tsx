// Public, logged-out-accessible page. Static server component: no "use
// client", no data fetching, so it prerenders at build time.
//
// Every route on this page is one a person actually monitors. Nothing here
// promises a response time, because none is committed to anywhere else.
import type { Metadata } from "next";
import Link from "next/link";
import { LegalSection, LegalShell } from "@/components/legal/legal-page";
import {
  COMPANY_ADDRESS,
  COMPANY_LEGAL_NAME,
  CONTACT_EMAIL,
  DMCA_EMAIL,
  PRIVACY_EMAIL,
} from "@/lib/legal";

const title = "Contact and support";
const description =
  "How to reach Orbit: the support mailbox, privacy requests, copyright notices, reporting content in the app, appealing a moderation decision, and what to include in a bug report.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/contact" },
  openGraph: { title, description },
  twitter: { title, description },
};

const sections: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: "email",
    title: "Where to write",
    body: (
      <>
        <p>
          Orbit has no phone line and no live chat. Three mailboxes cover
          everything, and a person reads each of them.
        </p>
        <h3>{CONTACT_EMAIL}</h3>
        <p>
          General support. Bugs, sign-in and account problems, reporting
          something that has no in-app report button, rotating a leaked stream
          key, and moderation questions that Settings, Account Status does not
          already answer.
        </p>
        <h3>{PRIVACY_EMAIL}</h3>
        <p>
          Privacy questions and requests about your personal data. What is
          collected and why is set out in the{" "}
          <Link href="/privacy">Privacy Policy</Link>. If you only want a copy
          of your data, you do not need to write: Settings, Download Your Data
          gives you the file immediately.
        </p>
        <h3>{DMCA_EMAIL}</h3>
        <p>
          Copyright notices and counter-notices. This is the designated agent
          address for {COMPANY_LEGAL_NAME}, at {COMPANY_ADDRESS}. A notice needs
          to identify the work, point at the exact content on Orbit, and include
          your contact details and the statements the{" "}
          <Link href="/terms">Terms of Service</Link> set out. Notices sent to
          the other two mailboxes get forwarded here, which only slows them
          down.
        </p>
        <h3>What we do not promise</h3>
        <p>
          We read everything that arrives, and we do not publish a response
          time. Posting a number we could not keep to would be worse than saying
          nothing. Appeals and people locked out of their accounts are handled
          first.
        </p>
      </>
    ),
  },
  {
    id: "reporting",
    title: "Reporting content in the app",
    body: (
      <>
        <p>
          Reporting inside Orbit is faster than email, because the report lands
          attached to the exact content.
        </p>
        <ul>
          <li>
            <strong>A post.</strong> Open the menu on it and choose Report. On
            the web, comments carry the same menu.
          </li>
          <li>
            <strong>An account.</strong> Open the menu on the profile and choose
            Report.
          </li>
          <li>
            <strong>A direct message.</strong> Press and hold the message in the
            Orbit app and choose Report.
          </li>
        </ul>
        <p>
          Pick one of six reasons (spam, harassment, hate speech, violence,
          nudity, or other) and add details if they help. You can see every
          report you have filed, and its status, in Settings, Account Status.
        </p>
        <p>
          Live streams, moments, rooms, events, and Marketplace listings do not
          have a report button yet. Email {CONTACT_EMAIL} with a link and a
          short description of the problem; it reaches the same review queue.
        </p>
        <p>
          If someone is in immediate danger, contact your local emergency
          services first. Orbit cannot dispatch help.
        </p>
      </>
    ),
  },
  {
    id: "appeals",
    title: "Appealing a moderation decision",
    body: (
      <>
        <p>
          Every enforcement action on your account is listed in Settings,
          Account Status, with the reason and the date. Nothing is enforced
          silently; that is one of the{" "}
          <Link href="/promises">ten promises</Link>.
        </p>
        <p>
          Each action can be appealed once, from that page, in up to 2,000
          characters. A person reads it. The outcome, upheld or reversed, shows
          up next to the action on the same page, and Orbit does not send a
          notification when it changes, so check back rather than waiting.
        </p>
        <p>
          Appeals belong on that page, not in email, because the appeal has to
          be attached to the action being appealed. Write to {CONTACT_EMAIL}{" "}
          only if you cannot reach the page, if an automated content flag is
          wrong (those are not appealable on their own), or if the appeal is
          already resolved and you think the outcome is a mistake.
        </p>
      </>
    ),
  },
  {
    id: "bugs",
    title: "Reporting a bug",
    body: (
      <>
        <p>
          Send bugs to {CONTACT_EMAIL}. A report we can act on has four things:
          what you did, what you expected, what happened instead, and which
          build you were on.
        </p>
        <p>
          In the Orbit app, Settings, Help &amp; About, About shows the app
          version and build and has a Copy diagnostics button. It puts the
          version, the operating system, the device model, and the Expo SDK
          version on your clipboard. Paste that into the email. Report a bug in
          the same section opens a message with all of it already filled in.
        </p>
        <p>
          On the web, include the page URL, your browser and version, and
          whether it repeats in a private window. A screenshot of the browser
          console helps for anything that looks like it failed silently.
        </p>
        <p>
          Please do not include your password, an authenticator code, a backup
          code, or your stream key in a bug report. Support never needs them,
          and never asks for them.
        </p>
      </>
    ),
  },
  {
    id: "self-serve",
    title: "Faster than email",
    body: (
      <>
        <p>Some things do not need us at all:</p>
        <ul>
          <li>
            <strong>How something works.</strong> The{" "}
            <Link href="/help">help center</Link> covers the feeds, moments,
            clips, rooms, live, messages, privacy and safety controls,
            notifications, and two-factor.
          </li>
          <li>
            <strong>A copy of your data.</strong> Settings, Download Your Data.
            Immediate, no request needed.
          </li>
          <li>
            <strong>Your account standing.</strong> Settings, Account Status.
          </li>
          <li>
            <strong>Locked out.</strong> Forgot password on the sign-in screen.
            If two-factor is in the way, use a backup code, then set two-factor
            up again.
          </li>
          <li>
            <strong>Closing your account.</strong> Settings, Account. It is
            immediate and permanent, and support cannot undo it afterwards.
          </li>
        </ul>
      </>
    ),
  },
];

export default function ContactPage() {
  return (
    <LegalShell
      eyebrow="Orbit · Support"
      titleLead="Talk to a"
      titleAccent="human"
      intro="The real routes into Orbit support, what each one is for, and what to send so the first reply can actually help."
      sections={sections.map(({ id, title: sectionTitle }) => ({
        id,
        title: sectionTitle,
      }))}
    >
      {sections.map((section, i) => (
        <LegalSection
          key={section.id}
          id={section.id}
          index={i + 1}
          title={section.title}
        >
          {section.body}
        </LegalSection>
      ))}
    </LegalShell>
  );
}
