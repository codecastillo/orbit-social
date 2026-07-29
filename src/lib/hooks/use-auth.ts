"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/providers/auth-provider";

export function useAuth() {
  const { user, loading, emailConfirmed } = useAuthContext();
  const router = useRouter();

  const signOut = async () => {
    await createClient().auth.signOut();
    router.push("/login");
  };

  const resendConfirmation = async () => {
    if (!user?.email) return;
    const { error } = await createClient().auth.resend({
      type: "signup",
      email: user.email,
    });
    return { error };
  };

  return { user, loading, emailConfirmed, signOut, resendConfirmation };
}
