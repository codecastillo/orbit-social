import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import { localVoiceUri, prefetchVoice } from "@/lib/audio-cache";
import { colors, radii, spacing } from "@/lib/theme";

function formatClock(totalSeconds: number): string {
  const whole = Math.max(0, Math.round(totalSeconds));
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * A voice-message bubble: play/pause, a progress track, and the clip length
 * (which counts up while playing). Plays from the prefetched local file when
 * it is already cached so the first tap starts instantly; falls back to
 * streaming the remote URL.
 */
export function VoiceBubble({ url, isMine }: { url: string; isMine: boolean }) {
  const [uri, setUri] = useState<string>(() => localVoiceUri(url) ?? url);
  useEffect(() => {
    if (localVoiceUri(url)) return;
    let active = true;
    void prefetchVoice([url]).then(() => {
      const local = localVoiceUri(url);
      if (active && local) setUri(local);
    });
    return () => {
      active = false;
    };
  }, [url]);

  const source = useMemo(() => ({ uri }), [uri]);
  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);

  const playing = status.playing;
  const totalSec = status.duration || 0;
  const currentSec = status.currentTime || 0;
  const progress = totalSec > 0 ? Math.min(1, currentSec / totalSec) : 0;
  const accent = isMine ? colors.primaryForeground : colors.primary;
  const track = isMine ? "rgba(23, 17, 31, 0.25)" : colors.border;

  const toggle = async () => {
    if (playing) {
      player.pause();
      return;
    }
    // The iOS silent switch mutes playback unless the session opts out.
    await setAudioModeAsync({ playsInSilentMode: true });
    if (status.didJustFinish || (totalSec > 0 && currentSec >= totalSec)) {
      player.seekTo(0);
    }
    player.play();
  };

  // Count up while playing, otherwise show the full clip length.
  const shownSec = playing && currentSec > 0 ? currentSec : totalSec;

  return (
    <View
      style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}
    >
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={
          playing ? "Pause voice message" : "Play voice message"
        }
        hitSlop={8}
      >
        <Ionicons name={playing ? "pause" : "play"} size={22} color={accent} />
      </Pressable>
      <View style={[styles.track, { backgroundColor: track }]}>
        <View
          style={{ flex: Math.max(0.0001, progress), backgroundColor: accent }}
        />
        <View style={{ flex: Math.max(0.0001, 1 - progress) }} />
      </View>
      <Text
        style={[
          styles.time,
          { color: isMine ? colors.primaryForeground : colors.mutedForeground },
        ]}
      >
        {formatClock(shownSec)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    minWidth: 190,
    maxWidth: "78%",
    borderRadius: radii.lg,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2.5),
  },
  bubbleMine: {
    backgroundColor: colors.primary,
  },
  bubbleTheirs: {
    backgroundColor: colors.surfaceElevated,
  },
  track: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    flexDirection: "row",
    overflow: "hidden",
  },
  time: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
});
