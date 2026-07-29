import { HashtagContent } from "./hashtag-content";

interface Props {
  params: Promise<{ tag: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { tag } = await params;
  const decodedTag = decodeURIComponent(tag);
  const title = `#${decodedTag}`;
  const description = `Posts tagged #${decodedTag} on Orbit.`;

  return {
    title,
    description,
    alternates: { canonical: `/hashtag/${encodeURIComponent(decodedTag)}` },
    openGraph: { title, description },
  };
}

export default async function HashtagPage({ params }: Props) {
  const { tag } = await params;
  return <HashtagContent tag={decodeURIComponent(tag)} />;
}
