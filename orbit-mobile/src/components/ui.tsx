import type { ComponentProps, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useIsOnline } from "@/lib/hooks/use-is-online";
import { colors, radii, spacing } from "@/lib/theme";

export function Button({
  label,
  variant = "primary",
  loading = false,
  disabled,
  style,
  ...rest
}: PressableProps & {
  label: string;
  variant?: "primary" | "outline" | "destructive";
  loading?: boolean;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        variant === "outline" && styles.buttonOutline,
        variant === "destructive" && styles.buttonDestructive,
        pressed && { opacity: 0.85 },
        isDisabled && { opacity: 0.5 },
        typeof style === "object" ? style : null,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "outline" ? colors.foreground : colors.primaryForeground}
        />
      ) : (
        <Text
          style={[
            styles.buttonLabel,
            variant === "outline" && { color: colors.foreground },
            variant === "destructive" && { color: "#fff" },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  error,
  ...rest
}: TextInputProps & { label?: string; error?: string | null }) {
  return (
    <View style={{ marginBottom: spacing(4) }}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textFaint}
        style={[styles.input, error ? { borderColor: colors.destructive } : null]}
        {...rest}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export function Avatar({
  url,
  name,
  size = 40,
}: {
  url: string | null | undefined;
  name: string;
  size?: number;
}) {
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        alt={name}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          // Flat placeholder so the reserved circle reads as a slot rather
          // than a hole while the image decodes.
          backgroundColor: colors.surfaceElevated,
        }}
        contentFit="cover"
        // The fade replays on every mount even on cache hits, which flashes
        // avatars in lists.
        transition={0}
        // The same handful of avatars repeat all over DMs, feeds and
        // comments; memory caching paints them without a re-decode.
        cachePolicy="memory-disk"
        // Recycled rows otherwise keep showing the previous row's avatar
        // until the new one decodes.
        recyclingKey={url}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.surfaceElevated,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: colors.textSecondary,
          fontWeight: "600",
          fontSize: size * 0.4,
        }}
      >
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  // Rendered inside the centered block. Placing an icon as a sibling above
  // an EmptyState instead pushes it to the top of the container, because
  // this view takes the remaining height and centers only its own contents.
  icon?: ComponentProps<typeof Ionicons>["name"];
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      {icon ? (
        <Ionicons
          name={icon}
          size={40}
          color={colors.mutedForeground}
          style={styles.emptyIcon}
        />
      ) : null}
      <Text style={styles.emptyTitle}>{title}</Text>
      {description ? <Text style={styles.emptyDescription}>{description}</Text> : null}
      {action ? <View style={{ marginTop: spacing(4) }}>{action}</View> : null}
    </View>
  );
}

/**
 * Failure counterpart to EmptyState. A query that fails while the device is
 * offline is almost always the connection, so say that instead of blaming
 * the content.
 */
export function ErrorState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  const online = useIsOnline();

  if (!online) {
    return (
      <EmptyState
        title="No connection"
        description="Orbit cannot reach the network right now. Reconnect and try again."
        action={action}
      />
    );
  }
  return <EmptyState title={title} description={description} action={action} />;
}

export function Centered({ children }: { children: ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing(5),
  },
  buttonOutline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonDestructive: {
    backgroundColor: colors.destructive,
  },
  buttonLabel: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: "600",
  },
  fieldLabel: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    minHeight: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.foreground,
    paddingHorizontal: spacing(3.5),
    fontSize: 14,
  },
  fieldError: {
    color: colors.destructive,
    fontSize: 11.5,
    marginTop: 5,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing(8),
  },
  emptyIcon: {
    marginBottom: spacing(3),
  },
  emptyTitle: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
  },
  emptyDescription: {
    color: colors.mutedForeground,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
    maxWidth: 300,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
});
