import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { StreamContent } from "./stream-content";

interface Props {
  params: Promise<{ streamId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { streamId } = await params;
  const supabase = await createClient();

  const { data: stream } = await supabase
    .from("live_streams")
    .select("title, profiles!live_streams_user_id_fkey(display_name, username)")
    .eq("id", streamId)
    .maybeSingle();

  if (!stream) return { title: { absolute: "Not found · Orbit" } };

  const host = stream.profiles as unknown as {
    display_name: string;
    username: string;
  } | null;
  const title = stream.title || `${host?.display_name ?? "Live"} is live`;
  const description = host
    ? `${host.display_name} (@${host.username}) is live on Orbit.`
    : "Live on Orbit.";

  return {
    title,
    description,
    alternates: { canonical: `/live/${streamId}` },
    openGraph: { title, description },
  };
}

export default async function LiveViewerPage({ params }: Props) {
  const { streamId } = await params;
  return <StreamContent streamId={streamId} />;
}
