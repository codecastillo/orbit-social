"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";
import { getClipById } from "@/lib/queries/clips";
import { checkUserInteractions } from "@/lib/queries/posts";
import { ClipPlayer } from "@/components/clips/clip-player";

interface Props {
  params: Promise<{ clipId: string }>;
}

export default function ClipPage({ params }: Props) {
  const { clipId } = use(params);
  const router = useRouter();
  const { user } = useAuth();

  const {
    data: clip,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["clip", clipId, user?.id],
    queryFn: async () => {
      const clip = await getClipById(clipId);
      if (!user) return clip;

      const { likedPostIds, bookmarkedPostIds } = await checkUserInteractions(
        user.id,
        [clip.id]
      );
      return {
        ...clip,
        user_has_liked: likedPostIds.has(clip.id),
        user_has_bookmarked: bookmarkedPostIds.has(clip.id),
      };
    },
    retry: false,
    staleTime: 30_000,
  });

  return (
    <div className="fixed top-14 bottom-24 left-0 right-0 lg:left-[296px] lg:right-6 lg:top-6 lg:bottom-6 z-20 overflow-hidden rounded-2xl bg-black">
      <button
        onClick={() => router.back()}
        aria-label="Back"
        className="absolute top-4 left-4 z-30 grid h-[38px] w-[38px] place-items-center rounded-full border border-white/15 bg-black/60 text-white"
      >
        <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} />
      </button>

      {isLoading ? (
        <div className="h-full w-full flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-white/60" />
        </div>
      ) : isError || !clip ? (
        <div className="h-full w-full flex items-center justify-center px-6">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-7 py-6 text-center">
            <p className="text-sm font-semibold text-white">Clip not found</p>
            <p className="mt-1 text-[13px] text-white/60">
              It may have been deleted by its creator.
            </p>
          </div>
        </div>
      ) : (
        <div className="h-full w-full">
          <ClipPlayer clip={clip} />
        </div>
      )}
    </div>
  );
}
