import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui";
import { enablePush, registerForPush } from "@/lib/push";
import {
  recordLaunchAndCheckPriming,
  setPushDecision,
} from "@/lib/push-priming";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

const BACKDROP = "rgba(0, 0, 0, 0.55)";

const HIGHLIGHTS: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}[] = [
  { icon: "chatbubble-outline", text: "Replies and mentions on your posts" },
  { icon: "mail-outline", text: "Direct messages while the app is closed" },
  { icon: "radio-outline", text: "People you follow going live" },
];

/**
 * Owns push registration for the signed-in session. A device that already
 * granted permission re-registers silently; everyone else sees this
 * explainer once, on a later launch, and the OS prompt only follows a tap on
 * Enable. iOS never re-asks after a denial, so the prompt is worth spending
 * carefully.
 */
export function PushPriming() {
  const { user, mfaPending } = useAuth();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  // Token refreshes republish the user, and neither the launch count nor the
  // explainer should fire twice in one session.
  const handled = useRef<string | null>(null);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId || mfaPending || handled.current === userId) return;
    handled.current = userId;
    let cancelled = false;

    registerForPush(userId).catch((err) =>
      console.warn("[push] registration failed:", err),
    );
    recordLaunchAndCheckPriming()
      .then((due) => {
        if (!cancelled && due) setVisible(true);
      })
      .catch((err) => console.warn("[push] priming check failed:", err));

    return () => {
      cancelled = true;
    };
  }, [userId, mfaPending]);

  async function handleEnable() {
    if (!userId) return;
    setBusy(true);
    try {
      const result = await enablePush(userId);
      await setPushDecision(result === "granted" ? "enabled" : "declined");
    } finally {
      setBusy(false);
      setVisible(false);
    }
  }

  async function handleDismiss() {
    setVisible(false);
    // The notifications settings screen is the way back in.
    await setPushDecision("declined");
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={styles.container}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Not now"
          style={styles.backdrop}
          onPress={handleDismiss}
        />
        <View style={styles.card}>
          <View style={styles.iconTile}>
            <Ionicons
              name="notifications-outline"
              size={22}
              color={colors.primary}
            />
          </View>
          <Text style={styles.heading}>Know when it happens</Text>
          <Text style={styles.subheading}>
            Turn on notifications and Orbit taps you on the shoulder for the
            things you would come back for anyway.
          </Text>

          <View style={styles.highlights}>
            {HIGHLIGHTS.map((highlight) => (
              <View key={highlight.text} style={styles.highlightRow}>
                <Ionicons
                  name={highlight.icon}
                  size={16}
                  color={colors.mutedForeground}
                />
                <Text style={styles.highlightText}>{highlight.text}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.footnote}>
            You choose which ones in Settings, and quiet hours still apply.
          </Text>

          <View style={styles.actions}>
            <Button label="Enable" loading={busy} onPress={handleEnable} />
            <Button
              label="Not now"
              variant="outline"
              disabled={busy}
              onPress={handleDismiss}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing(6),
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BACKDROP,
  },
  card: {
    alignSelf: "stretch",
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(5),
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  heading: {
    marginTop: spacing(3),
    color: colors.foreground,
    fontSize: 17,
    fontWeight: "700",
  },
  subheading: {
    marginTop: spacing(2),
    color: colors.mutedForeground,
    fontSize: 13,
    lineHeight: 19,
  },
  highlights: {
    marginTop: spacing(4),
    gap: spacing(2.5),
  },
  highlightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
  },
  highlightText: {
    flex: 1,
    color: colors.foreground,
    fontSize: 13.5,
  },
  footnote: {
    marginTop: spacing(4),
    color: colors.textFaint,
    fontSize: 12,
    lineHeight: 17,
  },
  actions: {
    marginTop: spacing(5),
    gap: spacing(2),
  },
});
