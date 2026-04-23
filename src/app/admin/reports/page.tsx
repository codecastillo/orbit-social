"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Flag } from "lucide-react";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ReportItem } from "@/components/admin/report-item";
import { getReports, updateReportStatus } from "@/lib/queries/admin";
import { useAuth } from "@/lib/hooks/use-auth";

const STATUS_TABS = [
  { value: "pending", label: "Pending" },
  { value: "reviewed", label: "Reviewed" },
  { value: "actioned", label: "Actioned" },
  { value: "dismissed", label: "Dismissed" },
] as const;

export default function AdminReportsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("pending");

  const { data: reports, isLoading } = useQuery({
    queryKey: ["admin-reports", activeTab],
    queryFn: () => getReports(activeTab),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      reportId,
      status,
      actionTaken,
    }: {
      reportId: string;
      status: "reviewed" | "actioned" | "dismissed";
      actionTaken?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      return updateReportStatus(reportId, status, user.id, actionTaken);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });

  const handleUpdateStatus = (
    reportId: string,
    status: "reviewed" | "actioned" | "dismissed",
    actionTaken?: string
  ) => {
    updateMutation.mutate({ reportId, status, actionTaken });
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review and manage user reports
        </p>
      </div>

      <Tabs
        defaultValue="pending"
        onValueChange={(val) => setActiveTab(val as string)}
      >
        <TabsList variant="line" className="mb-4">
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {STATUS_TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-[72px] rounded-xl" />
                ))}
              </div>
            ) : reports && reports.length > 0 ? (
              <div className="space-y-3">
                {reports.map((report) => (
                  <ReportItem
                    key={report.id}
                    report={report}
                    onUpdateStatus={handleUpdateStatus}
                    isUpdating={updateMutation.isPending}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Flag}
                title={`No ${tab.label.toLowerCase()} reports`}
                description={
                  tab.value === "pending"
                    ? "All caught up! No reports waiting for review."
                    : `No reports with status "${tab.label.toLowerCase()}" found.`
                }
              />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
