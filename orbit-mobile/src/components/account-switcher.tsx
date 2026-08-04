import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "@/components/ui";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

const AVATAR_SIZE = 40;

/**
 * The accounts signed in on this device. Tapping one swaps the session in
 * place; Add account sends the login screen a flag so the next sign-in joins
 * the list instead of replacing what is there.
 */
export function AccountSwitcherSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { user, accounts, switching, switchAccount, beginAddAccount } =
    useAuth();

  async function handleSwitch(userId: string) {
    onClose();
    await switchAccount(userId);
  }

  function handleAdd() {
    onClose();
    beginAddAccount();
    router.push("/(auth)/login");
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close account switcher"
          style={styles.backdrop}
          onPress={onClose}
        />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.heading}>Accounts</Text>

          {accounts.map((account) => {
            const isActive = account.userId === user?.id;
            return (
              <Pressable
                key={account.userId}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`Switch to @${account.username}`}
                disabled={isActive || switching}
                onPress={() => handleSwitch(account.userId)}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Avatar
                  url={account.avatarUrl}
                  name={account.displayName ?? account.username}
                  size={AVATAR_SIZE}
                />
                <View style={styles.rowText}>
                  <Text style={styles.displayName} numberOfLines={1}>
                    {account.displayName ?? account.username}
                  </Text>
                  <Text style={styles.username} numberOfLines={1}>
                    @{account.username}
                  </Text>
                </View>
                {isActive ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={colors.primary}
                  />
                ) : null}
              </Pressable>
            );
          })}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add account"
            disabled={switching}
            onPress={handleAdd}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
          >
            <View style={styles.addIcon}>
              <Ionicons name="add" size={20} color={colors.foreground} />
            </View>
            <Text style={styles.addLabel}>Add account</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  sheet: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingTop: spacing(2),
    paddingBottom: spacing(9),
    paddingHorizontal: spacing(2),
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: colors.border,
    marginBottom: spacing(3),
  },
  heading: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    paddingHorizontal: spacing(3),
    marginBottom: spacing(2),
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingHorizontal: spacing(3),
    height: 60,
  },
  rowText: {
    flex: 1,
  },
  displayName: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "600",
  },
  username: {
    color: colors.mutedForeground,
    fontSize: 13,
    marginTop: 1,
  },
  addIcon: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  addLabel: {
    flex: 1,
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "500",
  },
});
