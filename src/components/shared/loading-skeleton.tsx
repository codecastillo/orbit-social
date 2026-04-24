import { Skeleton } from "@/components/ui/skeleton";

export function PostSkeleton() {
  return (
    <div className="border-b border-white/[0.06]">
      <div className="flex items-center gap-3 px-4 py-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-3.5 w-24" />
      </div>
      <Skeleton className="w-full aspect-square" />
      <div className="flex items-center gap-4 px-4 py-3">
        <Skeleton className="h-6 w-6 rounded" />
        <Skeleton className="h-6 w-6 rounded" />
        <Skeleton className="h-6 w-6 rounded" />
      </div>
      <div className="px-4 pb-4 space-y-2">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-48 w-full" />
      <div className="px-4 space-y-3">
        <div className="flex justify-between items-start -mt-12">
          <Skeleton className="h-24 w-24 rounded-full border-4 border-background" />
          <Skeleton className="h-9 w-24 rounded-full mt-14" />
        </div>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-full" />
        <div className="flex gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  );
}

export function FeedSkeleton() {
  return (
    <div>
      {Array.from({ length: 3 }).map((_, i) => (
        <PostSkeleton key={i} />
      ))}
    </div>
  );
}
