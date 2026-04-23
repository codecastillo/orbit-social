"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Flag,
  Users,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";

const adminLinks = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/reports", label: "Reports", icon: Flag },
  { href: "/admin/users", label: "Users", icon: Users },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkAdmin() {
      if (!user) {
        setIsAdmin(false);
        return;
      }
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      setIsAdmin(data?.is_admin ?? false);
    }

    if (!authLoading) {
      checkAdmin();
    }
  }, [user, authLoading]);

  // Loading state
  if (authLoading || isAdmin === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Access denied
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          You don&apos;t have permission to access the admin panel. Contact an
          administrator if you believe this is an error.
        </p>
        <Link
          href="/"
          className="mt-2 text-sm font-medium text-primary hover:underline"
        >
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[220px] flex-col border-r border-foreground/10 bg-card/50 backdrop-blur-sm lg:flex">
        <div className="flex h-14 items-center gap-2 px-5">
          <ShieldAlert className="h-5 w-5 text-primary" />
          <span className="text-sm font-bold tracking-tight">
            Orbit Admin
          </span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {adminLinks.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/admin" && pathname.startsWith(link.href));

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile header */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-12 items-center justify-between border-b border-foreground/10 bg-card/80 px-4 backdrop-blur-sm lg:hidden">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold">Admin</span>
        </div>
        <div className="flex items-center gap-1">
          {adminLinks.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/admin" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-lg p-2 transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <link.icon className="h-4 w-4" />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 pt-12 lg:ml-[220px] lg:pt-0">
        <div className="mx-auto max-w-5xl p-4 lg:p-6">{children}</div>
      </main>
    </div>
  );
}
