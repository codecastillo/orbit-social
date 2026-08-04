import { Component, type ErrorInfo, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { clearPersistedQueryCache } from "@/lib/query-persist";
import { colors, radii, spacing } from "@/lib/theme";

interface State {
  error: Error | null;
}

/**
 * Catches render errors anywhere below the root layout so a bad screen shows
 * a recovery surface instead of a white void. There is no crash reporter on
 * mobile yet (Sentry is web only), so the console is the only sink.
 */
export class RootErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[orbit] unhandled render error", error, info.componentStack);
  }

  retry = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    return <RecoveryScreen error={this.state.error} onRetry={this.retry} />;
  }
}

function RecoveryScreen({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    queryClient.clear();
    await clearPersistedQueryCache();
    // Clearing the boundary hands control back to the AuthGate, which sends a
    // signed-out session to the login screen.
    onRetry();
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <View style={styles.iconTile}>
        <Ionicons name="alert-circle-outline" size={26} color={colors.primary} />
      </View>
      <Text style={styles.title}>Orbit hit a snag</Text>
      <Text style={styles.body}>
        This screen stopped before it could finish loading. Trying again fixes
        it most of the time. If it keeps happening, sign out and back in.
      </Text>
      {__DEV__ ? <Text style={styles.detail}>{error.message}</Text> : null}
      <View style={styles.actions}>
        <Button label="Try again" onPress={onRetry} />
        <Button label="Sign out" variant="outline" onPress={handleSignOut} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing(8),
  },
  iconTile: {
    width: 52,
    height: 52,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
  },
  title: {
    marginTop: spacing(4),
    color: colors.foreground,
    fontSize: 19,
    fontWeight: "600",
  },
  body: {
    marginTop: spacing(2),
    maxWidth: 300,
    color: colors.mutedForeground,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "center",
  },
  detail: {
    marginTop: spacing(3),
    maxWidth: 300,
    color: colors.textFaint,
    fontSize: 12,
    textAlign: "center",
  },
  actions: {
    marginTop: spacing(6),
    width: "100%",
    maxWidth: 300,
    gap: spacing(2),
  },
});
