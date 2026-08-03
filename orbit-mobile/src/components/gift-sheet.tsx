import { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";
import { GIFTS, sendGift, type GiftType, type SentGift } from "@/lib/queries/gifts";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

const BACKDROP = "rgba(0, 0, 0, 0.55)";
const FADE_MS = 160;
const SLIDE_MS = 200;
const HANDLE_WIDTH = 40;
const HANDLE_HEIGHT = 4;

/**
 * Bottom-sheet gift picker for the live viewer. Same backdrop-fade plus
 * RAF-kicked slide as ReportSheet; see ClipCommentsSheet for why the two
 * layers animate independently.
 */
export function GiftSheet({
  visible,
  streamId,
  onClose,
  onSent,
}: {
  visible: boolean;
  streamId: string;
  onClose: () => void;
  onSent: (sent: SentGift) => void;
}) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [fade] = useState(() => new Animated.Value(0));
  const [slide] = useState(() => new Animated.Value(height));

  useEffect(() => {
    if (!visible) {
      fade.setValue(0);
      slide.setValue(height);
      return;
    }
    slide.setValue(height);
    const raf = requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 1,
          duration: FADE_MS,
          useNativeDriver: true,
        }),
        Animated.timing(slide, {
          toValue: 0,
          duration: SLIDE_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });
    return () => cancelAnimationFrame(raf);
  }, [visible, height, fade, slide]);

  const sendMutation = useMutation({
    mutationFn: (giftType: GiftType) => {
      if (!user) throw new Error("Not authenticated");
      return sendGift(streamId, user.id, giftType);
    },
    onSuccess: (sent) => {
      onSent(sent);
      handleClose();
    },
  });

  const handleClose = () => {
    sendMutation.reset();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Pressable
          style={styles.flex}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Close gifts"
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          {
            paddingBottom: insets.bottom + spacing(4),
            transform: [{ translateY: slide }],
          },
        ]}
      >
        <View style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>

        <View style={styles.header}>
          <Text style={styles.headerTitle}>Send a gift</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close gifts"
            onPress={handleClose}
            hitSlop={8}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="close" size={22} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <Text style={styles.helperText}>
          Gifts are free and show up on the stream for everyone watching.
        </Text>

        <View style={styles.grid}>
          {GIFTS.map((gift) => (
            <Pressable
              key={gift.type}
              accessibilityRole="button"
              accessibilityLabel={`Send ${gift.name}`}
              disabled={sendMutation.isPending}
              onPress={() => sendMutation.mutate(gift.type)}
              style={({ pressed }) => [
                styles.giftCell,
                pressed && { opacity: 0.7 },
                sendMutation.isPending && { opacity: 0.5 },
              ]}
            >
              <MaterialCommunityIcons name={gift.icon} size={30} color={gift.color} />
              <Text style={styles.giftName}>{gift.name}</Text>
            </Pressable>
          ))}
        </View>

        {sendMutation.isError ? (
          <Text style={styles.errorText}>Could not send the gift. Try again.</Text>
        ) : null}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BACKDROP,
  },
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing(4),
    paddingTop: spacing(2),
  },
  handleWrap: {
    alignItems: "center",
    paddingBottom: spacing(2),
  },
  handle: {
    width: HANDLE_WIDTH,
    height: HANDLE_HEIGHT,
    borderRadius: HANDLE_HEIGHT / 2,
    backgroundColor: colors.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: spacing(2.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    color: colors.foreground,
    fontSize: 14.5,
    fontWeight: "600",
  },
  helperText: {
    color: colors.mutedForeground,
    fontSize: 13,
    lineHeight: 18,
    paddingTop: spacing(3),
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing(2.5),
    paddingTop: spacing(3),
  },
  giftCell: {
    width: "18%",
    minWidth: 64,
    flexGrow: 1,
    alignItems: "center",
    gap: spacing(1.5),
    paddingVertical: spacing(3),
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  giftName: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  errorText: {
    color: colors.destructive,
    fontSize: 13,
    paddingTop: spacing(3),
  },
});
