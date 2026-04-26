"use client";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export interface TurnstileWidgetHandle {
  /** Returns the current token, waiting for one if the widget hasn't solved yet. */
  getToken: () => Promise<string | null>;
  /** Force a fresh challenge — call after a submit so the next call gets a new token. */
  reset: () => void;
}

/**
 * Invisible Cloudflare Turnstile widget. Mounted near auth form submit buttons.
 * If NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set (e.g. local dev with CAPTCHA off),
 * getToken() resolves to null — callers should treat null as "skip captcha" so
 * dev still works without the env var.
 */
export const TurnstileWidget = forwardRef<TurnstileWidgetHandle>(function TurnstileWidget(
  _props,
  ref
) {
  const innerRef = useRef<TurnstileInstance | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const tokenResolversRef = useRef<((t: string) => void)[]>([]);

  useImperativeHandle(
    ref,
    () => ({
      getToken: () => {
        if (!SITE_KEY) return Promise.resolve(null);
        if (token) return Promise.resolve(token);
        return new Promise<string | null>((resolve) => {
          tokenResolversRef.current.push(resolve);
        });
      },
      reset: () => {
        setToken(null);
        innerRef.current?.reset();
      },
    }),
    [token]
  );

  if (!SITE_KEY) return null;

  return (
    <Turnstile
      ref={innerRef}
      siteKey={SITE_KEY}
      options={{ size: "invisible", appearance: "interaction-only" }}
      onSuccess={(t) => {
        setToken(t);
        const resolvers = tokenResolversRef.current;
        tokenResolversRef.current = [];
        resolvers.forEach((r) => r(t));
      }}
      onExpire={() => setToken(null)}
      onError={() => setToken(null)}
    />
  );
});
