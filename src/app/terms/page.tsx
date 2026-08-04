// Public, logged-out-accessible page. Static server component: no "use
// client", no data fetching, so it prerenders at build time.
//
// The company name, address, jurisdiction, and contact mailboxes come from
// src/lib/legal.ts and must be set before launch.
import type { Metadata } from "next";
import Link from "next/link";
import { LegalSection, LegalShell } from "@/components/legal/legal-page";
import {
  COMPANY_ADDRESS,
  COMPANY_JURISDICTION,
  COMPANY_LEGAL_NAME,
  CONTACT_EMAIL,
  DMCA_EMAIL,
  EFFECTIVE_DATE,
  LAST_UPDATED,
  PRIVACY_EMAIL,
} from "@/lib/legal";

const title = "Terms of Service";
const description =
  "The agreement between you and Orbit: who can join, what you can post, the narrow license you give us to display your content, how moderation and appeals work, and how to close your account.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/terms" },
  openGraph: { title, description },
  twitter: { title, description },
};

const sections: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: "agreement",
    title: "The agreement",
    body: (
      <>
        <p>
          Orbit is a social platform operated by {COMPANY_LEGAL_NAME}, at{" "}
          {COMPANY_ADDRESS}. These terms are the agreement between you and us
          for your use of the Orbit website, the Orbit mobile app, and
          everything they connect to. In this document, &ldquo;Orbit&rdquo;,
          &ldquo;we&rdquo;, and &ldquo;us&rdquo; mean {COMPANY_LEGAL_NAME}, and
          &ldquo;you&rdquo; means the person using the service.
        </p>
        <p>
          By creating an account, or by using Orbit without one, you accept
          these terms. If you do not accept them, do not use Orbit.
        </p>
        <p>
          Two other documents sit alongside this one and are part of your
          relationship with us. The{" "}
          <Link href="/privacy">Privacy Policy</Link> explains what we collect
          and why. The <Link href="/promises">ten promises</Link> are
          commitments about how the product behaves: a chronological Following
          feed, no paid reach, no silent enforcement, and no AI training on
          your content. We hold ourselves to them.
        </p>
      </>
    ),
  },
  {
    id: "eligibility",
    title: "Who can use Orbit",
    body: (
      <>
        <p>
          You must be at least 13 years old to have an Orbit account. Signup
          asks for your date of birth to check this. If the law where you live
          sets a higher minimum age for using a service like this without a
          parent or guardian&apos;s consent, that higher age applies to you.
        </p>
        <p>
          One person, one account, registered under an email address you
          control. You may not use Orbit if we have previously removed your
          account, and you may not create a new account to get around an
          enforcement decision.
        </p>
        <p>
          If we learn that an account belongs to someone under 13, we close it
          and delete the data associated with it.
        </p>
      </>
    ),
  },
  {
    id: "account",
    title: "Your account",
    body: (
      <>
        <p>
          You are responsible for your account and for what happens through
          it. Keep your password to yourself, use a password you do not use
          anywhere else, and turn on two-factor authentication in security
          settings if you want a second lock on the door. Every sign-in
          attempt on your account is recorded and visible to you, so you can
          spot one you did not make.
        </p>
        <p>
          Tell us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> if
          you believe someone else has access to your account. We may ask you
          to complete your second factor before we act on requests that change
          or destroy account data.
        </p>
        <p>
          Your username is yours to use while your account is active, not
          property you own. We may reclaim a username that impersonates
          someone, that infringes a trademark, or that has been abandoned.
        </p>
      </>
    ),
  },
  {
    id: "your-content",
    title: "Your content stays yours",
    body: (
      <>
        <p>
          You own what you post. Orbit claims no ownership of your posts,
          photos, videos, clips, moments, live streams, messages, listings, or
          anything else you create. Nothing in these terms transfers your
          copyright to us.
        </p>
        <p>
          To run the service we need permission to handle your files. You give
          Orbit a non-exclusive, worldwide, royalty-free license to host,
          store, back up, reproduce, encode, transcode, resize, and display
          your content, and to distribute it to the people you chose to show
          it to. That is the whole of it. The license exists so that a photo
          you upload can be stored, turned into the sizes a phone and a
          desktop need, and shown to your followers, or to everyone if you
          posted publicly.
        </p>
        <p>
          The license is bounded in four ways, and we intend to be held to
          each:
        </p>
        <ul>
          <li>
            <strong>It is only for operating Orbit.</strong> We do not sell
            your content, license it to third parties for their own use, or
            put it in advertising.
          </li>
          <li>
            <strong>It does not include training AI models.</strong> Your
            posts, photos, clips, and voice are not training data, ours or
            anyone else&apos;s.
          </li>
          <li>
            <strong>It follows your audience settings.</strong> If a post is
            for followers only, the license to distribute it reaches followers
            only.
          </li>
          <li>
            <strong>It ends when you delete.</strong> Delete a post or your
            account and the license ends with it. Two practical limits: copies
            in encrypted backups age out on the normal backup cycle, and
            content another person already received, reposted, or saved is
            outside our control.
          </li>
        </ul>
        <p>
          You keep the right to post the same content anywhere else, at any
          time. You confirm that you have the rights to everything you upload,
          including any music, footage, or images made by someone else.
        </p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "What you may not post or do",
    body: (
      <>
        <p>
          Orbit is built for argument, dark humor, criticism of public
          figures, and political opinion. None of that is a violation. The
          rules below are about harm, not disagreement.
        </p>
        <p>Do not post:</p>
        <ul>
          <li>
            Slurs or hateful language aimed at people for their race,
            ethnicity, national origin, religion, disability, sex, gender
            identity, or sexual orientation, including coded and leetspeak
            variants meant to slip past filters.
          </li>
          <li>
            Threats of violence, incitement to violence, or content
            encouraging someone to hurt or kill themselves.
          </li>
          <li>
            Targeted harassment, including coordinated pile-ons, doxxing
            (publishing someone&apos;s private information), and swatting.
          </li>
          <li>
            Sexual content involving minors, in any form. We report this to
            the relevant authorities and remove the account permanently.
          </li>
          <li>
            Spam: bulk or repetitive posting, link dumps, engagement farming,
            or automated posting made to look human.
          </li>
          <li>
            Impersonation of a real person, brand, or organization in a way
            meant to deceive.
          </li>
          <li>
            Content you do not have the rights to, including other
            people&apos;s copyrighted work.
          </li>
        </ul>
        <p>Do not do:</p>
        <ul>
          <li>
            Scrape, crawl, or bulk-collect Orbit data, or use bots or
            automation against the service without our written permission.
          </li>
          <li>
            Probe, scan, or test the security of Orbit, bypass rate limits or
            authentication, or access an account or data that is not yours.
          </li>
          <li>
            Circumvent an enforcement decision, including by making a new
            account.
          </li>
          <li>
            Interfere with anyone else&apos;s use of the service, or with the
            infrastructure that runs it.
          </li>
        </ul>
        <p>
          If you find a security flaw, report it to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> rather than
          exploiting it. We will not pursue anyone who reports a flaw in good
          faith and gives us a reasonable chance to fix it.
        </p>
      </>
    ),
  },
  {
    id: "moderation",
    title: "Moderation, enforcement, and appeals",
    body: (
      <>
        <p>
          Two things look at content on Orbit. An automatic check runs when
          you post, combining pattern matching in your browser with a
          classifier that reads the text of the post. It sorts content into
          hate, harassment, violence, self-harm, sexual, spam, evasion, or
          none, with a severity. A flagged post shows you a warning before it
          publishes; high-severity content is additionally recorded for human
          review. The automatic check never removes a post by itself.
        </p>
        <p>
          The second is you. Any post, comment, or account can be reported
          under spam, harassment, hate speech, violence, nudity, or other,
          with a description. Reports go to a queue that a person reviews, and
          each one ends as reviewed, actioned, or dismissed. When a report is
          actioned, the content is hidden from the service.
        </p>
        <p>
          Enforcement is never silent. Every action taken against your
          account, the reason for it, and the date appear in{" "}
          <Link href="/settings/account-status">your account status</Link>,
          along with any automatic flags on your content and the outcome of
          reports you filed.
        </p>
        <p>
          You can appeal any violation from that page. One appeal per
          violation, up to 2,000 characters, and a person reads it. Appeals
          are resolved as upheld or reversed, and the result appears in the
          same place.
        </p>
        <p>
          For severe or repeated violations, we may remove content, restrict
          features, or close an account. Content involving the sexual
          exploitation of minors, credible threats of violence, or an active
          attempt to compromise the service is removed immediately and
          reviewed after.
        </p>
      </>
    ),
  },
  {
    id: "features",
    title: "Specific features",
    body: (
      <>
        <h3>Moments</h3>
        <p>
          Moments expire 24 hours after you post them. They stop being visible
          at expiry and are deleted from our database shortly after, on an
          hourly cleanup. Anyone who can see a moment can see that you viewed
          theirs, and can screenshot or record it. Treat a moment as public to
          its audience, not as ephemeral in the security sense.
        </p>
        <h3>Messages</h3>
        <p>
          Direct messages are private between participants, and we do not read
          them for advertising or profiling. They are not end-to-end
          encrypted: they are stored on our servers, and we can access them
          when a legal obligation or a safety investigation requires it. Do
          not use Orbit messages for information that would harm you if it
          were disclosed.
        </p>
        <h3>Live and video</h3>
        <p>
          Live streams and uploaded video are encoded and delivered by Mux, a
          third-party video provider. Streams may be recorded and kept as a
          replay, which you can delete. Everything in these terms applies to a
          live stream in real time, and a stream that violates the rules can
          be ended while it is running.
        </p>
        <h3>Marketplace</h3>
        <p>
          Marketplace listings are agreements between users. Orbit is not the
          seller, not a party to your transaction, and does not process
          payments, hold funds, ship goods, or offer refunds. We do not
          verify listings, sellers, buyers, or items. Meet safely, pay in a
          way you can dispute, and judge each deal for yourself. Do not list
          anything illegal to sell where you or the buyer live.
        </p>
        <h3>Communities and events</h3>
        <p>
          People who create a community or an event set its rules and manage
          its membership. These terms still apply inside every community, and
          a community that exists to break them will be removed.
        </p>
      </>
    ),
  },
  {
    id: "copyright",
    title: "Copyright and the DMCA",
    body: (
      <>
        <p>
          If you own the copyright in something posted on Orbit without your
          permission, send a notice to{" "}
          <a href={`mailto:${DMCA_EMAIL}`}>{DMCA_EMAIL}</a> or by mail to{" "}
          {COMPANY_LEGAL_NAME}, {COMPANY_ADDRESS}. Include:
        </p>
        <ul>
          <li>Your physical or electronic signature.</li>
          <li>
            Identification of the work you say was infringed, and of the
            material on Orbit you want removed, with a link to it.
          </li>
          <li>Your name, address, phone number, and email address.</li>
          <li>
            A statement that you believe in good faith that the use is not
            authorized by the copyright owner, its agent, or the law.
          </li>
          <li>
            A statement, under penalty of perjury, that the information in
            your notice is accurate and that you are the owner or authorized
            to act for the owner.
          </li>
        </ul>
        <p>
          We remove material that is the subject of a valid notice and tell
          the person who posted it. If you believe your content was removed by
          mistake, you can send a counter-notice to the same address with your
          signature, identification of the removed material, a statement under
          penalty of perjury that you believe it was removed by mistake or
          misidentification, and your consent to the jurisdiction of the
          federal court where you live. We may restore the material unless the
          original complainant files a court action.
        </p>
        <p>
          Accounts that repeatedly infringe copyright are closed. Filing a
          notice you know to be false carries legal liability.
        </p>
      </>
    ),
  },
  {
    id: "third-parties",
    title: "Third-party services and links",
    body: (
      <>
        <p>
          Orbit runs on infrastructure and services operated by other
          companies, listed by name in the{" "}
          <Link href="/privacy">Privacy Policy</Link>. Their handling of data
          is described there. We choose them, we hold them to written terms,
          and we remain responsible to you for the service.
        </p>
        <p>
          Content on Orbit can link anywhere on the web. We do not control
          linked sites, do not endorse them, and are not responsible for what
          they do. A link preview is generated from the page&apos;s own
          metadata and is not a recommendation.
        </p>
      </>
    ),
  },
  {
    id: "ending",
    title: "Ending your account, and ours",
    body: (
      <>
        <p>
          You can delete your account at any time from account settings. It is
          immediate and permanent: your profile and the content attached to it
          are removed, and there is no waiting period during which you can
          change your mind. If you have two-factor authentication turned on,
          you will be asked to complete it first. Export your data before you
          do this if you want to keep it.
        </p>
        <p>
          We may suspend or close an account, or remove content, when it
          breaks these terms, when keeping it would expose Orbit or its users
          to legal risk, or when we are required to by law. Except where an
          immediate response is needed, we tell you what we did and why, and
          you can appeal.
        </p>
        <p>
          If Orbit ever shuts down, we will give notice with enough time to
          export your data.
        </p>
        <p>
          The sections on your content license (as it applies to content
          already deleted), disclaimers, liability, indemnity, and governing
          law survive the end of your account.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to the service and to these terms",
    body: (
      <>
        <p>
          We build and change Orbit continuously. Features arrive, and
          occasionally a feature is removed. Where a change alters something
          you rely on, the ten promises describe what we owe you: announced
          changes to navigation, no retroactive degradation of what you have
          already uploaded, and no reordering of your Following feed.
        </p>
        <p>
          We may update these terms. When a change is material, we will give
          notice in the product or by email before it takes effect, and we
          will update the effective date at the top of this page. Continuing
          to use Orbit after a change takes effect means you accept the
          updated terms. If you do not, delete your account.
        </p>
      </>
    ),
  },
  {
    id: "disclaimers",
    title: "Disclaimers and liability",
    body: (
      <>
        <p>
          Orbit is provided as it is and as available. To the fullest extent
          the law allows, we disclaim implied warranties of merchantability,
          fitness for a particular purpose, and non-infringement. We do not
          promise that the service will be uninterrupted, that it will be free
          of errors, or that content posted by other people will be accurate,
          lawful, or inoffensive.
        </p>
        <p>
          To the fullest extent the law allows, neither {COMPANY_LEGAL_NAME}{" "}
          nor its people will be liable for indirect, incidental, special,
          consequential, or punitive damages, or for lost profits, lost data,
          or loss of goodwill, arising out of your use of Orbit. Our total
          liability for any claim relating to Orbit is limited to the greater
          of the amount you paid us in the twelve months before the claim, or
          one hundred United States dollars.
        </p>
        <p>
          Some jurisdictions do not allow the exclusion of certain warranties
          or the limitation of certain damages. Where that is true, the
          exclusions and limits above apply only as far as that jurisdiction
          permits, and nothing here limits liability for fraud, for death or
          personal injury caused by negligence, or for anything else that
          cannot lawfully be limited.
        </p>
        <p>
          You agree to indemnify and hold {COMPANY_LEGAL_NAME} harmless from
          claims, damages, and reasonable legal costs arising from content you
          post, from your use of Orbit, or from your breach of these terms.
        </p>
      </>
    ),
  },
  {
    id: "disputes",
    title: "Governing law and disputes",
    body: (
      <>
        <p>
          These terms are governed by the laws of {COMPANY_JURISDICTION},
          without regard to its conflict-of-laws rules. Any dispute that is
          not resolved informally will be brought in the state or federal
          courts located in {COMPANY_JURISDICTION}, and you and{" "}
          {COMPANY_LEGAL_NAME} each consent to the jurisdiction of those
          courts.
        </p>
        <p>
          If you live somewhere whose law gives you the right to bring a claim
          in your local courts or under your local consumer law, this section
          does not take that right away.
        </p>
        <p>
          Before filing anything, write to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and describe
          the problem. Most disputes end there, and we would rather fix
          something than argue about it.
        </p>
      </>
    ),
  },
  {
    id: "general",
    title: "General terms",
    body: (
      <>
        <p>
          These terms, together with the Privacy Policy, are the entire
          agreement between you and {COMPANY_LEGAL_NAME} about Orbit. If any
          provision is found unenforceable, the rest stays in force and the
          unenforceable part is narrowed to what the law allows.
        </p>
        <p>
          Our not enforcing a provision on one occasion is not a waiver of it.
          You may not transfer your rights under these terms; we may transfer
          ours to a successor in a merger, acquisition, or sale of assets, on
          notice to you.
        </p>
        <p>
          Nothing in these terms creates a partnership, employment
          relationship, or agency between you and us.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    title: "How to reach us",
    body: (
      <>
        <p>
          General questions and account help:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          <br />
          Privacy and data requests:{" "}
          <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>
          <br />
          Copyright notices:{" "}
          <a href={`mailto:${DMCA_EMAIL}`}>{DMCA_EMAIL}</a>
        </p>
        <p>
          By mail: {COMPANY_LEGAL_NAME}, {COMPANY_ADDRESS}.
        </p>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalShell
      eyebrow="Orbit · Legal"
      titleLead="Terms of"
      titleAccent="Service"
      intro="What you agree to when you use Orbit, written to be read rather than skipped. Your content stays yours, enforcement is never silent, and every rule here maps to something the product actually does."
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
