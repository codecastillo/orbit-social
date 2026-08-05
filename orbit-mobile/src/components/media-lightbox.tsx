import { useRef, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PostMediaItem } from "@/lib/queries/posts";
import { colors, radii, spacing } from "@/lib/theme";

/**
 * Full-screen image viewer. Opens on the image that was tapped and keeps the
 * swipe, so a carousel and the viewer feel like the same gesture rather than
 * two different screens.
 *
 * Images are contained rather than cropped here: the feed crops to keep the
 * timeline even, and this is the surface where someone wants to see the whole
 * photo. Alt text is shown rather than hidden in an accessibility label,
 * because the person who wrote it wrote it to be read.
 */
export function MediaLightbox({
  media,
  initialIndex = 0,
  visible,
  onClose,
}: {
  media: PostMediaItem[];
  initialIndex?: number;
  visible: boolean;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(initialIndex);
  const listRef = useRef<FlatList<PostMediaItem>>(null);

  // Re-seed when the caller opens on a different image; the list is only
  // mounted while visible, so initialScrollIndex covers the first paint.
  const [seenInitial, setSeenInitial] = useState(initialIndex);
  if (seenInitial !== initialIndex) {
    setSeenInitial(initialIndex);
    setIndex(initialIndex);
  }

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  const current = media[index];

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <FlatList
          ref={listRef}
          data={media}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          onScroll={onScroll}
          scrollEventThrottle={16}
          getItemLayout={(_, i) => ({
            length: width,
            offset: width * i,
            index: i,
          })}
          renderItem={({ item }) => (
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close image"
              style={{ width, height }}
            >
              <Image
                source={{ uri: item.url }}
                alt={item.alt_text ?? "Post image"}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                transition={150}
                cachePolicy="memory-disk"
                recyclingKey={item.url}
              />
            </Pressable>
          )}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close image"
          onPress={onClose}
          hitSlop={10}
          style={[styles.close, { top: insets.top + spacing(2) }]}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>

        {media.length > 1 ? (
          <View style={[styles.counter, { top: insets.top + spacing(3) }]}>
            <Text style={styles.counterLabel}>
              {index + 1} of {media.length}
            </Text>
          </View>
        ) : null}

        {current?.alt_text ? (
          <View style={[styles.caption, { paddingBottom: insets.bottom + spacing(4) }]}>
            <Text style={styles.captionText}>{current.alt_text}</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  close: {
    position: "absolute",
    left: spacing(4),
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  counter: {
    position: "absolute",
    alignSelf: "center",
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: radii.full,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  counterLabel: {
    color: "#fff",
    fontSize: 12.5,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  caption: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing(5),
    paddingTop: spacing(4),
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  captionText: {
    color: colors.foreground,
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: "center",
  },
});
