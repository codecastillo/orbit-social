import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PostDetail } from "./post-detail";

interface Props {
  params: Promise<{ postId: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { postId } = await params;
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("posts")
    .select("content, profiles!posts_user_id_fkey(display_name, username)")
    .eq("id", postId)
    .single();

  if (!post) return { title: "Post not found" };

  const profile = post.profiles as unknown as { display_name: string; username: string };
  const preview = post.content?.slice(0, 100) || "Post";
  const title = `${profile.display_name}: "${preview}"`;
  const description = `@${profile.username}: ${post.content || ""}`;

  return {
    title,
    description,
    alternates: { canonical: `/post/${postId}` },
    openGraph: { title, description },
  };
}

export default async function PostPage({ params }: Props) {
  const { postId } = await params;
  const supabase = await createClient();

  // Verify the post exists
  const { data: post } = await supabase
    .from("posts")
    .select("id")
    .eq("id", postId)
    .single();

  if (!post) notFound();

  return <PostDetail postId={postId} />;
}
