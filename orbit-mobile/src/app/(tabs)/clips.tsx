import { ClipsFeed } from "@/components/clips-feed";

// Hidden from the tab bar (Clips lives as a Home lane now); the route stays
// so /(tabs)/clips deep links and the camera/upload redirects keep working.
export default function ClipsScreen() {
  return <ClipsFeed isActive />;
}
