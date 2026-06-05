import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 15;

const requestSchema = z.object({
  imageDataUrl: z.string().min(1),
  isVideo: z.boolean().optional().default(false),
});

const responseSchema = z.object({
  captions: z.array(z.string().min(1).max(140)).length(3),
});

const SYSTEM = `You are a creative caption writer for a Gen-Z social network called Orbit.

Given a photo (or first frame of a short video), produce three short, punchy caption suggestions, each under 12 words.

Rules:
- Be specific to what's actually in the image. Reference what you see: the subject, setting, mood, an object, a vibe.
- No generic filler ("living my best life", "main character energy", "no thoughts just vibes" are all banned).
- Mix tones across the three: one observational/dry, one playful/funny, one a little vulnerable or intimate.
- Casual lowercase is fine, occasional punctuation is fine. No hashtags. No emoji unless one feels right.
- Captions should sound like a 22-year-old wrote them, not a brand.`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!process.env.AI_GATEWAY_API_KEY) {
    return NextResponse.json({ error: "ai_disabled" }, { status: 503 });
  }

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const match = body.imageDataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) {
    return NextResponse.json({ error: "invalid_image" }, { status: 400 });
  }
  const mediaType = match[1];
  const base64 = match[2];

  // Hard timeout: captions are a nice-to-have. If the LLM hangs we don't
  // want the composer's "suggest" button spinning for the full 15s
  // maxDuration. Bail out at 8s and return empty.
  const TIMEOUT_MS = 8_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const { object } = await generateObject({
      model: "anthropic/claude-haiku-4-5",
      schema: responseSchema,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              image: base64,
              mediaType,
            },
            {
              type: "text",
              text: body.isVideo
                ? "This is the first frame of a short vertical clip. Suggest 3 captions that fit the content."
                : "Suggest 3 captions for this image.",
            },
          ],
        },
      ],
      temperature: 0.8,
      abortSignal: controller.signal,
    });
    clearTimeout(timer);
    return NextResponse.json(object);
  } catch (err) {
    clearTimeout(timer);
    const isAbort =
      err instanceof Error &&
      (err.name === "AbortError" || /aborted|timeout/i.test(err.message));
    if (isAbort) {
      // The caller (caption-suggestions.ts) throws on any non-2xx response
      // and falls back to its local heuristic, which is the desired UX
      // when the LLM is too slow.
      return NextResponse.json({ error: "timeout" }, { status: 504 });
    }
    console.error("caption LLM error:", err);
    return NextResponse.json({ error: "llm_error" }, { status: 500 });
  }
}
