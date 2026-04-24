"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Loader2, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const supabase = createClient();

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });
    setResending(false);
    if (error) {
      toast.error("Failed to resend. Try again later.");
    } else {
      setResent(true);
      toast.success("Verification email sent!");
      setTimeout(() => setResent(false), 30000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden page-gradient">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md text-center space-y-6"
      >
        {/* Icon */}
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="h-10 w-10 text-primary" />
          </div>
        </div>

        {/* Heading */}
        <div>
          <h1
            className="text-2xl font-extrabold tracking-tight"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            Check your email
          </h1>
          <p className="text-muted-foreground mt-3 text-[15px] leading-relaxed">
            We sent a verification link to
            <br />
            <span className="text-foreground font-semibold">{email}</span>
          </p>
        </div>

        {/* Instructions */}
        <div className="card-elevated p-6 text-left space-y-3">
          <div className="flex items-start gap-3">
            <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-primary">1</span>
            </div>
            <p className="text-sm text-muted-foreground">Open your email inbox</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-primary">2</span>
            </div>
            <p className="text-sm text-muted-foreground">Click the verification link in the email from Orbit</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-primary">3</span>
            </div>
            <p className="text-sm text-muted-foreground">You'll be redirected to your feed automatically</p>
          </div>
        </div>

        {/* Resend */}
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground/60">
            Didn't receive the email? Check your spam folder or
          </p>
          <Button
            variant="outline"
            className="rounded-xl h-10 px-6 font-semibold cursor-pointer"
            onClick={handleResend}
            disabled={resending || resent}
          >
            {resending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : resent ? (
              <CheckCircle className="h-4 w-4 mr-2 text-emerald-400" />
            ) : (
              <Mail className="h-4 w-4 mr-2" />
            )}
            {resent ? "Email sent!" : "Resend verification email"}
          </Button>
        </div>

        {/* Back to login */}
        <p className="text-sm text-muted-foreground/50">
          Wrong email?{" "}
          <Link href="/signup" className="text-primary hover:underline font-medium">
            Sign up again
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
