import { Skeleton } from "@/components/ui/skeleton";

export default function FeedLoading() {
  return (
    <div className="grid gap-[18px] w-full grid-cols-1 md:grid-cols-[minmax(0,1fr)_320px]">
      <main className="flex flex-col gap-4 min-w-0 w-full max-w-[640px] mx-auto">
        <div className="h-[50px] rounded-2xl border border-border bg-surface" />
        <div className="h-[124px] rounded-2xl border border-border bg-surface" />
        <div className="space-y-0">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-5 space-y-3">
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
          ))}
        </div>
      </main>
    </div>
  );
}
