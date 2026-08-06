-- Dead schema, removed after checking each claim against the code rather
-- than trusting the audit that listed them.
--
-- email_outbox was declared as "a durable queue for emails sent by cron
-- jobs" and nothing ever wrote to it: the digest route sends directly. Zero
-- references in either client and no SQL function touches it.
--
-- conversations.is_encrypted has never been read or written. End-to-end
-- encryption was never built, and a column named for it is worse than
-- nothing, because it invites someone to believe messages are encrypted.
-- Removing it is the honest state of the product.
--
-- NOT removed, contrary to the audit that flagged them: profiles.last_seen_at
-- and touch_last_seen are live. The presence heartbeat writes the column and
-- presenceOf reads it, seven and eight references across the two clients.
-- The audit's claim that presence had moved entirely to Realtime channels was
-- wrong, and dropping either would have taken the green dot with it.

DROP TABLE IF EXISTS public.email_outbox;

ALTER TABLE public.conversations DROP COLUMN IF EXISTS is_encrypted;
