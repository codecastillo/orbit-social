export const APP_NAME = "Orbit";

export const NAV_ITEMS = [
  { label: "Home", href: "/feed", icon: "Home" },
  { label: "Explore", href: "/explore", icon: "Compass" },
  { label: "Clips", href: "/reels", icon: "Clapperboard" },
  { label: "Messages", href: "/messages", icon: "MessageCircle" },
  { label: "Notifications", href: "/notifications", icon: "Bell" },
  { label: "Events", href: "/events", icon: "Calendar" },
] as const;

export const MOBILE_NAV_ITEMS = [
  { label: "Home", href: "/feed", icon: "Home" },
  { label: "Explore", href: "/explore", icon: "Compass" },
  { label: "Create", href: "#compose", icon: "PlusSquare" },
  { label: "Clips", href: "/reels", icon: "Clapperboard" },
  { label: "Profile", href: "/profile", icon: "User" },
] as const;

export const MAX_POST_LENGTH = 500;
export const MAX_BIO_LENGTH = 160;
export const MAX_USERNAME_LENGTH = 30;
export const MAX_DISPLAY_NAME_LENGTH = 50;
export const FEED_PAGE_SIZE = 20;
export const MESSAGES_PAGE_SIZE = 50;

export const STORAGE_BUCKETS = {
  AVATARS: "avatars",
  COVERS: "covers",
  POST_MEDIA: "post-media",
  STORY_MEDIA: "story-media",
  MESSAGE_MEDIA: "message-media",
  LISTING_IMAGES: "listing-images",
} as const;
