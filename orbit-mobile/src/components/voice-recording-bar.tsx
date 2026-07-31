import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioRecorderState, type AudioRecorder } from "expo-audio";
import { colors, radii, spacing } from "@/lib/theme";

/** Discard accidental taps that record almost nothing. */
export const VOICE_MIN_MS = 500;
/** Auto-stop-and-send ceiling for a clip. */
export const VOICE_MAX_MS = 120_000;

const WAVEFORM_BARS = 26;
// The default 500ms status poll steps the meter at ~2fps, which reads as
// broken; 50ms keeps it fluid.
const METER_POLL_MS = 50;
// expo-audio metering is in dBFS; -55 and below renders as the resting bar.
const METER_RANGE_DB = 55;
// Match the composer's 40px input/send controls so starting a recording never
// changes the row height.
const CONTROL_SIZE = 40;

function formatClock(durationMs: number): string {
  const total = Math.floor(durationMs / 1000);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Replaces the composer input while recording: cancel, a scrolling input-level
 * waveform, the timer, and send. It owns the recorder's status subscription so
 * the 20Hz metering updates only re-render this bar, never the composer row.
 */
export function VoiceRecordingBar({
  recorder,
  onCancel,
  onSend,
  onAutoStop,
}: {
  recorder: AudioRecorder;
  onCancel: () => void;
  onSend: () => void;
  onAutoStop: () => void;
}) {
  const state = useAudioRecorderState(recorder, METER_POLL_MS);
  const durationMs = state.durationMillis;

  // A rolling window of recent input levels so the bars flow right-to-left
  // like a real waveform instead of all pulsing together.
  const [levels, setLevels] = useState<number[]>(() =>
    new Array<number>(WAVEFORM_BARS).fill(0.06),
  );
  useEffect(() => {
    const timer = setInterval(() => {
      const metering = recorder.getStatus().metering;
      const level =
        metering == null
          ? 0.06
          : Math.max(
              0.06,
              Math.min(1, (metering + METER_RANGE_DB) / METER_RANGE_DB),
            );
      setLevels((prev) => [...prev.slice(1), level]);
    }, METER_POLL_MS);
    return () => clearInterval(timer);
  }, [recorder]);

  useEffect(() => {
    if (durationMs >= VOICE_MAX_MS) onAutoStop();
  }, [durationMs, onAutoStop]);

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Cancel voice message"
        style={({ pressed }) => [styles.cancelButton, pressed && { opacity: 0.7 }]}
      >
        <Ionicons name="trash-outline" size={18} color={colors.mutedForeground} />
      </Pressable>
      <View style={styles.meterPill}>
        <View style={styles.recordingDot} />
        <View style={styles.waveform}>
          {levels.map((level, index) => (
            <View
              key={index}
              style={[styles.waveformBar, { height: 3 + level * 18 }]}
            />
          ))}
        </View>
        <Text style={styles.timer}>{formatClock(durationMs)}</Text>
      </View>
      <Pressable
        onPress={onSend}
        accessibilityRole="button"
        accessibilityLabel="Send voice message"
        style={({ pressed }) => [styles.sendButton, pressed && { opacity: 0.7 }]}
      >
        <Ionicons name="arrow-up" size={20} color={colors.primaryForeground} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
  },
  cancelButton: {
    width: CONTROL_SIZE,
    height: CONTROL_SIZE,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  meterPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    height: CONTROL_SIZE,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing(3),
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.destructive,
  },
  waveform: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 22,
  },
  waveformBar: {
    width: 2.5,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  timer: {
    color: colors.foreground,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  sendButton: {
    width: CONTROL_SIZE,
    height: CONTROL_SIZE,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
