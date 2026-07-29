import { Skeleton } from "@/components/ui/skeleton";

export default function ClipsLoading() {
  return (
    <div className="fixed top-14 bottom-24 left-0 right-0 lg:left-[296px] lg:right-6 lg:top-6 lg:bottom-6 z-20 overflow-hidden rounded-2xl bg-surface-elevated">
      <Skeleton className="h-full w-full rounded-none" />
    </div>
  );
}
