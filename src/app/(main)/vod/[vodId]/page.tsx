import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { VodContent } from "./vod-content";

interface Props {
  params: Promise<{ vodId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { vodId } = await params;
  const supabase = await createClient();

  const { data: vod } = await supabase
    .from("live_vods")
    .select("title")
    .eq("id", vodId)
    .maybeSingle();

  if (!vod) return { title: { absolute: "Not found · Orbit" } };

  const title = vod.title || "Stream replay";
  const description = "Watch this stream replay on Orbit.";

  return {
    title,
    description,
    alternates: { canonical: `/vod/${vodId}` },
    openGraph: { title, description },
  };
}

export default async function VodPage({ params }: Props) {
  const { vodId } = await params;
  return <VodContent vodId={vodId} />;
}
