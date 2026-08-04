import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEvent } from "expo";
import { colors, radii, spacing } from "@/lib/theme";

// Mirrors the web bubble's media block: 4:3 crop at a fixed width, rounded,
// object-cover, capped by the bubble.
const MEDIA_WIDTH = 230;
const MEDIA_ASPECT = 4 / 3;

export interface ViewerMedia {
  url: string;
  type: "image" | "video";
}

function InlineVideo({
  url,
  onLongPress,
}: {
  url: string;
  onLongPress?: () => void;
}) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
  });
  const { isPlaying } = useEvent(player, "playingChange", {
    isPlaying: player.playing,
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isPlaying ? "Pause video" : "Play video"}
      onPress={() => {
        if (isPlaying) player.pause();
        else player.play();
      }}
      onLongPress={onLongPress}
      style={styles.media}
    >
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />
      {!isPlaying ? (
        <View style={styles.playBadge}>
          <Ionicons name="play" size={22} color={colors.foreground} />
        </View>
      ) : null}
    </Pressable>
  );
}

function FullscreenVideo({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={styles.viewerContent}
      contentFit="contain"
      nativeControls
    />
  );
}

/**
 * Full-screen media viewer: fit-to-screen image or video on black with a
 * close button. Shared by message bubbles and the conversation media gallery.
 */
export function MediaViewerModal({
  media,
  onClose,
}: {
  media: ViewerMedia | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={media !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.viewerBackdrop}>
        {media?.type === "video" ? (
          <FullscreenVideo url={media.url} />
        ) : media ? (
          <Image
            source={{ uri: media.url }}
            style={styles.viewerContent}
            contentFit="contain"
            alt="Full-screen media"
          />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close media viewer"
          onPress={onClose}
          hitSlop={8}
          style={({ pressed }) => [
            styles.viewerClose,
            { top: insets.top + spacing(3) },
            pressed && { opacity: 0.6 },
          ]}
        >
          <Ionicons name="close" size={26} color={colors.foreground} />
        </Pressable>
      </View>
    </Modal>
  );
}

/**
 * Image or video block inside a message bubble. Images tap open the
 * full-screen viewer; videos play inline on tap. Long press forwards to the
 * bubble's action bar so media messages keep the same gestures as text.
 */
export function MessageMedia({
  url,
  mediaType,
  onLongPress,
}: {
  url: string;
  mediaType: string | null;
  onLongPress?: () => void;
}) {
  const [viewer, setViewer] = useState<ViewerMedia | null>(null);
  const isVideo = mediaType === "video";

  return (
    <>
      {isVideo ? (
        <InlineVideo url={url} onLongPress={onLongPress} />
      ) : (
        <Pressable
          accessibilityRole="imagebutton"
          accessibilityLabel="View image"
          onPress={() => setViewer({ url, type: "image" })}
          onLongPress={onLongPress}
          style={styles.media}
        >
          <Image
            source={{ uri: url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={100}
            alt=""
            cachePolicy="memory-disk"
            recyclingKey={url}
          />
        </Pressable>
      )}
      <MediaViewerModal media={viewer} onClose={() => setViewer(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  media: {
    width: MEDIA_WIDTH,
    maxWidth: "100%",
    aspectRatio: MEDIA_ASPECT,
    borderRadius: radii.sm,
    overflow: "hidden",
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  playBadge: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: "rgba(11, 11, 13, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    // Optically center the triangular glyph.
    paddingLeft: 3,
  },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: "#000",
  },
  viewerContent: {
    flex: 1,
  },
  viewerClose: {
    position: "absolute",
    right: spacing(4),
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: "rgba(27, 27, 31, 0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
});
