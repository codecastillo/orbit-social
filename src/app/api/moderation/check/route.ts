import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 15;

const requestSchema = z.object({
  text: z.string().min(1).max(10000),
});

const moderationSchema = z.object({
  flagged: z.boolean(),
  severity: z.enum(["low", "medium", "high"]),
  reason: z.string().max(200),
  categories: z.array(
    z.enum([
      "hate",
      "harassment",
      "violence",
      "self_harm",
      "sexual",
      "spam",
      "evasion",
      "none",
    ])
  ),
});

const SYSTEM_PROMPT = `You are a content moderator for a social network called Orbit. Classify the user's post.

Severity rubric:
- high: explicit slurs, credible threats of violence, doxxing, sexual content involving minors, or coordinated harassment
- medium: profanity used aggressively, harassment without explicit threat, evasion attempts (leetspeak slurs, coded hate), spam patterns
- low: mild profanity in self-expression, edgy but not targeted, single-incident spam markers
- not flagged: normal speech, criticism, sarcasm, opinions, jokes that don't punch down

Be conservative — only flag what genuinely violates community standards. Free expression, dark humor, criticism of public figures, and political opinions are NOT flagged on their own. Look for INTENT to harm, harass, or game the system.

If the content is clean, set flagged=false, severity=low, reason="clean", categories=["none"].`;

export async function POST(req: Request) {
  // Require an authenticated user — moderation API is not anonymous.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  // If the AI Gateway is not configured, return a no-op result so callers
  // gracefully fall back to their regex-only check.
  if (!process.env.AI_GATEWAY_API_KEY) {
    return NextResponse.json({
      flagged: false,
      severity: "low",
      reason: "ai_gateway_disabled",
      categories: ["none"],
    });
  }

  // Hard timeout: don't let a hung LLM stall the post submit. If we don't
  // hear back in 5s, fail open (treat as clean) so the user can post.
  const TIMEOUT_MS = 5_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const { object } = await generateObject({
      model: "anthropic/claude-haiku-4-5",
      schema: moderationSchema,
      system: SYSTEM_PROMPT,
      prompt: body.text,
      temperature: 0,
      abortSignal: controller.signal,
    });
    clearTimeout(timer);
    return NextResponse.json(object);
  } catch (err) {
    clearTimeout(timer);
    const isAbort =
      err instanceof Error &&
      (err.name === "AbortError" || /aborted|timeout/i.test(err.message));
    if (!isAbort) console.error("moderation LLM error:", err);
    // Fail open: a slow/failed LLM shouldn't block legitimate posts.
    return NextResponse.json({
      flagged: false,
      severity: "low",
      reason: isAbort ? "timeout" : "llm_error",
      categories: ["none"],
    });
  }
}
