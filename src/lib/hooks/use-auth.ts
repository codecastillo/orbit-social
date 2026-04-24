"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailConfirmed, setEmailConfirmed] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      // Try getUser first (works for confirmed users)
      const { data: { user: confirmedUser } } = await supabase.auth.getUser();

      if (confirmedUser) {
        setUser(confirmedUser);
        setEmailConfirmed(!!confirmedUser.email_confirmed_at);
        setLoading(false);
        return;
      }

      // Fall back to session (works for unconfirmed users too)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        setEmailConfirmed(!!session.user.email_confirmed_at);
      }
      setLoading(false);
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      setEmailConfirmed(!!sessionUser?.email_confirmed_at);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const resendConfirmation = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: user.email,
    });
    return { error };
  };

  return { user, loading, emailConfirmed, signOut, resendConfirmation };
}
