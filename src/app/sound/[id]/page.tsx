import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SoundContent } from "./sound-content";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: sound } = await supabase
    .from("sounds")
    .select("name, artist")
    .eq("id", id)
    .maybeSingle();

  if (!sound) return { title: "Sound not found" };

  const title = sound.artist ? `${sound.name} · ${sound.artist}` : sound.name;
  const description = `Clips made with ${title} on Orbit.`;

  return {
    title,
    description,
    alternates: { canonical: `/sound/${id}` },
    openGraph: { title, description },
  };
}

export default async function SoundPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: sound } = await supabase
    .from("sounds")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (!sound) notFound();

  return <SoundContent soundId={id} />;
}
