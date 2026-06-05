# 1. Anonymous read-only browse via a middleware deny-list

Status: Accepted

## Context

Orbit lets signed-out visitors browse most of the product (feed, clips, profiles,
rooms, events, livestreams, post detail, hashtags, VODs) so the app is indexable
and shareable. A small set of routes is inherently personal and requires auth:
`/notifications`, `/messages`, `/bookmarks`, `/drafts`, `/scheduled`, `/settings`,
`/onboarding`.

Two enforcement points exist:

- Server-side, `middleware.ts` runs `updateSession` (`src/lib/supabase/middleware.ts`)
  on every non-asset, non-`/api` request. It resolves the Supabase session and
  decides redirects.
- Client-side, write actions (like, follow, repost, comment, post) call the
  `useRequireAuth` hook (`src/lib/hooks/use-require-auth.ts`). The hook returns a
  guard function that redirects unsigned users to `/signup?next=<current-url>` and
  returns `false`, halting the mutation.

The middleware needs a rule for which routes are gated. The choice is between a
deny-list (enumerate the auth-required routes, everything else is public) and an
allow-list (enumerate the public routes, everything else is gated).

## Decision

Use a deny-list. `authRequiredRoutes` in `src/lib/supabase/middleware.ts` holds
the seven auth-required prefixes. An unsigned request matching one is redirected
to `/login?next=<pathname>` to preserve the deep link. Every other path is served
read-only.

Client-side, `useRequireAuth` blocks mutations for unsigned users, redirecting to
`/signup?next=...` to restore context after signup. The middleware also handles
the inverse: a signed-in user on `/login`, `/signup`, or `/` is pushed to `/feed`.

The deny-list fits the product: the public surface is large and grows often (new
feed types, profile sub-pages, content detail routes), while the gated surface is
small and stable. An allow-list would require a middleware change for most new
public pages and would silently gate them until someone allowed them.

## Consequences

- New public routes work for unsigned visitors without middleware changes.
- The deny-list fails open. A new private route renders publicly until added to
  `authRequiredRoutes`. Supabase Row Level Security still gates the data, but the
  route itself is reachable, potentially exposing UI meant for signed-in users.
  Add any new private route to the list in the same change.
- Matching is prefix-based (`pathname.startsWith(route)`), so a route like
  `/messages/123` is covered by the `/messages` entry. The flip side is that any
  public path sharing a listed prefix would be gated too, so prefixes must stay
  specific.
- Server gating and client gating can drift. The middleware gates page access,
  `useRequireAuth` gates mutations. A public page must guard every write with the
  hook; the middleware does not block an unsigned user from calling a write endpoint.
- Session resolution runs on every matched request. `updateSession` calls
  `getSession`, falls back to `getUser`, and refreshes Supabase auth cookies, so
  the middleware is on the critical path for all page traffic.
