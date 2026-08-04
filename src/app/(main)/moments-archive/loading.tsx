import { Skeleton } from "@/components/ui/skeleton";

export default function MomentsArchiveLoading() {
  return (
    <div className="flex flex-col gap-[18px]">
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-10 w-64" />
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[9/16] rounded-xl" />
        ))}
      </div>
    </div>
  );
}
