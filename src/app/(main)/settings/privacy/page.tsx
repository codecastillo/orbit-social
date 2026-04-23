"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function PrivacySettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [isPrivate, setIsPrivate] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;

    supabase
      .from("profiles")
      .select("is_private")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setIsPrivate(data.is_private ?? false);
        setProfileLoading(false);
      });
  }, [user, supabase]);

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        is_private: isPrivate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      toast.error("Failed to update privacy settings");
    } else {
      toast.success("Privacy settings updated");
    }
    setSaving(false);
  };

  if (authLoading || profileLoading) {
    return (
      <div className="border-x border-border min-h-screen">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="p-6 space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="border-x border-border min-h-screen">
      <div className="p-4 border-b border-border flex items-center gap-3">
        <Link href="/settings" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h2 className="text-lg font-semibold">Privacy</h2>
      </div>

      <div className="p-4 space-y-4">
        {/* Private Account Toggle */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                <Lock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Private Account</p>
                <p className="text-sm text-muted-foreground">
                  Only approved followers can see your posts
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isPrivate}
              onClick={() => setIsPrivate(!isPrivate)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                isPrivate ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                  isPrivate ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Explanation */}
        <div className="glass rounded-xl p-4 space-y-3">
          <h3 className="font-medium text-sm">What does private mean?</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-muted-foreground mt-1.5 h-1 w-1 rounded-full bg-muted-foreground shrink-0 inline-block" />
              Only people you approve can follow you and see your posts
            </li>
            <li className="flex items-start gap-2">
              <span className="text-muted-foreground mt-1.5 h-1 w-1 rounded-full bg-muted-foreground shrink-0 inline-block" />
              Your posts will not appear in public feeds or search results
            </li>
            <li className="flex items-start gap-2">
              <span className="text-muted-foreground mt-1.5 h-1 w-1 rounded-full bg-muted-foreground shrink-0 inline-block" />
              People who already follow you will not be affected
            </li>
            <li className="flex items-start gap-2">
              <span className="text-muted-foreground mt-1.5 h-1 w-1 rounded-full bg-muted-foreground shrink-0 inline-block" />
              Your profile info (name, bio, avatar) remains visible to everyone
            </li>
          </ul>
        </div>

        <Button
          onClick={handleSave}
          className="w-full"
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Save Changes"
          )}
        </Button>
      </div>
    </div>
  );
}
