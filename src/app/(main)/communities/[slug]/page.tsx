import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { CommunityContent } from "./community-content";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: community } = await supabase
    .from("communities")
    .select("name, description, cover_url, avatar_url")
    .eq("slug", slug)
    .maybeSingle();

  if (!community) return { title: { absolute: "Not found · Orbit" } };

  const description =
    community.description || `${community.name}, a community on Orbit.`;
  const image = community.cover_url || community.avatar_url;

  return {
    title: community.name,
    description,
    alternates: { canonical: `/communities/${slug}` },
    openGraph: {
      title: community.name,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function CommunityDetailPage({ params }: Props) {
  const { slug } = await params;
  return <CommunityContent slug={slug} />;
}
