import { Modal, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { Button } from "@/components/ui";
import { colors, radii, spacing } from "@/lib/theme";

const BACKDROP = "rgba(0, 0, 0, 0.55)";
const QR_SIZE = 220;
// The QR sits on a white card for scanner contrast, like the web dialog.
const QR_CARD_BG = "#ffffff";
const QR_FOREGROUND = "#000000";

/**
 * Centered share card with a scannable QR for the profile URL, mirroring
 * the web QRCodeDialog; the share button hands the plain link to the
 * system share sheet.
 */
export function ProfileQrModal({
  visible,
  onClose,
  username,
  profileUrl,
}: {
  visible: boolean;
  onClose: () => void;
  username: string;
  profileUrl: string;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={styles.backdrop}
          onPress={onClose}
        />
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.heading}>QR code</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              hitSlop={8}
            >
              <Ionicons name="close" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>
          <Text style={styles.subheading}>
            Scan to visit @{username}&apos;s profile
          </Text>

          <View style={styles.qrCard}>
            <QRCode
              value={profileUrl}
              size={QR_SIZE}
              color={QR_FOREGROUND}
              backgroundColor={QR_CARD_BG}
              ecl="M"
            />
          </View>

          <Text style={styles.url} numberOfLines={1}>
            {profileUrl}
          </Text>

          <Button
            label="Share link"
            onPress={() => {
              Share.share({ message: profileUrl }).catch(() => {
                // The user dismissed the share sheet; nothing actionable.
              });
            }}
          />
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heading: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "700",
  },
  subheading: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    marginTop: spacing(1),
  },
  qrCard: {
    alignSelf: "center",
    backgroundColor: QR_CARD_BG,
    borderRadius: radii.md,
    padding: spacing(3.5),
    marginVertical: spacing(4),
  },
  url: {
    color: colors.mutedForeground,
    fontSize: 11.5,
    textAlign: "center",
    marginBottom: spacing(4),
  },
});
