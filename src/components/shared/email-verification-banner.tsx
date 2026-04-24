"use client";

import { useState } from "react";
import { Mail, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/hooks/use-auth";

export function EmailVerificationBanner() {
  const { user, emailConfirmed, resendConfirmation } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [resending, setResending] = useState(false);

  if (!user || emailConfirmed || dismissed) return null;

  const handleResend = async () => {
    setResending(true);
    const result = await resendConfirmation();
    setResending(false);

    if (result?.error) {
      toast.error("Failed to resend. Try again later.");
    } else {
      toast.success("Verification email sent!");
    }
  };

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20 backdrop-blur-xl">
      <div className="flex items-center gap-2.5 min-w-0">
        <Mail className="h-4 w-4 text-amber-400 shrink-0" />
        <p className="text-sm text-amber-200 truncate">
          Verify your email <span className="text-amber-400 font-medium">{user.email}</span> to secure your account.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleResend}
          disabled={resending}
          className="text-xs font-semibold text-amber-400 hover:text-amber-300 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 transition-colors cursor-pointer"
        >
          {resending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Resend"}
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded-lg hover:bg-amber-500/10 text-amber-400/60 hover:text-amber-400 transition-colors cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
