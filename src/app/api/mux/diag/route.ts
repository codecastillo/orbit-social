export async function GET() {
  return Response.json({
    has_token_id: !!process.env.MUX_TOKEN_ID,
    has_token_secret: !!process.env.MUX_TOKEN_SECRET,
    has_webhook_secret: !!process.env.MUX_WEBHOOK_SECRET,
    has_env_key_public: !!process.env.NEXT_PUBLIC_MUX_ENV_KEY,
    token_id_prefix: process.env.MUX_TOKEN_ID?.substring(0, 8) ?? null,
  });
}
