import { useState, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "@/lib/theme";

/** The orbit ring mark, drawn with views so it needs no asset. */
export function OrbitMark({ size = 64 }: { size?: number }) {
  const stroke = Math.max(3, Math.round(size * 0.09));
  const dot = Math.round(size * 0.16);
  return (
    <View style={{ width: size, height: size, alignSelf: "center" }}>
      <View
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: size / 2,
          borderWidth: stroke,
          borderColor: colors.primary,
        }}
      />
      <View
        style={{
          position: "absolute",
          top: -dot * 0.1,
          right: size * 0.08,
          width: dot,
          height: dot,
          borderRadius: dot / 2,
          backgroundColor: colors.primary,
        }}
      />
    </View>
  );
}

/**
 * Filled placeholder-led input, IG-style: no label, 48px tall, elevated
 * surface, optional password visibility toggle.
 */
export function AuthInput({
  secure = false,
  style,
  ...rest
}: TextInputProps & { secure?: boolean }) {
  const [hidden, setHidden] = useState(secure);
  return (
    <View style={authStyles.inputWrap}>
      <TextInput
        placeholderTextColor={colors.textFaint}
        secureTextEntry={hidden}
        style={[authStyles.input, style]}
        {...rest}
      />
      {secure ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={hidden ? "Show password" : "Hide password"}
          onPress={() => setHidden((h) => !h)}
          hitSlop={8}
          style={authStyles.eye}
        >
          <Ionicons
            name={hidden ? "eye-outline" : "eye-off-outline"}
            size={19}
            color={colors.mutedForeground}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Centered auth page scaffold: mark and form vertically centered, an
 * optional footer action pinned to the bottom above the home indicator.
 */
export function AuthShell({
  children,
  footer,
}: {
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <KeyboardAvoidingView
      style={authStyles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={authStyles.content}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={authStyles.body}>{children}</View>
        {footer ? <View style={authStyles.footer}>{footer}</View> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export const authStyles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    padding: spacing(6),
  },
  body: {
    flex: 1,
    justifyContent: "center",
  },
  footer: {
    paddingTop: spacing(4),
  },
  inputWrap: {
    position: "relative",
    marginBottom: spacing(3),
  },
  input: {
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.foreground,
    paddingHorizontal: spacing(4),
    paddingRight: spacing(11),
    fontSize: 15,
  },
  eye: {
    position: "absolute",
    right: spacing(4),
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  error: {
    color: colors.destructive,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing(3),
  },
  linkCenter: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginTop: spacing(4),
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    marginVertical: spacing(5),
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.textFaint,
    fontSize: 12,
    fontWeight: "600",
  },
});
