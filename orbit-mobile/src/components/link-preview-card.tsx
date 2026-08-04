import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { getLinkPreview } from "@/lib/queries/link-previews";
import { colors, radii, spacing } from "@/lib/theme";

// Server-side cache is fresh for 7 days; a day on the client avoids
// refetching the same link while someone scrolls a feed.
const PREVIEW_STALE_TIME_MS = 24 * 60 * 60 * 1000;

/**
 * Compact card for the first URL in a post or DM: thumbnail, site name,
 * title, description; tapping opens the link. Renders nothing until the
 * preview resolves and nothing at all when it can't, by design.
 */
export function LinkPreviewCard({
  url,
  // Fired just before the link leaves the app, for callers that record the
  // click as a ranking signal.
  onOpen,
}: {
  url: string;
  onOpen?: () => void;
}) {
  const { data } = useQuery({
    queryKey: ["link-preview", url],
    queryFn: () => getLinkPreview(url),
    staleTime: PREVIEW_STALE_TIME_MS,
    retry: false,
  });

  if (!data || (!data.title && !data.description && !data.image_url)) return null;

  let hostname: string;
  try {
    hostname = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    hostname = url;
  }

  return (
    <Pressable
      onPress={() => {
        onOpen?.();
        Linking.openURL(url).catch(() => {});
      }}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
    >
      {data.image_url ? (
        <Image
          source={{ uri: data.image_url }}
          alt=""
          style={styles.thumb}
          contentFit="cover"
          transition={150}
        />
      ) : null}
      <View style={styles.body}>
        <Text style={styles.site} numberOfLines={1}>
          {data.site_name ?? hostname}
        </Text>
        {data.title ? (
          <Text style={styles.title} numberOfLines={2}>
            {data.title}
          </Text>
        ) : null}
        {data.description ? (
          <Text style={styles.description} numberOfLines={1}>
            {data.description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  thumb: {
    width: 76,
    height: 76,
    backgroundColor: colors.surfaceElevated,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
  },
  site: {
    color: colors.mutedForeground,
    fontSize: 10.5,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  title: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 17,
    marginTop: 2,
  },
  description: {
    color: colors.mutedForeground,
    fontSize: 12,
    marginTop: 2,
  },
});
