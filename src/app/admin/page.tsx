"use client";

import { useQuery } from "@tanstack/react-query";
import { Users, FileText, Flag, UserPlus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatsCard } from "@/components/admin/stats-card";
import { getAdminStats } from "@/lib/queries/admin";

export default function AdminDashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: getAdminStats,
    refetchInterval: 30000,
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of your platform
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[100px] rounded-xl" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            icon={Users}
            value={stats.totalUsers.toLocaleString()}
            label="Total Users"
          />
          <StatsCard
            icon={FileText}
            value={stats.totalPosts.toLocaleString()}
            label="Total Posts"
          />
          <StatsCard
            icon={Flag}
            value={stats.pendingReports.toLocaleString()}
            label="Pending Reports"
          />
          <StatsCard
            icon={UserPlus}
            value={stats.newUsersToday.toLocaleString()}
            label="New Users Today"
          />
        </div>
      ) : null}
    </div>
  );
}
