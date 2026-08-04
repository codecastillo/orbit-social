import { Skeleton } from "@/components/ui/skeleton";

export default function ExploreLoading() {
  return (
    <div className="flex flex-col gap-[18px]">
      <Skeleton className="h-11 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-border bg-surface p-4">
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
