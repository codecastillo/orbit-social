import { HashtagContent } from "./hashtag-content";

interface Props {
  params: Promise<{ tag: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { tag } = await params;
  const decodedTag = decodeURIComponent(tag);

  return {
    title: `#${decodedTag}`,
    description: `Posts tagged #${decodedTag} on Orbit.`,
  };
}

export default async function HashtagPage({ params }: Props) {
  const { tag } = await params;
  return <HashtagContent tag={decodeURIComponent(tag)} />;
}
