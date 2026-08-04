// Public, logged-out-accessible page. Static server component: no "use
// client", no data fetching, so it prerenders at build time.
//
// Every claim here was checked against the code that implements it. When a
// feature and its UI copy disagree, this page describes the behaviour, not
// the copy.
import type { Metadata } from "next";
import Link from "next/link";
import { LegalSection, LegalShell } from "@/components/legal/legal-page";
import { CONTACT_EMAIL, DMCA_EMAIL, PRIVACY_EMAIL } from "@/lib/legal";

const title = "Help center";
const description =
  "How Orbit works: the two feeds, moments, clips, rooms, live, messages, privacy and safety controls, notifications, two-factor, data export, and what to do when something breaks.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/help" },
  openGraph: { title, description },
  twitter: { title, description },
};

const sections: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: "getting-started",
    title: "Getting started",
    body: (
      <>
        <p>
          Orbit runs on the web at orbitsocial.net and in the Orbit app for iOS
          and Android. The same account works on both.
        </p>
        <p>
          Signing up on the web asks for a display name, a username, an email
          address you control, your date of birth, and a password of at least
          ten characters with upper and lower case, a number, and a symbol. The
          app can create an account from an email and a password alone, and
          asks for your username the first time you open your profile. You must
          be at least 13 to have an account.
        </p>
        <p>
          The web follows your system light or dark setting, with a toggle in
          the sidebar. The app is dark-only for now, on every device and every
          system setting. That is a decision, not a missing feature.
        </p>
        <p>
          You do not need an account to look around. Feed, profiles, posts,
          clips, rooms, events, live streams, and Marketplace are all readable
          signed out. Posting, following, messaging, and everything under
          Settings need an account.
        </p>
        <h3>Things that do not exist yet</h3>
        <p>
          You cannot change the email address on an account, and you cannot
          deactivate an account temporarily. Both are called out in the places
          you would look for them.
        </p>
      </>
    ),
  },
  {
    id: "feeds",
    title: "How the two feeds differ",
    body: (
      <>
        <p>
          Home has two tabs. They pull the same posts and treat them very
          differently.
        </p>
        <h3>Following</h3>
        <p>
          Strictly chronological and complete: every top-level post from every
          account you follow, newest first. Nothing is injected, nothing is
          ranked, and nothing you have already seen is skipped. This is the
          first of the <Link href="/promises">ten promises</Link>. On the web
          your own posts appear in Following too. In the app they do not. Home
          opens on For You, so switch to Following each time if that is the one
          you want.
        </p>
        <h3>For You</h3>
        <p>
          The same posts, reordered on your own device. Nothing is scored on a
          server and nothing about the ordering follows you between sessions.
          The signals are:
        </p>
        <ul>
          <li>
            How recent the post is, which carries the most weight and halves in
            value roughly every twelve hours.
          </li>
          <li>Likes, comments, and reposts, with diminishing returns.</li>
          <li>A small lift for posts carrying video or images.</li>
          <li>
            A lift for accounts under 100 followers or with five or fewer posts,
            fading out over the author&apos;s first 48 hours.
          </li>
          <li>
            Your topic preferences from Settings, Content Preferences: a topic
            marked see more is nudged up, see less is nudged down, matched
            against the hashtags in the post.
          </li>
          <li>
            A push down for posts behind a content warning if you set sensitive
            content to Less.
          </li>
        </ul>
        <p>
          On the web, For You also spaces out consecutive posts from the same
          author so one person cannot fill the screen. Nobody can pay for a
          higher position.
        </p>
        <h3>What both tabs leave out</h3>
        <p>
          Replies, clips, and posts made inside a room never appear in Home.
          Clips have their own tab and room posts stay in their room. Posts from
          accounts you muted, posts matching your muted words, and posts you
          marked not interested are removed after each page loads, so a page can
          come back shorter than a full one.
        </p>
        <p>
          Signed out, there is one public timeline instead of the two tabs.
        </p>
      </>
    ),
  },
  {
    id: "posting",
    title: "Posting, comments, and reposts",
    body: (
      <>
        <p>
          Compose from the plus button. You can save a draft, schedule a post
          for later, and find both under Drafts and Scheduled.
        </p>
        <p>
          Every post has an audience: public, or close friends only. Close
          friends is a list you keep in Settings, Close Friends, and the people
          on it are never told they are on it.
        </p>
        <h3>Who can comment</h3>
        <p>
          Set per post, at compose time or afterwards from the post&apos;s menu:
          everyone, people you follow, or nobody. People you follow means the
          commenter has to be someone <em>you</em> follow. You can always
          comment on your own post. The rule is enforced by the database, not
          just hidden in the interface.
        </p>
        <h3>Comments</h3>
        <p>
          Comments go two levels deep: a comment on a post, and replies to that
          comment. You can sort by top or newest, and you can pin exactly one
          comment on each of your own posts. Pinning a second one unpins the
          first.
        </p>
        <h3>Reposts and quotes</h3>
        <p>
          Repost to send a post to your followers as-is, or quote it to add your
          own text. Undo a repost the same way you made it.
        </p>
      </>
    ),
  },
  {
    id: "moments",
    title: "Moments and the 24-hour rule",
    body: (
      <>
        <p>
          A moment is a photo or a short video that disappears 24 hours after
          you post it. Video moments recorded in the app are capped at 30
          seconds, and each moment plays for about five seconds in the viewer.
          You can add text, a mention sticker, and a link sticker.
        </p>
        <p>
          Moments have two audiences: public, or close friends. There is no
          per-person hide list. Note that turning on a private account does not
          cover your moments, so close friends is the control to use when you
          want a small audience.
        </p>
        <p>
          On your own moments you can open the viewers list and see exactly who
          watched. Other people cannot reply with text: tapping a reaction sends
          you an emoji as a direct message and a notification.
        </p>
        <h3>What happens at 24 hours</h3>
        <p>
          Expiry is a deletion, not an archive. A cleanup job removes expired
          moments from Orbit shortly after the 24 hours are up, so treat a
          moment as gone at that point. Your Moments screen lists your own
          moments while they are still there. If you want to keep something,
          keep your own copy of the file before you post it.
        </p>
        <p>
          Orbit sends at most one prompt a day suggesting you post a moment. It
          arrives at a different hour each day so it never becomes a routine.
        </p>
      </>
    ),
  },
  {
    id: "clips",
    title: "Clips and loops",
    body: (
      <>
        <p>
          Clips are short vertical videos on their own tab. The clips feed is
          chronological, newest first. It is not ranked.
        </p>
        <h3>Loops</h3>
        <p>
          A loop is counted every time a clip plays past its end and starts
          again. Loops accumulate while you watch; you do not have to do
          anything.
        </p>
        <p>
          <strong>Loop it</strong> is the clips version of a repost: it sends
          the clip to your followers. You cannot Loop your own clip. Tapping it
          again undoes it.
        </p>
        <h3>Best Loops</h3>
        <p>
          A short shelf pinned to the top of the clips feed, refreshed weekly
          and picked by hand by the Orbit team. Clips on it carry a Best Loops
          badge. There is no submission form and no way to nominate a clip.
        </p>
        <h3>Making a clip</h3>
        <p>
          In the app, hold the record button on the clip camera. You get eight
          seconds in total and can spread them across several takes. On the web
          there is no camera: you upload a video file up to 50MB.
        </p>
        <p>
          The app splits clips into two lanes. All is everything; Loops is
          clips of eight seconds or less, the length that reads as a loop rather
          than a video.
        </p>
        <p>
          Clips carry sound credit, so a clip without a chosen sound gets an
          original sound credited to you and other people can find everything
          made with it. Orbit does not mix or overlay audio for you.
        </p>
      </>
    ),
  },
  {
    id: "rooms",
    title: "Rooms",
    body: (
      <>
        <p>
          Rooms are small group spaces with their own posts, rules, and
          moderators. A room post never appears in Home or Discover, and Home
          never leaks into a room.
        </p>
        <h3>Joining</h3>
        <p>
          Each room picks one of three settings. Open rooms let you join
          instantly. Approval rooms turn your tap into a request that an owner
          or moderator accepts or declines. Invite-only rooms cannot be joined
          at all until someone invites you.
        </p>
        <p>
          A private room is hidden from listings and from search, and its posts
          are only readable by members.
        </p>
        <h3>Roles</h3>
        <p>
          Owner, moderator, member. Only the owner can promote or demote a
          moderator or remove a member, and the owner cannot be removed. Owners
          and moderators approve join requests, invite people, and pin a post;
          a post&apos;s own author can pin it too.
        </p>
        <h3>Rules and slow mode</h3>
        <p>
          A room can carry rules you accept before your first post. An owner can
          also set slow mode, anywhere from off to six hours between posts.
          Owners and moderators are exempt from it.
        </p>
      </>
    ),
  },
  {
    id: "events",
    title: "Events",
    body: (
      <>
        <p>
          Anyone signed in can create an event: title, description, start and
          end time, timezone, a cover image, and either a physical location or
          an online link. An event can be attached to a room. The host is
          counted as going straight away.
        </p>
        <p>
          RSVP as going or interested. The attendee number counts people going;
          the guest list shows both. Hosts can add co-hosts, and only the host
          can delete the event. Events have comments with replies, and the list
          page shows events from today forward, soonest first.
        </p>
        <p>
          If you RSVP going and have event notifications on, Orbit reminds you
          about fifteen minutes before the start.
        </p>
        <p>
          There is no ticketing, no paid entry, no capacity limit or waitlist,
          and no calendar export.
        </p>
      </>
    ),
  },
  {
    id: "marketplace",
    title: "Marketplace",
    body: (
      <>
        <p>
          Marketplace is a listings board on its own tab, kept out of the feed
          on purpose. A listing carries photos, a price, a category
          (Electronics, Clothing, Home, Sports, or Other), a condition, and a
          location. You can save a search and pick it up again on your other
          device.
        </p>
        <h3>How a sale actually happens</h3>
        <p>
          The only buyer action is Message seller, which opens a normal direct
          message. <strong>Orbit does not process payments</strong>, hold funds,
          ship anything, or offer refunds. There is no checkout, no cart, and no
          escrow. You and the other person arrange payment and handover between
          yourselves, and the risk is yours. Sellers mark their own listings
          sold. See the <Link href="/terms">Terms of Service</Link> for the
          full position.
        </p>
      </>
    ),
  },
  {
    id: "live",
    title: "Live",
    body: (
      <>
        <p>
          Going live means sending video from a real encoder. Settings,
          Streaming gives you an RTMPS URL, an SRT URL, and your stream key, and
          walks through OBS Studio on a computer, Belabox or IRLToolkit for a
          backpack setup, and Larix Broadcaster on a phone. You go live the
          moment your encoder starts pushing; you go offline when it stops.
          There is no browser or in-app broadcast button.
        </p>
        <p>
          Your stream key does not expire and you cannot rotate it yourself. If
          it leaks, email {CONTACT_EMAIL} and it will be replaced. Treat it like
          a password: anyone holding it can broadcast as you.
        </p>
        <p>
          You can set a title, category, up to five tags, a language, a mature
          flag, chat slow mode, and followers-only chat. Chat messages are
          capped at 500 characters, and chat closes when the stream ends.
        </p>
        <p>
          Replays are saved for you automatically when the stream ends. They
          appear under Past streams, and you can rename or delete your own.
        </p>
        <p>
          Gifts on a stream are free reactions. There is no currency, no
          purchase, and no payout attached to them.
        </p>
        <p>
          The Live tab lists every stream running right now across Orbit, busiest
          first. It is discovery, not a feed of the people you follow.
        </p>
      </>
    ),
  },
  {
    id: "messages",
    title: "Messages and message requests",
    body: (
      <>
        <p>
          Direct messages come in one-to-one threads and group threads.
        </p>
        <h3>Who can start a chat with you</h3>
        <p>
          Settings, Privacy has three options: everyone, people you follow, or
          no one. It governs first contact only. Once you have sent a message in
          a thread, that thread stays open regardless of the setting. People you
          follow means the sender has to be someone you follow. Group threads
          are exempt.
        </p>
        <h3>Requests</h3>
        <p>
          A thread from someone you do not follow, that you have never opened
          and never replied to, waits in Requests instead of your inbox. Opening
          it accepts it, and it moves to the inbox. Declining hides the thread
          rather than deleting it, so if that person writes again it comes back
          as a fresh request.
        </p>
        <h3>Read receipts</h3>
        <p>
          Reciprocal. Turn yours off in Settings, Privacy and you stop seeing
          other people&apos;s too. Group threads never show read state at all.
        </p>
      </>
    ),
  },
  {
    id: "privacy",
    title: "Privacy controls",
    body: (
      <>
        <p>
          Most of these live in Settings, Privacy on the web. Private account,
          hiding your follower lists, and hiding your Likes tab are web-only
          settings today; they still apply everywhere once set.
        </p>
        <h3>Private account</h3>
        <p>
          Only approved followers can see your posts, and that is enforced by
          the database rather than by the interface, so it holds for signed-out
          visitors too. Your profile card, bio, and counts stay visible. New
          follows arrive as requests under Notifications, Requests, where you
          approve or decline them, and you can remove a follower you already
          have. Private account covers your posts; it does not cover your
          moments, so use close friends there.
        </p>
        <h3>The rest</h3>
        <ul>
          <li>
            <strong>Hide activity status.</strong> Stops Orbit showing when you
            were last active in messages. Reciprocal: with it on you cannot see
            anyone else&apos;s either.
          </li>
          <li>
            <strong>Hide your followers and following.</strong> The counts stay
            public, the lists stop opening for anyone but you.
          </li>
          <li>
            <strong>Hide your Likes tab.</strong> Other people stop seeing what
            you liked. You still see it on your own profile.
          </li>
          <li>
            <strong>Read receipts.</strong> Reciprocal, as above.
          </li>
          <li>
            <strong>Hide like counts</strong>, in Settings, Content
            Preferences. This one is about what <em>you</em> see: like counts on
            other people&apos;s posts disappear for you, and your own posts still
            show yours. It does not hide your counts from anyone else.
          </li>
          <li>
            <strong>Sensitive content</strong> and <strong>topic
            preferences</strong>, also in Content Preferences, tune how much
            potentially sensitive content reaches your feeds and nudge For You
            toward or away from a topic.
          </li>
          <li>
            <strong>Time on Orbit.</strong> Your daily minutes and an optional
            once-a-day reminder past a threshold you pick. The counting stays on
            your device and never leaves it.
          </li>
        </ul>
        <p>
          Location is off unless you turn it on, and every change you make to
          these settings is recorded so nothing about your account shifts
          without a trace.
        </p>
      </>
    ),
  },
  {
    id: "safety",
    title: "Block, mute, restrict, and muted words",
    body: (
      <>
        <p>
          Four tools that do genuinely different things. Pick by what you want
          the other person to experience.
        </p>
        <h3>Block: mutual and hard</h3>
        <p>
          Blocking cuts both directions. Their posts disappear for you and yours
          disappear for them, any follows between you are removed, each of you
          drops off the other&apos;s close friends list, pending follow requests
          are cleared, and neither of you can start a one-to-one message with
          the other. A group thread you are both in is deliberately left alone.
          A block stays in place until you remove it from Settings, Privacy.
        </p>
        <h3>Mute: one-way and silent</h3>
        <p>
          Muting hides that account&apos;s posts and clips from your feeds.
          Nothing else changes: their profile still opens, their comments still
          show, their messages still arrive, and notifications from them still
          reach you. They are never told. A mute can be set to expire on its
          own.
        </p>
        <h3>Restrict: invisible</h3>
        <p>
          Restricting someone hides their comments on posts and clips from you,
          and stops them seeing when you have read their messages. They can
          still follow you, message you, and see your posts, and they are not
          told anything changed. Manage the list in Settings, Privacy on the
          web, or Restricted accounts in the app.
        </p>
        <h3>Muted words</h3>
        <p>
          Settings, Word Filters on the web, Muted words in the app. A muted
          word hides matching posts from Home, hides matching clips, and hides
          matching comments. If a push notification&apos;s preview contains one,
          the push is not sent.
        </p>
        <p>
          Two limits worth knowing. Matching is on whole words, so
          &ldquo;cat&rdquo; hides &ldquo;cat!&rdquo; but not
          &ldquo;category&rdquo;. And muted words are not applied to direct
          messages, to search results, or to the in-app notifications list: a
          notification whose push was withheld is still there when you open the
          tab.
        </p>
      </>
    ),
  },
  {
    id: "notifications",
    title: "Notifications and quiet hours",
    body: (
      <>
        <p>
          Settings, Notifications has a switch for each kind: likes, comments,
          reposts and quotes, mentions, moment replies, direct messages, new
          followers, posts from creators whose bell you rang, live streams,
          events, Marketplace, and rooms. Turning one off stops the
          notification being created at all, so it will not be waiting in the
          tab either.
        </p>
        <p>
          The bell on someone&apos;s profile is separate from following them:
          it tells Orbit to notify you about their new posts without changing
          anything about your feed.
        </p>
        <h3>Quiet hours</h3>
        <p>
          Pick a start and end hour and Orbit stops sending push notifications
          inside that window, in your own local time. Whole hours only. Quiet
          hours suppress the push, not the notification: everything is waiting
          in the app when you look.
        </p>
        <h3>Why push is scarcer than you might expect</h3>
        <p>
          Notifications where a person deliberately reached out (a message, a
          mention, a comment, a new follower) always push. Ambient ones (likes,
          reposts, quotes, someone going live, event reminders, invites, moment
          reactions) are capped at three pushes per week each, on purpose, so
          push stays worth reading. The notifications themselves are all still
          in the app.
        </p>
        <h3>Turning push on</h3>
        <p>
          On the web, push is per browser: enable it in Settings, Notifications
          in each browser you use, and allow the browser prompt. In the app,
          allow notifications when asked, or in your device&apos;s system
          settings for Orbit afterwards.
        </p>
        <h3>Email</h3>
        <p>
          One daily digest, off or on, with a one-click unsubscribe link in
          every send. Account email such as a password reset always goes out.
        </p>
      </>
    ),
  },
  {
    id: "security",
    title: "Two-factor and sign-in security",
    body: (
      <>
        <p>
          Settings, Security on both platforms.
        </p>
        <h3>Two-factor</h3>
        <p>
          Orbit supports one second factor: a time-based code from an
          authenticator app. Scan the QR code or type the setup key, confirm one
          six-digit code, and it is on. There is no SMS option, no emailed code,
          and no passkey or hardware key support.
        </p>
        <p>
          Turning it on gives you eight backup codes. Read this part before you
          close that screen:
        </p>
        <ul>
          <li>
            They are shown once. Orbit keeps only a hash, so nobody, including
            support, can show them to you again.
          </li>
          <li>There is no way to regenerate them.</li>
          <li>
            Using one turns two-factor off entirely and destroys the remaining
            codes. It is a way back into your account, not a way to sign in.
            Set two-factor up again straight afterwards.
          </li>
        </ul>
        <h3>Sign-in activity and sessions</h3>
        <p>
          Your recent sign-ins are listed with the device, the IP address, and
          whether the attempt succeeded: Settings, Security, Login activity on
          the web, where you can also flag one as not you, and Settings,
          Sessions in the app. Sign out other sessions signs out every device
          except the one you are on. There is no per-device revoke list.
        </p>
        <h3>Password</h3>
        <p>
          Change it in Settings, Account on the web. You need your current
          password, and the new one needs at least ten characters with upper and
          lower case, a number, and a symbol. Forgot it? Use the reset link on
          the sign-in screen.
        </p>
      </>
    ),
  },
  {
    id: "data",
    title: "Your data, and leaving",
    body: (
      <>
        <p>
          Settings, Download Your Data hands you a JSON file straight away, no
          queue and no email. It contains your profile, your posts with their
          media and counts, who you follow, who follows you, your bookmarks,
          your likes, and the accounts you muted and blocked. You can run it
          once every ten minutes. The app links out to the same page on the web.
        </p>
        <p>
          Direct messages are deliberately not in the export. A conversation
          belongs to everyone in it, so exporting it would hand you other
          people&apos;s messages.
        </p>
        <h3>Leaving</h3>
        <p>
          <strong>There is no deactivation.</strong> Orbit cannot put your
          account to sleep and wake it later. Deleting is the only exit, and it
          is permanent.
        </p>
        <p>
          Deletion lives in Settings, Account, behind typing DELETE to confirm.
          It runs immediately: no grace period, no scheduled purge, nothing to
          restore, no way to cancel. Your posts, reposts, reactions, and
          messages go with you. If two-factor is on you have to be signed in at
          the second factor to do it. Export your data first if you want it.
        </p>
        <p>
          Two things survive on purpose. A room you founded keeps running for
          its members, and moderation records stay on file with your identity
          removed.
        </p>
      </>
    ),
  },
  {
    id: "reporting",
    title: "Reporting content and appealing a decision",
    body: (
      <>
        <p>
          Report a post from its menu, and an account from the menu on its
          profile. On the web, comments carry the same menu. In the app, long
          press a direct message to report it. Pick a reason (spam, harassment,
          hate speech, violence, nudity, or other) and add details if they help.
        </p>
        <p>
          Live streams, moments, rooms, events, and Marketplace listings do not
          have a report button yet. Email {CONTACT_EMAIL} with a link and what
          is wrong, and it reaches the same place.
        </p>
        <h3>Account status</h3>
        <p>
          Settings, Account Status is the whole record: whether your account is
          in good standing, every enforcement action against it with the reason
          and date, anything an automated filter flagged, and the reports you
          filed with their current status. Nothing is enforced against you
          silently. That is one of the{" "}
          <Link href="/promises">ten promises</Link>.
        </p>
        <h3>Appeals</h3>
        <p>
          Every action on the list can be appealed once, in up to 2,000
          characters, from the same page. A person reads it. The outcome, upheld
          or reversed, appears next to the action on that page. Orbit does not
          notify you when it changes, so check back. Automated content flags are
          not appealable on their own; if one is wrong, email {CONTACT_EMAIL}.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    title: "Contact and support",
    body: (
      <>
        <p>
          Orbit is small and there is no phone line or live chat. Email reaches
          a person.
        </p>
        <ul>
          <li>
            <strong>{CONTACT_EMAIL}</strong> for anything: bugs, account
            trouble, a report that has no in-app button, rotating a leaked
            stream key, or a moderation question Account Status does not answer.
          </li>
          <li>
            <strong>{PRIVACY_EMAIL}</strong> for privacy questions and requests
            about your personal data. See the{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </li>
          <li>
            <strong>{DMCA_EMAIL}</strong> for copyright notices and
            counter-notices. The postal address for the designated agent is in
            the <Link href="/terms">Terms of Service</Link>.
          </li>
        </ul>
        <p>
          We read everything that arrives. We do not publish a response time,
          because we would rather say nothing than post a number we cannot keep
          to. Appeals and account-access problems go first.
        </p>
        <p>
          Reporting a bug? Tell us what you did, what you expected, and what
          happened instead, and include which build you were on. In the app,
          Settings, Help &amp; About, About has a Copy diagnostics button that
          puts the version, system, and device on your clipboard. There is a
          full write-up on the <Link href="/contact">contact page</Link>.
        </p>
      </>
    ),
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    body: (
      <>
        <h3>Push notifications are not arriving</h3>
        <p>Work down this list, most common first:</p>
        <ul>
          <li>
            The type is switched off in Settings, Notifications. A disabled type
            produces nothing at all, not even an in-app notification.
          </li>
          <li>
            You are inside your quiet hours. The push is withheld; the
            notification is in the app.
          </li>
          <li>
            You already had three ambient pushes this week. Likes, reposts,
            quotes, live starts, event reminders, invites, and moment reactions
            share that weekly cap. Messages, mentions, comments, and new
            followers are not capped.
          </li>
          <li>
            A muted word matched the notification preview, which withholds the
            push.
          </li>
          <li>
            For a missing message notification, check whether that conversation
            is muted.
          </li>
          <li>
            On the web, push is granted per browser. Enable it in Settings,
            Notifications in the browser you are actually using, and check the
            site is not blocked in the browser&apos;s own notification
            permissions.
          </li>
          <li>
            In the app, check that notifications are allowed for Orbit in your
            device settings, and that the device is not in a system focus or
            do-not-disturb mode.
          </li>
        </ul>
        <h3>A video will not play</h3>
        <ul>
          <li>
            Reload the page or reopen the screen first. Most playback failures
            are a dropped connection mid-stream.
          </li>
          <li>
            Clips and post video play straight from storage, so a large file on
            a weak connection can stall at the start. Give it a moment on
            mobile data.
          </li>
          <li>
            Live streams and replays are delivered as adaptive streams. If a
            live stream is buffering, the broadcaster&apos;s upload may be the
            problem rather than your connection. In the app you can cap the
            resolution on the stream screen.
          </li>
          <li>
            If it is still broken, send us the link and your diagnostics from
            Settings, Help &amp; About, About.
          </li>
        </ul>
        <h3>I cannot sign in</h3>
        <ul>
          <li>
            Use Forgot password on the sign-in screen. The reset link arrives by
            email and opens straight into a new password.
          </li>
          <li>
            With two-factor on you need the six-digit code from your
            authenticator app after your password. If you have lost the app, use
            a backup code: it signs you in and switches two-factor off, so set
            it up again immediately.
          </li>
          <li>
            No backup codes and no authenticator is not recoverable by support,
            because Orbit never holds your codes in readable form.
          </li>
          <li>
            Seeing &ldquo;too many requests&rdquo;? Sign-in attempts are rate
            limited per network. Wait a minute and try again.
          </li>
          <li>
            The email on an account cannot be changed yet, so an account is tied
            to the address you signed up with.
          </li>
        </ul>
        <h3>Posts from someone I follow are missing</h3>
        <ul>
          <li>
            Check you are on Following, not For You. Following is the complete,
            in-order one.
          </li>
          <li>
            Check your muted accounts and muted words. Both filter Following as
            well as For You.
          </li>
          <li>
            If you follow a very large number of accounts, Orbit reads the first
            1,000 follows when it builds the feed. Past that, some accounts will
            not appear.
          </li>
          <li>
            They may have gone private, blocked you, or posted to their close
            friends.
          </li>
        </ul>
      </>
    ),
  },
];

export default function HelpPage() {
  return (
    <LegalShell
      eyebrow="Orbit · Help"
      titleLead="How Orbit"
      titleAccent="works"
      intro="Straight answers about the product, written against the code rather than a roadmap. Where something does not exist yet, this page says so instead of implying it does."
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
