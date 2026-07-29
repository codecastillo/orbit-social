"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  loading: boolean;
  emailConfirmed: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * One auth subscription for the whole tree. Every useAuth() consumer used to
 * run its own supabase.auth.getUser() network round trip per mount (a 20-post
 * feed fired ~40 of them, serialized behind the auth-token lock), which was
 * the single largest cause of slow page loads.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    emailConfirmed: true,
  });

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    // supabase-js takes the auth-token lock with steal:true so cross-tab
    // races can throw AbortError("Lock broken ..."). Treat that as "no
    // session this turn"; onAuthStateChange fires again with a real value
    // once the new owner completes its read.
    const isLockSteal = (err: unknown) =>
      err instanceof Error &&
      /Lock\s+(broken|"lock:sb-).*steal/i.test(err.message);

    const load = async () => {
      try {
        // Local cookie read first for an instant answer (unblocks every
        // `enabled: !!user` query), then the server-verified user.
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!cancelled && session?.user) {
          setState({
            user: session.user,
            loading: false,
            emailConfirmed: !!session.user.email_confirmed_at,
          });
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!cancelled) {
          setState({
            user,
            loading: false,
            emailConfirmed: user ? !!user.email_confirmed_at : true,
          });
        }
      } catch (err) {
        if (isLockSteal(err)) {
          if (!cancelled) setState((s) => ({ ...s, loading: false }));
          return;
        }
        throw err;
      }
    };
    load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null;
      setState({
        user: sessionUser,
        loading: false,
        emailConfirmed: sessionUser ? !!sessionUser.email_confirmed_at : true,
      });
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
