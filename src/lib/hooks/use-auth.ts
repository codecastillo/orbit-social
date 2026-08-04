"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { clearAccountScope } from "@/lib/query-persist";
import { useAuthContext } from "@/providers/auth-provider";

export function useAuth() {
  const { user, loading, emailConfirmed } = useAuthContext();
  const queryClient = useQueryClient();
  const router = useRouter();

  const signOut = async () => {
    await createClient().auth.signOut();
    // AuthProvider clears on the SIGNED_OUT event too, but that arrives
    // asynchronously: clearing here means the login screen never renders
    // over the outgoing account's cache.
    clearAccountScope(queryClient);
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
