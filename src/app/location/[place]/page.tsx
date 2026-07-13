import { LocationContent } from "./location-content";

interface Props {
  params: Promise<{ place: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { place } = await params;
  const decodedPlace = decodeURIComponent(place);

  return {
    title: decodedPlace,
    description: `Posts from ${decodedPlace} on Orbit.`,
  };
}

export default async function LocationPage({ params }: Props) {
  const { place } = await params;
  return <LocationContent place={decodeURIComponent(place)} />;
}
