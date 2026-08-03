import { useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Stack, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { Avatar } from "@/components/ui";
import {
  MentionButton,
  MentionInput,
  type MentionInputHandle,
} from "@/components/mention-input";
import {
  VoiceRecordingBar,
  VOICE_MIN_MS,
} from "@/components/voice-recording-bar";
import { useAuth } from "@/providers/auth-provider";
import { RichText } from "@/components/rich-text";
import {
  createPost,
  uploadPostMedia,
  type NewPostMedia,
  type PollData,
  type Post,
} from "@/lib/queries/posts";
import { getOwnProfile } from "@/lib/queries/profiles";
import { deleteDraft } from "@/lib/queries/drafts";
import { consumeDraftRestore } from "@/lib/draft-restore";
import { consumeQuoteSeed } from "@/lib/quote-seed";
import { formatTimeAgo } from "@/lib/format";
import { scheduleUndoableSend } from "@/lib/undo-send";
import { colors, radii, spacing } from "@/lib/theme";

const POST_MAX_LENGTH = 500;
const MAX_MEDIA = 4; // Same attachment cap as the web composer.
const COUNTER_WARN_THRESHOLD = 20;
const POLL_MAX_OPTIONS = 4;
const POLL_OPTION_MAX_LENGTH = 50;
// Same duration choices the web poll editor offers, in hours.
const POLL_DURATIONS = [
  { hours: 1, label: "1h" },
  { hours: 6, label: "6h" },
  { hours: 12, label: "12h" },
  { hours: 24, label: "1d" },
  { hours: 72, label: "3d" },
  { hours: 168, label: "7d" },
] as const;
const DEFAULT_POLL_HOURS = 24;
const LOCATION_MAX_LENGTH = 100;
const CONTENT_WARNING_MAX_LENGTH = 100;
const ALT_TEXT_MAX_LENGTH = 300;
const MS_PER_HOUR = 60 * 60 * 1000;

interface PickedMedia {
  uri: string;
  width: number;
  height: number;
  mimeType: string;
  kind: "image" | "video" | "gif";
  durationMs: number | null;
  altText: string;
}

interface VoiceNote {
  uri: string;
  durationMs: number;
}

interface ComposerSnapshot {
  content: string;
  media: PickedMedia[];
  videoDestination: "feed" | "clip";
  voiceNote: VoiceNote | null;
  showPoll: boolean;
  pollOptions: string[];
  pollEndHours: number;
  location: string;
  showLocation: boolean;
  visibility: "public" | "close_friends";
  contentWarning: string;
  showContentWarning: boolean;
  quotedPost: Post | null;
}

// iOS gallery videos are .mov; Android's are .mp4. Same mapping the clip
// camera uses so uploads carry a real content type.
function videoMimeType(uri: string): string {
  return uri.toLowerCase().endsWith(".mov") ? "video/quicktime" : "video/mp4";
}

function formatClock(durationMs: number): string {
  const total = Math.floor(durationMs / 1000);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatScheduleDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatScheduleTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// Stashed when an undoable publish is cancelled after this modal already
// closed; the next mount consumes it so the user gets their draft back.
// Module scope because the screen unmounts on router.back().
let undoRestore: ComposerSnapshot | null = null;

export default function ComposeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  // Seed from a stashed undo snapshot when a cancelled publish reopened
  // this modal; cleared after mount so the next compose starts blank.
  const [restore] = useState(() => undoRestore);
  useEffect(() => {
    undoRestore = null;
  }, []);
  // A draft opened from the drafts screen seeds the same way; the undo
  // snapshot wins when both exist since it is the more recent state.
  const [draft] = useState(() => consumeDraftRestore());
  const draftData = draft?.draft_data;
  // A quote staged by the post card's repost menu; the undo snapshot wins
  // for the same recency reason as the draft seed.
  const [quoteSeed] = useState(() => consumeQuoteSeed());
  const [quotedPost, setQuotedPost] = useState<Post | null>(
    restore?.quotedPost ?? quoteSeed,
  );
  const [content, setContent] = useState(restore?.content ?? draft?.content ?? "");
  const [media, setMedia] = useState<PickedMedia[]>(restore?.media ?? []);
  // Single-video posts pick where they land: Feed (regular video post) or
  // Clip (type "reel", lives in the Clips tab). Defaulted from the video's
  // aspect ratio when it is added, same as the web composer.
  const [videoDestination, setVideoDestination] = useState<"feed" | "clip">(
    restore?.videoDestination ?? "feed",
  );
  const [voiceNote, setVoiceNote] = useState<VoiceNote | null>(restore?.voiceNote ?? null);
  const [showPoll, setShowPoll] = useState(
    restore?.showPoll ?? draftData?.poll != null,
  );
  const [pollOptions, setPollOptions] = useState<string[]>(
    restore?.pollOptions ?? draftData?.poll?.options ?? ["", ""],
  );
  const [pollEndHours, setPollEndHours] = useState(
    restore?.pollEndHours ?? draftData?.poll?.endHours ?? DEFAULT_POLL_HOURS,
  );
  const [location, setLocation] = useState(
    restore?.location ?? draftData?.location ?? "",
  );
  const [showLocation, setShowLocation] = useState(
    restore?.showLocation ?? Boolean(draftData?.location),
  );
  const [visibility, setVisibility] = useState<"public" | "close_friends">(
    restore?.visibility ?? draftData?.visibility ?? "public",
  );
  const [contentWarning, setContentWarning] = useState(
    restore?.contentWarning ?? draftData?.contentWarning ?? "",
  );
  const [showContentWarning, setShowContentWarning] = useState(
    restore?.showContentWarning ?? Boolean(draftData?.contentWarning),
  );
  // Scheduled posts commit immediately (no undo window, matching web), so
  // schedule state is never part of the undo snapshot. A draft's stored
  // schedule only carries over while it is still in the future; both
  // initializers are lazy so the clock reads happen once, not per render.
  const [showSchedule, setShowSchedule] = useState(
    () =>
      draftData?.scheduledAt != null &&
      new Date(draftData.scheduledAt).getTime() > Date.now(),
  );
  const [scheduledDate, setScheduledDate] = useState<Date>(() => {
    const staged = draftData?.scheduledAt ? new Date(draftData.scheduledAt) : null;
    return staged && staged.getTime() > Date.now()
      ? staged
      : new Date(Date.now() + MS_PER_HOUR);
  });
  // Android's picker is a dialog per mode; iOS renders inline.
  const [androidPickerMode, setAndroidPickerMode] = useState<"date" | "time" | null>(null);
  const [altEditingUri, setAltEditingUri] = useState<string | null>(null);
  const captionRef = useRef<MentionInputHandle>(null);

  // Voice note recording, same recorder architecture as the DM screen: the
  // meter and timer live in VoiceRecordingBar so its 20Hz updates never
  // re-render this screen.
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
  const [recording, setRecording] = useState(false);

  const startVoiceRecording = async () => {
    if (recording || voiceNote) return;
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Microphone needed",
        "Turn on microphone access in Settings to record a voice note.",
      );
      return;
    }
    // Recording fails unless the session allows it before prepare/record.
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true);
  };

  const finishVoiceRecording = async (shouldKeep: boolean) => {
    if (!recording) return;
    // durationMillis resets once stop() lands, so read it first.
    const durationMs = recorder.getStatus().durationMillis;
    setRecording(false);
    try {
      await recorder.stop();
    } catch {
      // Nothing to keep if the recorder never got going.
    }
    await setAudioModeAsync({ allowsRecording: false });
    const uri = recorder.uri;
    // Ignore accidental taps that record almost nothing.
    if (shouldKeep && uri && durationMs >= VOICE_MIN_MS) {
      setVoiceNote({ uri, durationMs });
    }
  };

  // Own avatar beside the caption input; shares the profile cache key used
  // by the profile and edit screens.
  const { data: ownProfile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => getOwnProfile(user!.id),
    enabled: !!user,
  });

  const pickMedia = async () => {
    const remainingSlots = MAX_MEDIA - media.length;
    if (remainingSlots <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.85,
      allowsMultipleSelection: true,
      selectionLimit: remainingSlots,
    });
    if (result.canceled || result.assets.length === 0) return;

    const picked = result.assets.slice(0, remainingSlots).map((asset): PickedMedia => {
      const isVideo = asset.type === "video";
      const mimeType =
        asset.mimeType ?? (isVideo ? videoMimeType(asset.uri) : "image/jpeg");
      return {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        mimeType,
        kind: isVideo ? "video" : mimeType === "image/gif" ? "gif" : "image",
        durationMs: isVideo ? (asset.duration ?? null) : null,
        altText: "",
      };
    });
    setMedia((prev) => [...prev, ...picked]);

    // Seed the destination default from the video's aspect ratio, same as
    // the web composer: portrait reads as a clip, landscape as a feed video.
    const video = picked.find((m) => m.kind === "video");
    if (video) {
      setVideoDestination(video.height > video.width ? "clip" : "feed");
    }
  };

  const removeMedia = (uri: string) => {
    setMedia((prev) => prev.filter((m) => m.uri !== uri));
    if (altEditingUri === uri) setAltEditingUri(null);
  };

  const setAltText = (uri: string, altText: string) => {
    setMedia((prev) => prev.map((m) => (m.uri === uri ? { ...m, altText } : m)));
  };

  const addPollOption = () => {
    if (pollOptions.length < POLL_MAX_OPTIONS) setPollOptions([...pollOptions, ""]);
  };

  const removePollOption = (index: number) => {
    if (pollOptions.length <= 2) return;
    setPollOptions(pollOptions.filter((_, i) => i !== index));
  };

  const updatePollOption = (index: number, value: string) => {
    setPollOptions(pollOptions.map((opt, i) => (i === index ? value : opt)));
  };

  const togglePoll = () => {
    if (quotedPost) return;
    if (showPoll) {
      setPollOptions(["", ""]);
      setPollEndHours(DEFAULT_POLL_HOURS);
    }
    setShowPoll(!showPoll);
  };

  const toggleSchedule = () => {
    if (!showSchedule) setScheduledDate(new Date(Date.now() + MS_PER_HOUR));
    setAndroidPickerMode(null);
    setShowSchedule(!showSchedule);
  };

  const trimmed = content.trim();
  const validPollOptions = pollOptions.filter((o) => o.trim().length > 0);
  const isPollValid = !showPoll || validPollOptions.length >= 2;
  const canPost =
    (trimmed.length > 0 ||
      media.length > 0 ||
      voiceNote !== null ||
      (showPoll && validPollOptions.length >= 2)) &&
    isPollValid &&
    !recording;
  const remaining = POST_MAX_LENGTH - content.length;
  const singleVideo = media.length === 1 && media[0].kind === "video" ? media[0] : null;
  const altEditing = altEditingUri
    ? (media.find((m) => m.uri === altEditingUri) ?? null)
    : null;

  // Delayed commit: dismiss the modal right away and give the snackbar a
  // 5 second undo window before the upload and insert actually run.
  // Scheduled posts skip the window and commit immediately, matching web.
  const handlePublish = () => {
    if (!user || !canPost) return;

    const isScheduling = showSchedule;
    if (isScheduling && scheduledDate.getTime() <= Date.now()) {
      Alert.alert("Pick a future time", "The scheduled time has already passed.");
      return;
    }
    if (quotedPost && trimmed.length === 0) {
      Alert.alert(
        "Add your take",
        "A quote needs some text. To share it as is, use Repost instead.",
      );
      return;
    }
    const draftId = draft?.id;

    const pollData: PollData | undefined =
      showPoll && validPollOptions.length >= 2
        ? {
            options: validPollOptions.map((text) => ({ text: text.trim(), votes: 0 })),
            ends_at: new Date(Date.now() + pollEndHours * MS_PER_HOUR).toISOString(),
            multi_select: false,
          }
        : undefined;

    const snapshot: ComposerSnapshot = {
      content,
      media,
      videoDestination,
      voiceNote,
      showPoll,
      pollOptions,
      pollEndHours,
      location,
      showLocation,
      visibility,
      contentWarning,
      showContentWarning,
      quotedPost,
    };

    const publish = async () => {
      try {
        const uploaded: NewPostMedia[] = await Promise.all(
          snapshot.media.map(async (m) => ({
            url: await uploadPostMedia(user.id, m.uri, m.mimeType),
            type: m.kind,
            width: m.width,
            height: m.height,
            ...(m.durationMs != null ? { durationMs: m.durationMs } : {}),
            ...(m.altText.trim() ? { altText: m.altText.trim() } : {}),
          })),
        );
        if (snapshot.voiceNote) {
          // Web parity: the web uploader types audio files as "image" (its
          // fallback branch) and the feed detects voice posts by the .m4a
          // URL extension, so the row shape here must match.
          uploaded.push({
            url: await uploadPostMedia(user.id, snapshot.voiceNote.uri, "audio/mp4"),
            type: "image",
            width: null,
            height: null,
          });
        }

        // Single-video posts headed for Clips force type "reel" so they
        // land in the clips surface and stay out of the home feed. A quote
        // outranks both; polls and the clip destination are disabled while
        // quoting.
        const isSingleVideo = uploaded.length === 1 && uploaded[0].type === "video";
        const explicitType = snapshot.quotedPost
          ? ("quote" as const)
          : pollData
            ? ("poll" as const)
            : isSingleVideo && snapshot.videoDestination === "clip"
              ? ("reel" as const)
              : undefined;

        // NEVER call increment_post_reposts for a quote: server triggers
        // own the quote repost_count bump and the repost/quote
        // notifications, so the insert below is the whole client job.
        await createPost(user.id, snapshot.content.trim(), {
          type: explicitType,
          parentPostId: snapshot.quotedPost?.id,
          media: uploaded.length > 0 ? uploaded : undefined,
          pollData,
          scheduledAt: isScheduling ? scheduledDate.toISOString() : undefined,
          visibility: snapshot.visibility,
          contentWarning:
            snapshot.showContentWarning && snapshot.contentWarning.trim()
              ? snapshot.contentWarning.trim()
              : undefined,
          location: snapshot.location.trim() || undefined,
        });
        queryClient.invalidateQueries({ queryKey: ["feed"] });
        if (explicitType === "reel") {
          queryClient.invalidateQueries({ queryKey: ["clips"] });
        }
        if (draftId) {
          // Published, so the source draft is spent; a failed cleanup just
          // leaves a stale row the drafts screen can still delete.
          deleteDraft(draftId).catch(() => undefined);
          queryClient.invalidateQueries({ queryKey: ["post-drafts"] });
        }
      } catch (err) {
        // The screen is gone by the time the commit runs, so surface the
        // failure globally instead of the old inline error text.
        Alert.alert(
          "Post not published",
          err instanceof Error ? err.message : "The post could not be published.",
        );
      }
    };

    router.back();
    if (isScheduling) {
      void publish();
      return;
    }
    scheduleUndoableSend({
      message: "Posted",
      commit: () => void publish(),
      onUndo: () => {
        undoRestore = snapshot;
        router.push("/compose");
      },
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen
        options={{
          title: "New post",
          presentation: "modal",
          headerTitleAlign: "center",
          headerTitleStyle: { fontSize: 16, fontWeight: "700" },
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              hitSlop={8}
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.cancelLabel}>Cancel</Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showSchedule ? "Schedule post" : "Publish post"}
              disabled={!canPost}
              onPress={handlePublish}
              style={({ pressed }) => [
                styles.postPill,
                showSchedule && styles.postPillSchedule,
                pressed && { opacity: 0.85 },
                !canPost && { opacity: 0.5 },
              ]}
            >
              <Text style={styles.postPillLabel}>
                {showSchedule ? "Schedule" : "Post"}
              </Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView style={styles.fill} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.inputRow}>
          <Avatar
            url={ownProfile?.avatar_url}
            name={ownProfile?.display_name || ownProfile?.username || "You"}
            size={36}
          />
          <MentionInput
            ref={captionRef}
            value={content}
            onChangeText={setContent}
            placeholder="What is happening in your orbit?"
            placeholderTextColor={colors.textFaint}
            containerStyle={styles.inputWrap}
            style={styles.input}
            panelPlacement="below"
            multiline
            autoFocus
            maxLength={POST_MAX_LENGTH}
          />
        </View>

        {quotedPost ? (
          // Read-only echo of the post card's QuoteBox, with a remove X.
          <View style={styles.quoteBox}>
            <View style={styles.quoteAuthorRow}>
              <Avatar
                url={quotedPost.profiles.avatar_url}
                name={quotedPost.profiles.display_name}
                size={20}
              />
              <Text style={styles.quoteAuthorName} numberOfLines={1}>
                {quotedPost.profiles.display_name}
              </Text>
              {quotedPost.profiles.is_verified ? (
                <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
              ) : null}
              <Text style={styles.quoteTime}>
                · {formatTimeAgo(quotedPost.created_at)}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove quoted post"
                onPress={() => setQuotedPost(null)}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.quoteRemove,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons name="close" size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {quotedPost.content ? (
              <RichText style={styles.quoteContent} numberOfLines={4}>
                {quotedPost.content}
              </RichText>
            ) : null}
          </View>
        ) : null}

        {media.length > 0 ? (
          <View style={styles.previewGrid}>
            {media.map((m) => (
              <View
                key={m.uri}
                style={[styles.preview, media.length === 1 && styles.previewSingle]}
              >
                {m.kind === "video" ? (
                  <View style={styles.videoTile}>
                    <Ionicons name="videocam" size={28} color={colors.mutedForeground} />
                    {m.durationMs != null ? (
                      <Text style={styles.videoDuration}>{formatClock(m.durationMs)}</Text>
                    ) : null}
                  </View>
                ) : (
                  <Image
                    source={{ uri: m.uri }}
                    alt={m.altText || "Attached image preview"}
                    style={styles.previewImage}
                    contentFit="cover"
                  />
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove attachment"
                  onPress={() => removeMedia(m.uri)}
                  style={({ pressed }) => [styles.removeMedia, pressed && { opacity: 0.7 }]}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={16} color={colors.foreground} />
                </Pressable>
                {m.kind !== "video" ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Edit alt text"
                    onPress={() =>
                      setAltEditingUri(altEditingUri === m.uri ? null : m.uri)
                    }
                    style={({ pressed }) => [
                      styles.altBadge,
                      m.altText.trim().length > 0 && styles.altBadgeFilled,
                      pressed && { opacity: 0.7 },
                    ]}
                    hitSlop={8}
                  >
                    <Text
                      style={[
                        styles.altBadgeLabel,
                        m.altText.trim().length > 0 && styles.altBadgeLabelFilled,
                      ]}
                    >
                      ALT
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {altEditing ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Alt text</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setAltEditingUri(null)}
                hitSlop={8}
                style={({ pressed }) => [pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.sectionAction}>Done</Text>
              </Pressable>
            </View>
            <TextInput
              value={altEditing.altText}
              onChangeText={(text) => setAltText(altEditing.uri, text)}
              placeholder="Describe this image for people using screen readers"
              placeholderTextColor={colors.textFaint}
              style={[styles.fieldInput, styles.altInput]}
              maxLength={ALT_TEXT_MAX_LENGTH}
              multiline
              autoFocus
            />
          </View>
        ) : null}

        {singleVideo && !quotedPost ? (
          <View style={styles.destinationRow}>
            <View style={styles.destinationCopy}>
              <Text style={styles.sectionTitle}>Where does this go?</Text>
              <Text style={styles.sectionHint}>
                {videoDestination === "clip" ? "Lands in clips" : "Lands in feed"}
              </Text>
            </View>
            <View style={styles.destinationToggle}>
              {(["feed", "clip"] as const).map((option) => {
                const active = videoDestination === option;
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    onPress={() => setVideoDestination(option)}
                    style={[styles.destinationOption, active && styles.destinationOptionActive]}
                  >
                    <Text
                      style={[
                        styles.destinationOptionLabel,
                        active && styles.destinationOptionLabelActive,
                      ]}
                    >
                      {option === "feed" ? "Feed" : "Clip"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {voiceNote && !recording ? (
          <View style={styles.voiceRow}>
            <View style={styles.voiceIcon}>
              <Ionicons name="mic" size={16} color={colors.primary} />
            </View>
            <Text style={styles.voiceLabel}>Voice note</Text>
            <Text style={styles.voiceDuration}>{formatClock(voiceNote.durationMs)}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove voice note"
              onPress={() => setVoiceNote(null)}
              hitSlop={8}
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="close" size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>
        ) : null}

        {showPoll ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Poll options</Text>
              <Pressable
                accessibilityRole="button"
                onPress={togglePoll}
                hitSlop={8}
                style={({ pressed }) => [pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.sectionAction}>Remove poll</Text>
              </Pressable>
            </View>
            {pollOptions.map((option, index) => (
              <View key={index} style={styles.pollOptionRow}>
                <TextInput
                  value={option}
                  onChangeText={(text) => updatePollOption(index, text)}
                  placeholder={`Option ${index + 1}`}
                  placeholderTextColor={colors.textFaint}
                  style={[styles.fieldInput, styles.pollOptionInput]}
                  maxLength={POLL_OPTION_MAX_LENGTH}
                />
                {pollOptions.length > 2 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Remove option"
                    onPress={() => removePollOption(index)}
                    hitSlop={8}
                    style={({ pressed }) => [pressed && { opacity: 0.7 }]}
                  >
                    <Ionicons name="remove" size={18} color={colors.mutedForeground} />
                  </Pressable>
                ) : null}
              </View>
            ))}
            {pollOptions.length < POLL_MAX_OPTIONS ? (
              <Pressable
                accessibilityRole="button"
                onPress={addPollOption}
                style={({ pressed }) => [styles.addOptionRow, pressed && { opacity: 0.7 }]}
                hitSlop={8}
              >
                <Ionicons name="add" size={16} color={colors.primary} />
                <Text style={styles.addOptionLabel}>Add option</Text>
              </Pressable>
            ) : null}
            <View style={styles.pollDurationRow}>
              <Text style={styles.sectionHint}>Poll duration</Text>
              <View style={styles.pollDurationChips}>
                {POLL_DURATIONS.map(({ hours, label }) => {
                  const active = pollEndHours === hours;
                  return (
                    <Pressable
                      key={hours}
                      accessibilityRole="button"
                      onPress={() => setPollEndHours(hours)}
                      style={[styles.durationChip, active && styles.durationChipActive]}
                    >
                      <Text
                        style={[
                          styles.durationChipLabel,
                          active && styles.durationChipLabelActive,
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        ) : null}

        {showSchedule ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Schedule post</Text>
              <Pressable
                accessibilityRole="button"
                onPress={toggleSchedule}
                hitSlop={8}
                style={({ pressed }) => [pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.sectionAction}>Remove schedule</Text>
              </Pressable>
            </View>
            {Platform.OS === "ios" ? (
              <DateTimePicker
                value={scheduledDate}
                mode="datetime"
                display="compact"
                minimumDate={new Date()}
                themeVariant="dark"
                accentColor={colors.primary}
                onChange={(_event, date) => {
                  if (date) setScheduledDate(date);
                }}
              />
            ) : (
              <View style={styles.scheduleButtons}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setAndroidPickerMode("date")}
                  style={({ pressed }) => [styles.scheduleButton, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons name="calendar-outline" size={16} color={colors.mutedForeground} />
                  <Text style={styles.scheduleButtonLabel}>
                    {formatScheduleDate(scheduledDate)}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setAndroidPickerMode("time")}
                  style={({ pressed }) => [styles.scheduleButton, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons name="time-outline" size={16} color={colors.mutedForeground} />
                  <Text style={styles.scheduleButtonLabel}>
                    {formatScheduleTime(scheduledDate)}
                  </Text>
                </Pressable>
              </View>
            )}
            {androidPickerMode ? (
              <DateTimePicker
                value={scheduledDate}
                mode={androidPickerMode}
                minimumDate={new Date()}
                onChange={(event, date) => {
                  setAndroidPickerMode(null);
                  if (event.type === "set" && date) setScheduledDate(date);
                }}
              />
            ) : null}
            <Text style={styles.sectionHint}>
              Publishes {formatScheduleDate(scheduledDate)} at{" "}
              {formatScheduleTime(scheduledDate)}
            </Text>
          </View>
        ) : null}

        {showLocation ? (
          <View style={styles.fieldRow}>
            <Ionicons name="location-outline" size={16} color={colors.mutedForeground} />
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="Add location..."
              placeholderTextColor={colors.textFaint}
              style={styles.inlineFieldInput}
              maxLength={LOCATION_MAX_LENGTH}
            />
            {location.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove location"
                onPress={() => {
                  setLocation("");
                  setShowLocation(false);
                }}
                hitSlop={8}
                style={({ pressed }) => [pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="close" size={14} color={colors.mutedForeground} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {showContentWarning ? (
          <View style={[styles.fieldRow, styles.warningRow]}>
            <Ionicons name="warning-outline" size={16} color={colors.warning} />
            <TextInput
              value={contentWarning}
              onChangeText={setContentWarning}
              placeholder="Content warning (e.g., spoilers)..."
              placeholderTextColor={colors.textFaint}
              style={styles.inlineFieldInput}
              maxLength={CONTENT_WARNING_MAX_LENGTH}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove content warning"
              onPress={() => {
                setContentWarning("");
                setShowContentWarning(false);
              }}
              hitSlop={8}
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="close" size={14} color={colors.mutedForeground} />
            </Pressable>
          </View>
        ) : null}

        {visibility === "close_friends" ? (
          <View style={[styles.fieldRow, styles.closeFriendsRow]}>
            <Ionicons name="people" size={16} color={colors.success} />
            <Text style={styles.closeFriendsLabel}>Close friends only</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Set visibility to public"
              onPress={() => setVisibility("public")}
              hitSlop={8}
              style={({ pressed }) => [{ marginLeft: "auto" }, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="close" size={14} color={colors.mutedForeground} />
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
      <View style={styles.toolbar}>
        {recording ? (
          <VoiceRecordingBar
            recorder={recorder}
            onCancel={() => void finishVoiceRecording(false)}
            onSend={() => void finishVoiceRecording(true)}
            onAutoStop={() => void finishVoiceRecording(true)}
          />
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Attach photos or videos"
              onPress={pickMedia}
              disabled={media.length >= MAX_MEDIA}
              style={({ pressed }) => [
                pressed && { opacity: 0.7 },
                media.length >= MAX_MEDIA && { opacity: 0.4 },
              ]}
              hitSlop={8}
            >
              <Ionicons name="image-outline" size={24} color={colors.primary} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Record a voice note"
              onPress={() => void startVoiceRecording()}
              disabled={voiceNote !== null}
              style={({ pressed }) => [
                pressed && { opacity: 0.7 },
                voiceNote !== null && { opacity: 0.4 },
              ]}
              hitSlop={8}
            >
              <Ionicons name="mic-outline" size={24} color={colors.primary} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showPoll ? "Remove poll" : "Add poll"}
              onPress={togglePoll}
              disabled={!!quotedPost}
              style={({ pressed }) => [
                pressed && { opacity: 0.7 },
                !!quotedPost && { opacity: 0.4 },
              ]}
              hitSlop={8}
            >
              <Ionicons
                name="bar-chart-outline"
                size={22}
                color={showPoll ? colors.primary : colors.mutedForeground}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showSchedule ? "Remove schedule" : "Schedule post"}
              onPress={toggleSchedule}
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
              hitSlop={8}
            >
              <Ionicons
                name="time-outline"
                size={22}
                color={showSchedule ? colors.primary : colors.mutedForeground}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showLocation ? "Hide location" : "Add location"}
              onPress={() => setShowLocation(!showLocation)}
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
              hitSlop={8}
            >
              <Ionicons
                name="location-outline"
                size={22}
                color={showLocation || location ? colors.primary : colors.mutedForeground}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                visibility === "public" ? "Switch to close friends" : "Switch to public"
              }
              onPress={() =>
                setVisibility(visibility === "public" ? "close_friends" : "public")
              }
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
              hitSlop={8}
            >
              <Ionicons
                name={visibility === "close_friends" ? "people" : "earth"}
                size={22}
                color={visibility === "close_friends" ? colors.success : colors.mutedForeground}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                showContentWarning ? "Remove content warning" : "Add content warning"
              }
              onPress={() => {
                if (showContentWarning) setContentWarning("");
                setShowContentWarning(!showContentWarning);
              }}
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
              hitSlop={8}
            >
              <Ionicons
                name="warning-outline"
                size={22}
                color={showContentWarning ? colors.warning : colors.mutedForeground}
              />
            </Pressable>
            <MentionButton
              onPress={() => captionRef.current?.insertMentionTrigger()}
            />
            <Text style={[styles.counter, remaining <= COUNTER_WARN_THRESHOLD && { color: colors.warning }]}>
              {remaining}
            </Text>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: colors.background,
  },
  cancelLabel: {
    color: colors.foreground,
    fontSize: 15,
  },
  postPill: {
    minHeight: 32,
    paddingHorizontal: spacing(4),
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  postPillSchedule: {
    backgroundColor: colors.warning,
  },
  postPillLabel: {
    color: colors.primaryForeground,
    fontSize: 13.5,
    fontWeight: "700",
  },
  body: {
    padding: spacing(4),
    gap: spacing(4),
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing(3),
  },
  inputWrap: {
    flex: 1,
  },
  input: {
    color: colors.foreground,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 120,
    paddingTop: spacing(2),
    textAlignVertical: "top",
  },
  quoteBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing(3),
  },
  quoteAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  quoteAuthorName: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
  },
  quoteTime: {
    color: colors.mutedForeground,
    fontSize: 12,
  },
  quoteRemove: {
    marginLeft: "auto",
  },
  quoteContent: {
    color: colors.textSecondary,
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: spacing(1.5),
  },
  previewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing(2),
  },
  preview: {
    width: "48.5%",
    aspectRatio: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    backgroundColor: colors.surfaceElevated,
  },
  previewSingle: {
    width: "100%",
    aspectRatio: 4 / 3,
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  videoTile: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing(1),
  },
  videoDuration: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  removeMedia: {
    position: "absolute",
    top: spacing(2),
    right: spacing(2),
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  altBadge: {
    position: "absolute",
    bottom: spacing(2),
    left: spacing(2),
    paddingHorizontal: spacing(2),
    paddingVertical: 3,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  altBadgeFilled: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  altBadgeLabel: {
    color: colors.mutedForeground,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  altBadgeLabelFilled: {
    color: colors.primaryForeground,
  },
  section: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing(3),
    gap: spacing(2),
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "600",
  },
  sectionAction: {
    color: colors.mutedForeground,
    fontSize: 12.5,
  },
  sectionHint: {
    color: colors.mutedForeground,
    fontSize: 12,
  },
  fieldInput: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    color: colors.foreground,
    fontSize: 13.5,
  },
  altInput: {
    minHeight: 64,
    textAlignVertical: "top",
  },
  pollOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
  },
  pollOptionInput: {
    flex: 1,
  },
  addOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1),
  },
  addOptionLabel: {
    color: colors.primary,
    fontSize: 12.5,
    fontWeight: "600",
  },
  pollDurationRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing(2),
    gap: spacing(2),
  },
  pollDurationChips: {
    flexDirection: "row",
    gap: spacing(2),
  },
  durationChip: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1),
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  durationChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  durationChipLabel: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "600",
  },
  durationChipLabelActive: {
    color: colors.primaryForeground,
  },
  scheduleButtons: {
    flexDirection: "row",
    gap: spacing(2),
  },
  scheduleButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  scheduleButtonLabel: {
    color: colors.foreground,
    fontSize: 13,
  },
  destinationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing(3),
  },
  destinationCopy: {
    flex: 1,
    gap: 2,
  },
  destinationToggle: {
    flexDirection: "row",
    padding: 2,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  destinationOption: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1),
    borderRadius: radii.full,
  },
  destinationOptionActive: {
    backgroundColor: colors.primary,
  },
  destinationOptionLabel: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    fontWeight: "600",
  },
  destinationOptionLabelActive: {
    color: colors.primaryForeground,
  },
  voiceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
  },
  voiceIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceLabel: {
    flex: 1,
    color: colors.foreground,
    fontSize: 13.5,
  },
  voiceDuration: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    fontVariant: ["tabular-nums"],
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
  },
  inlineFieldInput: {
    flex: 1,
    color: colors.foreground,
    fontSize: 13.5,
    paddingVertical: 0,
  },
  warningRow: {
    borderColor: "rgba(255, 178, 36, 0.35)",
    backgroundColor: "rgba(255, 178, 36, 0.08)",
  },
  closeFriendsRow: {
    borderColor: "rgba(48, 164, 108, 0.35)",
    backgroundColor: "rgba(48, 164, 108, 0.1)",
  },
  closeFriendsLabel: {
    color: colors.success,
    fontSize: 12.5,
    fontWeight: "600",
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(4),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  counter: {
    marginLeft: "auto",
    color: colors.mutedForeground,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
});
