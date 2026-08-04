import { useEffect, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { registerAccountScopedReset } from "@/lib/account-state";
import { colors, radii, spacing } from "@/lib/theme";

export const UNDO_WINDOW_MS = 5000;

interface PendingSend {
  id: number;
  message: string;
  expiresAt: number;
  timer: ReturnType<typeof setTimeout>;
  commit: () => void;
  onUndo: () => void;
}

// The manager lives at module scope so a pending write survives the screen
// that scheduled it: posting closes the compose modal immediately, and the
// snackbar host in the root layout keeps rendering the countdown.
let nextSendId = 0;
const pendingSends = new Map<number, PendingSend>();
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const listener of listeners) listener();
}

/**
 * Delays a network write by UNDO_WINDOW_MS while the global snackbar offers
 * Undo. The timer elapsing, an explicit flush, or the app backgrounding runs
 * the commit; Undo cancels it. Each call gets its own timer, so rapid
 * successive sends stack independently. Returns an id for targeted flushing.
 */
export function scheduleUndoableSend(options: {
  message: string;
  commit: () => void;
  onUndo: () => void;
}): number {
  const id = nextSendId++;
  const timer = setTimeout(() => {
    pendingSends.delete(id);
    notifyListeners();
    options.commit();
  }, UNDO_WINDOW_MS);
  pendingSends.set(id, {
    id,
    message: options.message,
    expiresAt: Date.now() + UNDO_WINDOW_MS,
    timer,
    commit: options.commit,
    onUndo: options.onUndo,
  });
  notifyListeners();
  return id;
}

/**
 * Commits the given pending sends now (all of them when ids is omitted),
 * skipping the rest of their undo windows. Screens call this on unmount so
 * navigating away never loses a message.
 */
export function flushUndoableSends(ids?: number[]) {
  const targets = ids ?? Array.from(pendingSends.keys());
  for (const id of targets) {
    const send = pendingSends.get(id);
    if (!send) continue;
    clearTimeout(send.timer);
    pendingSends.delete(id);
    send.commit();
  }
  notifyListeners();
}

// Switching accounts drops pending sends instead of flushing them. A commit
// is a network write, and by the time it ran the client would be holding the
// incoming account's token, so the message would go out as the wrong person.
// onUndo is skipped too: it restores composer state on screens that are being
// torn down with the outgoing session anyway.
registerAccountScopedReset(() => {
  for (const send of pendingSends.values()) clearTimeout(send.timer);
  pendingSends.clear();
  notifyListeners();
});

function undoSend(id: number) {
  const send = pendingSends.get(id);
  if (!send) return;
  clearTimeout(send.timer);
  pendingSends.delete(id);
  notifyListeners();
  send.onUndo();
}

function Countdown({ expiresAt }: { expiresAt: number }) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.ceil((expiresAt - Date.now()) / 1000),
  );
  useEffect(() => {
    // Ticks faster than 1s so the readout never visibly skips a second.
    const interval = setInterval(() => {
      setSecondsLeft(Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(interval);
  }, [expiresAt]);
  return <Text style={styles.countdown}>{secondsLeft}s</Text>;
}

/** Renders pending undoable sends. Mounted once in the root layout. */
export function UndoSnackbarHost() {
  const insets = useSafeAreaInsets();
  const [, setVersion] = useState(0);

  useEffect(() => {
    const listener = () => setVersion((v) => v + 1);
    listeners.add(listener);
    // JS timers stall while the app is backgrounded, so commit everything
    // before it sleeps rather than risk losing the message.
    const appState = AppState.addEventListener("change", (status) => {
      if (status !== "active") flushUndoableSends();
    });
    return () => {
      listeners.delete(listener);
      appState.remove();
      flushUndoableSends();
    };
  }, []);

  const sends = Array.from(pendingSends.values());
  if (sends.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { bottom: insets.bottom + spacing(18) }]}
    >
      {sends.map((send) => (
        <View key={send.id} style={styles.snackbar}>
          <Text style={styles.message} numberOfLines={1}>
            {send.message}
          </Text>
          <Countdown expiresAt={send.expiresAt} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Undo send"
            onPress={() => undoSend(send.id)}
            hitSlop={8}
            style={({ pressed }) => [pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.undoLabel}>Undo</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss and send now"
            onPress={() => flushUndoableSends([send.id])}
            hitSlop={8}
            style={({ pressed }) => [pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="close" size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: spacing(4),
    right: spacing(4),
    gap: spacing(2),
  },
  snackbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    borderRadius: radii.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  message: {
    flex: 1,
    color: colors.foreground,
    fontSize: 13.5,
  },
  countdown: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    fontVariant: ["tabular-nums"],
  },
  undoLabel: {
    color: colors.primary,
    fontSize: 13.5,
    fontWeight: "700",
  },
});
