// Public, logged-out-accessible page. Static server component: no "use
// client", no data fetching, so it prerenders at build time.
//
// The company name, address, jurisdiction, and contact mailboxes come from
// src/lib/legal.ts and must be set before launch. Everything else in this
// document describes what the code actually does; if a data flow changes,
// this page changes with it.
import type { Metadata } from "next";
import Link from "next/link";
import { LegalSection, LegalShell } from "@/components/legal/legal-page";
import {
  COMPANY_ADDRESS,
  COMPANY_JURISDICTION,
  COMPANY_LEGAL_NAME,
  EFFECTIVE_DATE,
  LAST_UPDATED,
  PRIVACY_EMAIL,
} from "@/lib/legal";

const title = "Privacy Policy";
const description =
  "Exactly what Orbit collects, which companies process it, how long it is kept, and how to export or delete it. No ad networks, no data sales, no AI training on your content.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/privacy" },
  openGraph: { title, description },
  twitter: { title, description },
};

const sections: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: "scope",
    title: "What this covers",
    body: (
      <>
        <p>
          This policy describes how {COMPANY_LEGAL_NAME} handles personal data
          in the Orbit website and the Orbit mobile app. It is written against
          the actual system, not against a template: every category below
          corresponds to something Orbit stores or sends, and every company
          named in it is one we genuinely use.
        </p>
        <p>
          The short version. Orbit runs no advertising, has no ad-tech or
          analytics SDK in either app, sells nothing about you, and does not
          use your content to train AI models. What we hold is what the
          product needs to work, plus a small amount of security data so you
          can see who has signed into your account.
        </p>
        <p>
          The <Link href="/terms">Terms of Service</Link> govern your use of
          Orbit. The <Link href="/promises">ten promises</Link> describe the
          product commitments behind several of the choices explained here.
        </p>
      </>
    ),
  },
  {
    id: "collect",
    title: "What we collect",
    body: (
      <>
        <h3>Account and profile</h3>
        <p>
          Your email address and password are held by our authentication
          provider; we never see your password in readable form. Your profile
          holds what you put in it: username, display name, bio, avatar, cover
          image, website, a free-text location if you type one, interests, and
          your privacy and content settings.
        </p>
        <p>
          Signup asks for your date of birth so we can check you are at least
          13. That check runs in your browser and the date is not sent to us
          or stored.
        </p>
        <h3>What you post</h3>
        <p>
          Posts, comments, replies, moments, clips, live streams and their
          replays, marketplace listings, events, communities, sounds, drafts,
          and scheduled posts. Images and video you upload are stored in our
          file storage; video for clips, live, and replays is additionally
          processed and delivered by our video provider, and we store the
          identifiers it returns.
        </p>
        <p>
          If you add a location to a post or a listing, it is text you typed.
          Orbit does not request or read your device&apos;s GPS location, on
          the web or in the app.
        </p>
        <h3>Messages</h3>
        <p>
          Direct messages, group conversations, attachments, and reactions.
          Message attachments live in a private storage area readable only by
          the people in the conversation. Messages are not end-to-end
          encrypted; see the security section below for what that means.
        </p>
        <h3>Activity</h3>
        <p>
          Likes, bookmarks, follows and follow requests, poll votes, mentions,
          reposts, saved searches, and the topic preferences you set with
          &ldquo;see more&rdquo; and &ldquo;not interested&rdquo;. Also your
          safety lists: blocks, mutes, restricted accounts, muted words, and
          close friends.
        </p>
        <p>
          Three kinds of view data exist, and they differ. Posts, listings,
          and replays carry an aggregate view counter with no record of who
          viewed, and that counter is what everyone sees on the post.
        </p>
        <p>
          Separately, when a post is shown to you we keep one row for that
          post per day, so the feed can tell what it has already put in front
          of you and how you responded to it. The row records which surface
          the post appeared on, one of For You, Following, Clips, a profile,
          a hashtag, search, or the post&apos;s own page. It also records the
          first and last time the post was shown to you that day, how many
          times it was shown, how long it was on screen, how much of its
          video you watched, how long that video is, and how many times you
          watched it to at least ninety percent. Alongside it we record
          actions you take from a post: opening the author&apos;s profile,
          clicking a link out, sharing to a direct message, sharing outside
          Orbit, expanding the post, and replaying its video, each with the
          surface and the time. Sharing a post into a message also records
          which post that message shared.
        </p>
        <p>
          Those rows are readable only by you. The database grants each
          person access to their own and to nobody else&apos;s, and the view
          rows are written by one capped server function rather than by the
          app directly. Authors are never shown who viewed their posts. What
          an author will be able to see about their own posts is counts: how
          many people, not which people.
        </p>
        <p>
          Moments are the deliberate exception. They record each viewer by
          name, because the person who posted is shown who watched.
        </p>
        <h3>Security and device data</h3>
        <p>
          Each sign-in attempt records the IP address, a device or browser
          descriptor, whether it succeeded, and the time, so you can review it
          under security settings and spot a session you do not recognize. On
          the web the IP is taken from the request, and the browser also asks
          a public IP-lookup service for the address it is connecting from. In
          the app the descriptor is your operating system, its version, and
          your device model.
        </p>
        <p>
          If you turn on two-factor authentication, we store your recovery
          codes hashed, never in readable form.
        </p>
        <h3>Notifications</h3>
        <p>
          Your per-type notification settings, quiet hours and time zone
          offset, and the email digest setting. If you turn on push, we store
          the push token or endpoint your browser or device issues, along with
          the platform, so the notification can be routed to you.
        </p>
        <h3>Moderation</h3>
        <p>
          Reports you file and reports filed about you, automatic flags raised
          on your content, and any appeal you submit. These are visible to you
          under account status.
        </p>
      </>
    ),
  },
  {
    id: "use",
    title: "How we use it",
    body: (
      <>
        <p>We use the data above to:</p>
        <ul>
          <li>
            Run the service: show your feed, deliver your messages, encode and
            play your video, and keep your settings applied across the web and
            the app.
          </li>
          <li>
            Authenticate you, keep your session valid, and let you review
            sign-in activity on your own account.
          </li>
          <li>
            Send notifications you asked for, in the app, by push, and by
            email digest if that is on.
          </li>
          <li>
            Decide ranking and distribution: which posts For You puts in
            front of you, and how far a post travels. That is the only thing
            the per-viewer view data is used for. It is not sold, not shared,
            and there is no advertising for it to feed.
          </li>
          <li>
            Keep Orbit safe: detect spam and abuse, act on reports, and
            enforce the rules in the Terms of Service.
          </li>
          <li>
            Fix problems. Crash and error reports help us find bugs, and are
            sampled rather than collected from every session.
          </li>
          <li>
            Meet legal obligations and respond to lawful requests where we are
            required to.
          </li>
        </ul>
        <p>
          Ranking on Orbit uses your own signals: who you follow, what you
          engaged with, the topic preferences you set, and what has already
          been shown to you. Your Following feed
          is strictly chronological and is not ranked at all. Nobody can pay
          to appear more often in anyone&apos;s feed.
        </p>
      </>
    ),
  },
  {
    id: "never",
    title: "What we never do",
    body: (
      <>
        <ul>
          <li>
            <strong>No sale of personal data.</strong> We do not sell or rent
            your data, and we do not share it for cross-context behavioral
            advertising. There is nothing to opt out of because it does not
            happen.
          </li>
          <li>
            <strong>No advertising and no ad tech.</strong> Orbit carries no
            ads and neither app contains an advertising SDK, a tracking pixel,
            or a third-party analytics package.
          </li>
          <li>
            <strong>No AI training on your content.</strong> Your posts,
            photos, clips, and voice are not training data, ours or anyone
            else&apos;s.
          </li>
          <li>
            <strong>No reading your messages for profiling.</strong> We do not
            scan direct messages to build a profile of you or to target
            anything at you.
          </li>
          <li>
            <strong>No location tracking.</strong> Orbit never asks for your
            device location. Any location on your profile or a post is text
            you chose to type.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "processors",
    title: "The companies that process data for us",
    body: (
      <>
        <p>
          Orbit is built on services run by other companies. Each is a
          processor acting on our instructions, gets only what its job
          requires, and cannot use your data for its own purposes. This is the
          complete list.
        </p>
        <ul>
          <li>
            <strong>Supabase</strong> hosts the database, authentication, file
            storage, and realtime connections. Effectively everything in this
            policy is stored there.
          </li>
          <li>
            <strong>Vercel</strong> hosts the website and the server code, and
            runs the scheduled jobs. Its infrastructure sees requests to Orbit
            and the IP addresses they come from.
          </li>
          <li>
            <strong>Mux</strong> encodes, stores, and delivers video for
            clips, live streams, and replays.
          </li>
          <li>
            <strong>Resend</strong> delivers email: verification, password
            reset, event reminders, and the daily digest. It receives your
            email address and the contents of the message.
          </li>
          <li>
            <strong>Cloudflare</strong> provides the Turnstile check that
            protects signup, login, and password reset from automated abuse,
            and the relay servers that carry live audio and video when a
            direct connection is not possible. Turnstile is a privacy-focused
            alternative to a captcha and does not profile you across sites.
          </li>
          <li>
            <strong>Apple, Google, and browser push services</strong> deliver
            push notifications. In the mobile app they are reached through
            Expo&apos;s push service. They receive the notification and the
            token that routes it to your device.
          </li>
          <li>
            <strong>Sentry</strong> receives error and crash reports so we can
            fix bugs. A fraction of sessions is traced for performance, and a
            session recording is captured only when an error occurs.
          </li>
          <li>
            <strong>Anthropic, reached through Vercel&apos;s AI Gateway</strong>{" "}
            powers two optional features: suggesting a caption for an image or
            video you are about to post, and a second-pass check on post text
            before it publishes. Only the specific image or text involved is
            sent, only when the feature runs, and only to produce that one
            response. This is not training data, and both features fall back
            to local behavior when the service is unavailable.
          </li>
          <li>
            <strong>A public IP-lookup service</strong> is queried by your
            browser or app at sign-in to determine the address you are
            connecting from, which is what makes your sign-in history
            readable.
          </li>
        </ul>
        <p>
          These companies are based in the United States, so using Orbit
          involves storing and processing your data there. We share data with
          anyone else only when you direct us to, when the law requires it, or
          if Orbit is ever acquired or merged, in which case we will say so
          before your data moves.
        </p>
      </>
    ),
  },
  {
    id: "visibility",
    title: "What other people can see",
    body: (
      <>
        <p>
          Your username, display name, avatar, bio, and public posts are
          visible to anyone, including people who are not signed in, and can
          be indexed by search engines. A private account limits your posts to
          approved followers, and posts set to followers-only or close friends
          go only to that audience.
        </p>
        <p>
          Some things are visible to specific people by design: the person who
          posted a moment sees who viewed it, read receipts are reciprocal and
          can be turned off, and activity status can be hidden. Settings pages
          for privacy, content, and notifications control each of these.
        </p>
        <p>
          Anything visible to another person can be screenshotted or copied.
          Privacy settings control distribution, not what someone does with
          what they already saw.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <>
        <ul>
          <li>
            <strong>Moments</strong> expire 24 hours after posting. They stop
            being visible at expiry and are deleted on an hourly cleanup.
          </li>
          <li>
            <strong>Sign-in history</strong> is kept for 90 days, then deleted
            automatically.
          </li>
          <li>
            <strong>Event reminder records</strong> are kept for 30 days.
          </li>
          <li>
            <strong>Per-viewer view records</strong> are kept for 90 days.
            They are stored a day at a time and a whole day is dropped at
            once, not thinned row by row. What outlives them is a daily total
            for each post: how many times it was shown, how many different
            people saw it, the summed time on screen and watch time, and the
            completions. No viewer identities are in that total. The action
            records have no separate clock and go when the post or your
            account does.
          </li>
          <li>
            <strong>Posts, messages, and everything else you create</strong>{" "}
            are kept until you delete them or delete your account. We do not
            expire your content on our own schedule.
          </li>
          <li>
            <strong>Moderation records</strong> for actioned violations are
            kept after an account closes, so appeals can be answered and
            repeat abuse can be recognized.
          </li>
          <li>
            <strong>Backups</strong> hold copies for a short rolling window
            and age out on their own cycle.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "rights",
    title: "Your rights and how to use them",
    body: (
      <>
        <h3>Get a copy of your data</h3>
        <p>
          Settings, then Your data, produces a single JSON file you download
          on the spot, limited to one export every ten minutes. It contains
          your profile, your posts and their media, who you follow and who
          follows you, your bookmarks, likes, mutes, and blocks, and the view
          and action records described above for the posts you were shown.
          Direct
          messages are deliberately excluded, because a conversation belongs
          to everyone in it, not only to the person exporting.
        </p>
        <h3>Correct your data</h3>
        <p>
          Edit your profile and settings at any time. If something we hold
          about you is wrong and you cannot fix it yourself, write to{" "}
          <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>.
        </p>
        <h3>Delete your account</h3>
        <p>
          Settings, then Account, then Delete account. It is immediate and
          permanent, with no grace period, and requires your second factor if
          two-factor authentication is on. Your profile and the content
          attached to it are removed along with your login.
        </p>
        <p>
          Two things do not go automatically. Files already uploaded to
          storage may persist after the database records referring to them are
          gone; write to{" "}
          <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a> and we will
          purge them. Moderation reports naming the account are retained for
          the reasons in the retention section.
        </p>
        <h3>Control what reaches you</h3>
        <p>
          Notification settings choose which alerts arrive and when, including
          quiet hours and the daily email digest. Every digest carries a
          one-click unsubscribe link, and your mail client&apos;s own
          Unsubscribe button works on it too. Turning the digest off does not
          stop account email such as password resets and security notices,
          which we send because they protect your account.
        </p>
        <h3>Object, restrict, or complain</h3>
        <p>
          Depending on where you live, you may have the right to object to or
          restrict certain processing, to withdraw consent, and to lodge a
          complaint with your data protection authority. Write to{" "}
          <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a> and we will
          answer within 30 days. We never charge for a request and never
          degrade your account for making one.
        </p>
      </>
    ),
  },
  {
    id: "legal-bases",
    title: "Why we are allowed to process it",
    body: (
      <>
        <p>
          If you are in the European Economic Area or the United Kingdom, our
          legal bases are:
        </p>
        <ul>
          <li>
            <strong>Contract.</strong> Running your account and delivering the
            features you asked for.
          </li>
          <li>
            <strong>Legitimate interests.</strong> Keeping Orbit secure,
            preventing abuse and spam, and fixing errors, balanced against
            your rights and limited to what those aims need.
          </li>
          <li>
            <strong>Consent.</strong> Push notifications, the email digest,
            and optional features you switch on. You can withdraw consent at
            any time in settings.
          </li>
          <li>
            <strong>Legal obligation.</strong> Responding to lawful requests
            and meeting reporting duties, including reporting child sexual
            abuse material.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "security",
    title: "How your data is protected",
    body: (
      <>
        <p>
          All traffic to Orbit is encrypted in transit. Data in the database is
          protected by row-level security, which enforces at the database
          itself that one account cannot read another&apos;s private data, so
          a bug in the application cannot hand out records it should not.
          Message attachments sit in a private storage area that requires
          authentication.
        </p>
        <p>
          Session cookies are HTTP-only, secure, and same-site, so page scripts
          cannot read them. You can turn on two-factor authentication, review
          every sign-in on your account, and end sessions you do not
          recognize. Recovery codes are stored hashed.
        </p>
        <p>
          Direct messages are not end-to-end encrypted. They are encrypted in
          transit and at rest, but we hold the keys, which means we can access
          them when a legal obligation or a safety investigation requires it.
          If you need cryptographic secrecy from us, use a tool built for it.
        </p>
        <p>
          No system is perfect. If we discover a breach that affects your
          personal data, we will notify you and the relevant authorities as
          the law requires, and tell you what happened rather than the least
          we can get away with.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and on-device storage",
    body: (
      <>
        <p>
          Orbit sets no advertising or tracking cookies. The cookies we do set
          are the session cookies that keep you signed in and a small number
          of preference values such as your theme.
        </p>
        <p>
          The app and the website also keep data on your own device to work
          faster and offline: a cache of content you have already loaded,
          recently used emoji, and drafts you have not posted. That data stays
          on your device and is cleared when you sign out or clear site data.
        </p>
      </>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: (
      <>
        <p>
          Orbit is not for anyone under 13, and we do not knowingly collect
          data from children under 13. If you believe a child under 13 has an
          account, write to{" "}
          <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a> and we will
          close it and delete the data.
        </p>
        <p>
          Sexual content involving minors is removed immediately, the account
          is closed permanently, and we report it to the appropriate
          authorities.
        </p>
      </>
    ),
  },
  {
    id: "regional",
    title: "Regional rights",
    body: (
      <>
        <h3>United States</h3>
        <p>
          Residents of California and other states with comprehensive privacy
          laws have the right to know what is collected, to access and delete
          it, to correct it, and not to be discriminated against for asking.
          The tools above serve all of these. We do not sell personal
          information or share it for cross-context behavioral advertising, so
          there is no opt-out to offer.
        </p>
        <h3>European Economic Area and United Kingdom</h3>
        <p>
          You have the rights of access, rectification, erasure, restriction,
          portability, and objection, and the right to complain to your
          supervisory authority. {COMPANY_LEGAL_NAME} is the controller for
          the data described here. Because our processors are in the United
          States, your data is transferred there under the standard
          contractual clauses or another approved mechanism.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <>
        <p>
          When Orbit changes in a way that changes what we collect or who
          processes it, this page changes with it and the last updated date at
          the top moves. For a material change we give notice in the product
          or by email before it takes effect, rather than editing the page
          quietly.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <>
        <p>
          Privacy questions, data requests, and anything in this document:{" "}
          <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>.
        </p>
        <p>
          By mail: {COMPANY_LEGAL_NAME}, {COMPANY_ADDRESS}. We are established
          in {COMPANY_JURISDICTION}.
        </p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalShell
      eyebrow="Orbit · Legal"
      titleLead="Privacy"
      titleAccent="Policy"
      intro="Written against the system itself, not from a template. Every category below is something Orbit actually stores, every company named is one we actually use, and the retention numbers are the ones the cleanup jobs run on."
      effectiveDate={EFFECTIVE_DATE}
      lastUpdated={LAST_UPDATED}
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
