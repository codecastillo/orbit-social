import { useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import type { PostMediaItem } from "@/lib/queries/posts";
import { colors, radii, spacing } from "@/lib/theme";

/** Ratio used when a row carries no dimensions, matching the post card. */
const DEFAULT_ASPECT = 4 / 5;

/**
 * The images on a post, swipeable, with a page counter and dots.
 *
 * A post can carry four attachments and always could: they upload, they store
 * with a sort_order, and this client rendered attachment one and silently
 * dropped the rest. The aspect ratio comes from the first image and every page
 * shares it, because a carousel whose height changes per page makes the feed
 * jump under the reader's thumb.
 */
export function MediaCarousel({
  media,
  onPressItem,
  style,
  inset,
}: {
  media: PostMediaItem[];
  /** Receives the index tapped, so the caller can open a viewer there. */
  onPressItem?: (index: number) => void;
  style?: StyleProp<ViewStyle>;
  /** Rounded and indented, for reply cells rather than full-bleed cards. */
  inset?: boolean;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<PostMediaItem>>(null);

  const first = media[0];
  const aspectRatio =
    first?.width && first?.height ? first.width / first.height : DEFAULT_ASPECT;
  // The inset variant sits inside the card's own horizontal padding.
  const pageWidth = inset ? windowWidth - spacing(4) * 2 - spacing(3) : windowWidth;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    if (next !== index) setIndex(next);
  };

  if (media.length === 0) return null;

  return (
    <View style={[styles.wrap, inset && styles.wrapInset, { aspectRatio }, style]}>
      <FlatList
        ref={listRef}
        data={media}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        // Every page is exactly one screen wide, so the list can skip
        // measuring and land on the right page immediately.
        getItemLayout={(_, i) => ({
          length: pageWidth,
          offset: pageWidth * i,
          index: i,
        })}
        renderItem={({ item, index: i }) => (
          <Pressable
            onPress={() => onPressItem?.(i)}
            style={{ width: pageWidth, aspectRatio }}
          >
            <Image
              source={{ uri: item.url }}
              alt={item.alt_text ?? `Image ${i + 1} of ${media.length}`}
              accessibilityLabel={
                item.alt_text ?? `Image ${i + 1} of ${media.length}`
              }
              placeholder={item.blurhash ? { blurhash: item.blurhash } : undefined}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
              recyclingKey={item.url}
            />
          </Pressable>
        )}
      />

      {media.length > 1 ? (
        <>
          <View style={styles.counter} pointerEvents="none">
            <Text style={styles.counterLabel}>
              {index + 1}/{media.length}
            </Text>
          </View>
          <View style={styles.dots} pointerEvents="none">
            {media.map((item, i) => (
              <View
                key={item.id}
                style={[styles.dot, i === index && styles.dotActive]}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    backgroundColor: colors.surface,
  },
  wrapInset: {
    borderRadius: radii.md,
    overflow: "hidden",
  },
  counter: {
    position: "absolute",
    top: spacing(3),
    right: spacing(3),
    paddingHorizontal: spacing(2),
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  counterLabel: {
    color: "#fff",
    fontSize: 11.5,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  dots: {
    position: "absolute",
    bottom: spacing(3),
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing(1.5),
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.45)",
  },
  dotActive: {
    backgroundColor: "#fff",
  },
});
