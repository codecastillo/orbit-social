import { LocationContent } from "./location-content";

interface Props {
  params: Promise<{ place: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { place } = await params;
  const decodedPlace = decodeURIComponent(place);
  const description = `Posts from ${decodedPlace} on Orbit.`;

  return {
    title: decodedPlace,
    description,
    alternates: { canonical: `/location/${encodeURIComponent(decodedPlace)}` },
    openGraph: { title: decodedPlace, description },
  };
}

export default async function LocationPage({ params }: Props) {
  const { place } = await params;
  return <LocationContent place={decodeURIComponent(place)} />;
}
