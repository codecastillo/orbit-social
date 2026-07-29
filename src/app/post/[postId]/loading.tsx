import { Skeleton } from "@/components/ui/skeleton";

export default function PostLoading() {
  return (
    <div className="border-x border-border min-h-screen">
      <div className="flex items-center gap-4 h-12 px-4 border-b border-border">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-4 w-12" />
      </div>
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-56 w-full rounded-xl" />
        <div className="flex gap-6">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-12" />
        </div>
      </div>
      <div className="flex items-center gap-3 border-t border-border p-4">
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="h-9 flex-1 rounded-full" />
      </div>
    </div>
  );
}
