"use client";

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Image as ImageIcon, X, Loader2, BarChart3, Plus, Minus, Clock, MapPin, FileText, AlertTriangle, Users, Globe, Camera, Calendar, Mic } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAuth } from "@/lib/hooks/use-auth";
import { useCurrentProfile as useCurrentProfileHook } from "@/lib/hooks/use-profile";
import { useUIStore } from "@/lib/stores/ui-store";
import { createPost, uploadPostMedia, type PollData } from "@/lib/queries/posts";
import { MAX_POST_LENGTH } from "@/lib/utils/constants";
import { suggestCaptions, suggestCaptionsAI } from "@/lib/services/caption-suggestions";
import { useAudioRecorder } from "@/lib/hooks/use-audio-recorder";
import { formatDuration, generateWaveformBars, getAudioExtension } from "@/lib/utils/audio";
import { cn } from "@/lib/utils";
import { useDraftsStore } from "@/lib/stores/drafts-store";
import {
  moderateContent,
  moderateContentEnhanced,
  flagContentForReview,
} from "@/lib/services/auto-moderation";

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
const MAX_IMAGES = 4;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB for images
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB for videos

interface MediaPreview {
  file: File;
  preview: string;
  type: "image" | "video" | "gif";
}

export function PostComposer() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const composeOpen = useUIStore((s) => s.composeOpen);
  const composeCommunityId = useUIStore((s) => s.composeCommunityId);
  const composeInitialContent = useUIStore((s) => s.composeInitialContent);
  const setComposeOpen = useUIStore((s) => s.setComposeOpen);

  return (
    <Dialog open={composeOpen} onOpenChange={(open) => setComposeOpen(open)}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 border-0 bg-transparent shadow-none !max-w-[680px] sm:!max-w-[680px] w-[94vw] ring-0"
        style={{ boxShadow: "none" }}
      >
        <div className="flex flex-col max-h-[85vh] overflow-hidden rounded-2xl border border-border bg-surface-elevated text-foreground shadow-[0_24px_48px_-12px_rgba(0,0,0,0.35)]">
          <div className="px-6 pt-[18px] pb-3.5 border-b border-border">
            <div className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              NEW POST
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {user && (
              <ComposerForm
                user={user}
                communityId={composeCommunityId}
                initialContent={composeInitialContent}
                onSuccess={() => {
                  setComposeOpen(false);
                  queryClient.invalidateQueries({ queryKey: ["feed"] });
                  if (composeCommunityId) {
                    queryClient.invalidateQueries({
                      queryKey: ["community-posts", composeCommunityId],
                    });
                  }
                }}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function InlineComposer({
  replyToId,
  communityId,
  onSuccess,
}: {
  replyToId?: string;
  communityId?: string;
  onSuccess?: () => void;
}) {
  const { user } = useAuth();
  const setComposeOpen = useUIStore((s) => s.setComposeOpen);
  const { data: profile } = useCurrentProfileHook();

  if (!user) return null;

  const firstName = (profile?.display_name || "").split(" ")[0];

  const open = (action: "photo" | "voice" | "event" | "place" | null) =>
    setComposeOpen(true, { communityId, action: action ?? undefined });

  const CHIPS: {
    Ico: typeof Camera;
    label: string;
    action: "photo" | "voice" | "event" | "place";
  }[] = [
    { Ico: Camera, label: "photo", action: "photo" },
    { Ico: Calendar, label: "event", action: "event" },
    { Ico: Mic, label: "voice", action: "voice" },
    { Ico: MapPin, label: "place", action: "place" },
  ];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => open(null)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open(null);
        }
      }}
      className="flex items-center gap-3.5 w-full p-[18px] rounded-xl border border-border bg-surface text-foreground text-left cursor-pointer"
    >
      <UserAvatar
        src={profile?.avatar_url}
        fallback={profile?.display_name || "U"}
        size="md"
      />
      <div className="flex-1 min-w-0 text-[15px] text-muted-foreground">
        What&apos;s{" "}
        <em className="not-italic text-primary pr-[0.04em]">
          orbiting
        </em>{" "}
        you{firstName ? `, ${firstName}` : ""}?
      </div>
      <div className="hidden sm:flex gap-1.5">
        {CHIPS.map(({ Ico, label, action }) => (
          <button
            key={label}
            type="button"
            title={label}
            aria-label={label}
            onClick={(e) => {
              e.stopPropagation();
              open(action);
            }}
            className="h-9 w-9 flex items-center justify-center rounded-lg border border-border bg-surface p-0 text-text-secondary cursor-pointer"
          >
            <Ico className="h-4 w-4" strokeWidth={1.8} />
          </button>
        ))}
      </div>
    </div>
  );
}

function ComposerForm({
  user,
  replyToId,
  communityId,
  initialContent,
  onSuccess,
  inline = false,
}: {
  user: { id: string; user_metadata: Record<string, string> };
  replyToId?: string;
  communityId?: string;
  initialContent?: string;
  onSuccess?: () => void;
  inline?: boolean;
}) {
  const [content, setContent] = useState(initialContent ?? "");
  const [media, setMedia] = useState<MediaPreview[]>([]);
  const [posting, setPosting] = useState(false);
  const [location, setLocation] = useState("");
  const [showLocation, setShowLocation] = useState(false);
  // When a video is the only attachment, the user picks where it goes:
  // Feed (regular video, plays inline) or Clip (vertical 9:16, lives in
  // the Clips tab). Default is set when the video is added based on its
  // intrinsic aspect ratio (portrait → clip, landscape → feed).
  const [videoDestination, setVideoDestination] = useState<"feed" | "clip">("feed");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioFileInputRef = useRef<HTMLInputElement>(null);
  const { saveDraft } = useDraftsStore();

  // Audio recording
  const {
    isRecording: isAudioRecording,
    duration: audioDuration,
    audioBlob,
    audioUrl: audioPreviewUrl,
    error: audioError,
    startRecording: startAudioRecording,
    stopRecording: stopAudioRecording,
    cancelRecording: cancelAudioRecording,
    discardRecording: discardAudioRecording,
  } = useAudioRecorder();

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioFileUrl, setAudioFileUrl] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const [audioWaveform] = useState(() => generateWaveformBars(32));
  // True when the user clicked the inline Mic icon and we want to show
  // a "Tap to start recording" prompt, recording itself starts only
  // when the user explicitly taps the Start button.
  const [voiceArmed, setVoiceArmed] = useState(false);

  // Schedule state
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");

  // Poll state
  const [showPoll, setShowPoll] = useState(false);
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollEndHours, setPollEndHours] = useState(24);

  // Visibility state
  const [visibility, setVisibility] = useState<"public" | "close_friends">("public");

  // Content warning state
  const [contentWarning, setContentWarning] = useState("");
  const [showContentWarning, setShowContentWarning] = useState(false);

  const hasAudio = !!(audioBlob || audioFile);
  const currentAudioUrl = audioPreviewUrl || audioFileUrl;

  const validPollOptions = pollOptions.filter((o) => o.trim().length > 0);
  const isPollValid = !showPoll || validPollOptions.length >= 2;

  const charCount = content.length;
  const isOverLimit = charCount > MAX_POST_LENGTH;
  const canPost = (content.trim().length > 0 || media.length > 0 || hasAudio || (showPoll && isPollValid)) && !isOverLimit && isPollValid;

  const addPollOption = () => {
    if (pollOptions.length < 4) setPollOptions([...pollOptions, ""]);
  };

  const removePollOption = (index: number) => {
    if (pollOptions.length <= 2) return;
    setPollOptions(pollOptions.filter((_, i) => i !== index));
  };

  const updatePollOption = (index: number, value: string) => {
    setPollOptions(pollOptions.map((opt, i) => (i === index ? value : opt)));
  };

  const togglePoll = () => {
    setShowPoll(!showPoll);
    if (showPoll) {
      setPollOptions(["", ""]);
      setPollEndHours(24);
    }
  };

  const handleAudioFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("audio/")) {
      toast.error("Please select an audio file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Audio file must be under 10MB");
      return;
    }

    setAudioFile(file);
    setAudioFileUrl(URL.createObjectURL(file));
    if (audioFileInputRef.current) audioFileInputRef.current.value = "";
  };

  const clearAudio = useCallback(() => {
    discardAudioRecording();
    if (audioFileUrl) URL.revokeObjectURL(audioFileUrl);
    setAudioFile(null);
    setAudioFileUrl(null);
    setIsAudioPlaying(false);
  }, [discardAudioRecording, audioFileUrl]);

  const toggleAudioPlayback = useCallback(() => {
    if (!audioPlayerRef.current) return;
    if (isAudioPlaying) {
      audioPlayerRef.current.pause();
      setIsAudioPlaying(false);
    } else {
      audioPlayerRef.current.play();
      setIsAudioPlaying(true);
    }
  }, [isAudioPlaying]);

  // Caption suggestions: when media is attached and the textarea is empty,
  // ask Claude Haiku (vision) to suggest 3 captions based on the actual
  // image/first-frame-of-video. Falls back to the local heuristic on
  // failure or when the AI gateway isn't configured.
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const lastSuggestedFor = useRef<string | null>(null);

  useEffect(() => {
    if (content.length > 0 || media.length === 0) {
      setAiSuggestions([]);
      return;
    }
    const target = media[0];
    if (!target) return;
    // Key by file identity so we don't re-call the API on every render.
    const key = `${target.file.name}:${target.file.size}:${target.file.lastModified}`;
    if (lastSuggestedFor.current === key) return;
    lastSuggestedFor.current = key;

    let cancelled = false;
    suggestCaptionsAI(target.file, target.type === "video")
      .then((captions) => {
        if (!cancelled) setAiSuggestions(captions);
      })
      .catch(() => {
        // Silent fall-through to the heuristic pool below.
      });
    return () => {
      cancelled = true;
    };
  }, [content.length, media]);

  const captionSuggestions = useMemo(() => {
    if (content.length > 0 || media.length === 0) return [];
    if (aiSuggestions.length > 0) return aiSuggestions;
    const hasImage = media.some((m) => m.type === "image" || m.type === "gif");
    const hasVideo = media.some((m) => m.type === "video");
    return suggestCaptions({
      hasImage,
      hasVideo,
      time: new Date().toISOString(),
    });
  }, [content.length, media, aiSuggestions]);

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    for (const file of files) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type) && !file.type.startsWith("video/")) {
        toast.error("Unsupported file type");
        continue;
      }
      const isVideo = file.type.startsWith("video/");
      const limit = isVideo ? MAX_VIDEO_SIZE : MAX_FILE_SIZE;
      if (file.size > limit) {
        toast.error(
          isVideo ? "Video must be under 100MB" : "Image must be under 10MB",
        );
        continue;
      }
      if (media.length >= MAX_IMAGES) {
        toast.error(`Maximum ${MAX_IMAGES} images`);
        break;
      }

      const preview = URL.createObjectURL(file);
      const type = file.type.startsWith("video/")
        ? "video"
        : file.type === "image/gif"
          ? "gif"
          : "image";

      setMedia((prev) => [...prev, { file, preview, type }]);

      // Probe video aspect to seed the default destination.
      if (type === "video") {
        const probe = document.createElement("video");
        probe.preload = "metadata";
        probe.src = preview;
        probe.onloadedmetadata = () => {
          const portrait = probe.videoHeight > probe.videoWidth;
          setVideoDestination(portrait ? "clip" : "feed");
        };
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeMedia = (index: number) => {
    setMedia((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const [moderationWarning, setModerationWarning] = useState<string | null>(null);
  const [moderationConfirmed, setModerationConfirmed] = useState(false);

  const consumeComposeAction = useUIStore((s) => s.consumeComposeAction);
  useEffect(() => {
    const action = consumeComposeAction();
    if (!action) return;
    if (action === "photo") {
      fileInputRef.current?.click();
    } else if (action === "event") {
      setShowSchedule(true);
    } else if (action === "place") {
      setShowLocation(true);
    } else if (action === "voice") {
      // Show a "ready to record" prompt instead of auto-starting the
      // mic. The user taps Start to actually begin capturing audio.
      setVoiceArmed(true);
    }
  }, [consumeComposeAction]);

  const submittingRef = useRef(false);
  const handleSubmit = async () => {
    if (!canPost || posting || submittingRef.current) return;
    // Synchronous lock, flips before the async moderation roundtrip
    // so spam-clicking through perceived lag can't queue parallel
    // submissions. The `posting` state is the visual signal, but the
    // ref is what actually prevents re-entry inside the same render.
    submittingRef.current = true;
    setPosting(true);

    // Auto-moderation check (regex pre-filter + LLM for borderline content)
    if (content.trim() && !moderationConfirmed) {
      const result = await moderateContentEnhanced(content.trim());
      if (result.flagged) {
        if (result.severity === "high") {
          toast.error(result.reason || "Content violates community guidelines");
          setModerationWarning(result.reason || "Content may violate guidelines");
          setPosting(false);
          submittingRef.current = false;
          return;
        }
        if (result.severity === "medium" || result.severity === "low") {
          setModerationWarning(result.reason || "Content may violate guidelines");
          setPosting(false);
          submittingRef.current = false;
          return;
        }
      }
    }

    setModerationWarning(null);
    setModerationConfirmed(false);

    try {
      // Flag high-severity content for admin review
      const modResult = content.trim() ? moderateContent(content.trim()) : null;

      // Upload media files
      const uploadedMedia = await Promise.all(
        media.map((m) => uploadPostMedia(user.id, m.file))
      );

      // Upload audio if present
      if (hasAudio) {
        const audioToUpload = audioBlob || audioFile;
        if (audioToUpload) {
          const ext = audioFile
            ? audioFile.name.split(".").pop() || "webm"
            : getAudioExtension();
          const audioFileName = `audio_${Date.now()}.${ext}`;
          const audioFileObj =
            audioToUpload instanceof File
              ? audioToUpload
              : new File([audioToUpload], audioFileName, {
                  type: audioToUpload.type,
                });
          const uploaded = await uploadPostMedia(user.id, audioFileObj);
          uploadedMedia.push(uploaded);
        }
      }

      // Build poll data if poll is active
      const pollData: PollData | undefined = showPoll && isPollValid
        ? {
            options: validPollOptions.map((text) => ({ text: text.trim(), votes: 0 })),
            ends_at: new Date(Date.now() + pollEndHours * 60 * 60 * 1000).toISOString(),
            multi_select: false,
          }
        : undefined;

      const isScheduling = showSchedule && scheduledAt;
      const scheduledDate = isScheduling ? new Date(scheduledAt) : null;

      if (scheduledDate && scheduledDate <= new Date()) {
        toast.error("Please pick a future date and time");
        setPosting(false);
        submittingRef.current = false;
        return;
      }

      // Single-video posts: if user picked Clip, force type='reel' so the
      // post lands in /clips and stays out of the home feed.
      const isSingleVideo =
        uploadedMedia.length === 1 && uploadedMedia[0].type === "video";
      const explicitType: "poll" | "reel" | undefined = pollData
        ? "poll"
        : isSingleVideo && videoDestination === "clip"
          ? "reel"
          : undefined;

      const createdPost = await createPost(
        user.id,
        { content: content.trim() },
        uploadedMedia,
        {
          replyToId,
          type: explicitType,
          pollData,
          scheduledAt: scheduledDate ? scheduledDate.toISOString() : undefined,
          location: location.trim() || undefined,
          visibility,
          contentWarning: showContentWarning && contentWarning.trim() ? contentWarning.trim() : undefined,
          communityId,
        }
      );

      // Auto-flag high severity content for admin review
      if (modResult && modResult.flagged && modResult.severity === "high" && createdPost?.id) {
        try {
          await flagContentForReview(
            createdPost.id,
            user.id,
            modResult.reason || "Auto-flagged content",
            modResult.severity
          );
        } catch {
          // Non-blocking
        }
      }

      setContent("");
      media.forEach((m) => URL.revokeObjectURL(m.preview));
      setMedia([]);
      clearAudio();
      setShowPoll(false);
      setPollOptions(["", ""]);
      setPollEndHours(24);
      setShowSchedule(false);
      setScheduledAt("");
      setLocation("");
      setShowLocation(false);
      setVisibility("public");
      setContentWarning("");
      setShowContentWarning(false);
      toast.success(
        isScheduling
          ? "Post scheduled"
          : replyToId
            ? "Reply posted"
            : "Post created"
      );
      onSuccess?.();
    } catch {
      toast.error("Failed to create post");
    } finally {
      setPosting(false);
      submittingRef.current = false;
    }
  };

  return (
    <div>
      <div className="flex gap-4 p-4">
        <UserAvatar
          src={user.user_metadata?.avatar_url}
          fallback={user.user_metadata?.display_name || user.user_metadata?.email || "U"}
          size="sm"
        />

        <div className="flex-1 min-w-0 pl-1">
          <Textarea
            placeholder={replyToId ? "Write a reply..." : "Write a caption..."}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="border-none bg-transparent resize-none p-0 pt-1.5 text-sm text-foreground placeholder:text-text-faint focus-visible:ring-0 focus-visible:border-none min-h-[60px]"
            rows={inline ? 2 : 3}
          />

          {/* Media Previews */}
          <AnimatePresence>
            {media.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className={`grid gap-1 mt-3 ${
                  media.length === 1
                    ? "grid-cols-1"
                    : "grid-cols-2"
                }`}
              >
                {media.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                    className={`relative group/media overflow-hidden rounded-xl ${
                      media.length === 3 && i === 0 ? "row-span-2" : ""
                    } ${media.length === 1 ? "bg-black/55" : ""}`}
                  >
                    {m.type === "video" ? (
                      <video
                        src={m.preview}
                        muted
                        playsInline
                        controls
                        className={
                          media.length === 1
                            ? "w-full max-h-[520px] mx-auto block object-contain bg-black"
                            : "w-full h-full object-cover max-h-[300px] bg-black"
                        }
                      />
                    ) : (
                      <img
                        src={m.preview}
                        alt=""
                        className={
                          media.length === 1
                            ? "w-full max-h-[520px] mx-auto block object-contain"
                            : "w-full h-full object-cover max-h-[300px]"
                        }
                      />
                    )}
                    <button
                      onClick={() => removeMedia(i)}
                      aria-label="Remove media"
                      className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center bg-black/60 hover:bg-black/80 rounded-full opacity-0 group-hover/media:opacity-100 transition-all"
                    >
                      <X className="h-3.5 w-3.5 text-white" />
                    </button>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Feed / Clip destination toggle, only for single-video posts.
              Defaulted to Clip for portrait video, Feed for landscape. */}
          {media.length === 1 && media[0].type === "video" && (
            <div className="mt-4 flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-border bg-surface">
              <div className="flex flex-col">
                <span className="text-[13px] font-semibold text-foreground">
                  Where does this go?
                </span>
                <span className="mt-0.5 text-[11.5px] text-muted-foreground">
                  {videoDestination === "clip" ? "Lands in clips" : "Lands in feed"}
                </span>
              </div>
              <div className="inline-flex p-0.5 rounded-full shrink-0 border border-border bg-surface-elevated">
                {(["feed", "clip"] as const).map((opt) => {
                  const active = videoDestination === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setVideoDestination(opt)}
                      className={cn(
                        "px-4 py-1.5 rounded-full border-0 text-xs font-semibold tracking-[0.01em] cursor-pointer transition-colors",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-transparent text-text-secondary"
                      )}
                    >
                      {opt === "feed" ? "Feed" : "Clip"}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Voice 'armed' prompt, appears after the user clicks the
              inline Mic on the feed. Mic is selected, not recording yet.
              Tap Start to actually begin capture. */}
          <AnimatePresence>
            {voiceArmed && !isAudioRecording && !hasAudio && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-3"
              >
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface border border-border">
                  <div className="h-9 w-9 rounded-full bg-destructive/15 border border-destructive/30 flex items-center justify-center">
                    <Mic className="h-4 w-4 text-destructive" />
                  </div>
                  <span className="text-sm text-foreground">
                    Tap start to record a voice post
                  </span>
                  <button
                    onClick={() => {
                      setVoiceArmed(false);
                      startAudioRecording();
                    }}
                    className="ml-auto px-4 h-9 rounded-lg bg-destructive hover:bg-destructive/90 text-white text-sm font-semibold transition-colors"
                  >
                    Start
                  </button>
                  <button
                    onClick={() => setVoiceArmed(false)}
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors"
                    title="Cancel"
                    aria-label="Cancel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Audio Recording UI */}
          <AnimatePresence>
            {isAudioRecording && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-3"
              >
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20">
                  <div className="relative shrink-0">
                    <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
                    <div className="absolute inset-0 h-3 w-3 rounded-full bg-destructive animate-ping opacity-30" />
                  </div>
                  <span className="text-sm text-destructive">Recording...</span>
                  <span className="text-sm font-mono text-destructive tabular-nums ml-auto">
                    {formatDuration(audioDuration)}
                  </span>
                  <button
                    onClick={stopAudioRecording}
                    className="h-8 w-8 flex items-center justify-center rounded-lg bg-destructive hover:bg-destructive/90 text-white transition-colors"
                    title="Stop recording"
                    aria-label="Stop recording"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
                      <rect x="6" y="6" width="8" height="8" rx="1" />
                    </svg>
                  </button>
                  <button
                    onClick={cancelAudioRecording}
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors"
                    title="Cancel"
                    aria-label="Cancel recording"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Audio Preview */}
          <AnimatePresence>
            {hasAudio && !isAudioRecording && currentAudioUrl && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-3"
              >
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-elevated border border-border">
                  <audio
                    ref={audioPlayerRef}
                    src={currentAudioUrl}
                    onEnded={() => setIsAudioPlaying(false)}
                  />
                  <button
                    onClick={toggleAudioPlayback}
                    aria-label={isAudioPlaying ? "Pause audio" : "Play audio"}
                    className="shrink-0 h-9 w-9 flex items-center justify-center rounded-full bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
                  >
                    {isAudioPlaying ? (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
                        <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zM12.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 ml-0.5">
                        <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                      </svg>
                    )}
                  </button>

                  {/* Mini waveform */}
                  <div className="flex items-center gap-[2px] flex-1 h-6">
                    {audioWaveform.map((height, i) => (
                      <div
                        key={i}
                        className="w-[3px] rounded-full bg-primary/40"
                        style={{ height: `${height * 100}%` }}
                      />
                    ))}
                  </div>

                  <span className="text-xs text-muted-foreground font-mono tabular-nums shrink-0">
                    {audioBlob
                      ? formatDuration(audioDuration)
                      : "Audio"}
                  </span>

                  <button
                    onClick={clearAudio}
                    aria-label="Remove audio"
                    className="shrink-0 h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Audio error */}
          {audioError && (
            <div className="mt-2 text-xs text-destructive flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="size-3.5 shrink-0">
                <path fillRule="evenodd" d="M8 15A7 7 0 108 1a7 7 0 000 14zm.75-10.25a.75.75 0 00-1.5 0v4.5a.75.75 0 001.5 0v-4.5zM8 12a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
              </svg>
              {audioError}
            </div>
          )}

          {/* Caption suggestion chips */}
          <AnimatePresence>
            {captionSuggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.2 }}
                className="flex flex-wrap gap-1.5 mt-2"
              >
                {captionSuggestions.map((caption, i) => (
                  <motion.button
                    key={caption}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.15, delay: i * 0.05 }}
                    type="button"
                    onClick={() => setContent(caption)}
                    className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-surface text-muted-foreground border border-border hover:bg-surface-elevated hover:text-foreground transition-colors"
                  >
                    {caption}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Poll Creation UI */}
          <AnimatePresence>
            {showPoll && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-3"
              >
                <div className="rounded-xl border border-border bg-surface p-3 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] font-medium text-text-secondary">Poll options</span>
                    <button
                      onClick={togglePoll}
                      className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Remove poll
                    </button>
                  </div>

                  {pollOptions.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => updatePollOption(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                        maxLength={50}
                        className="flex-1 h-9 px-3 rounded-lg text-[13px] bg-surface-elevated border border-input text-foreground placeholder:text-text-faint focus:outline-none focus:border-primary/50 transition-colors"
                      />
                      {pollOptions.length > 2 && (
                        <button
                          onClick={() => removePollOption(index)}
                          aria-label="Remove option"
                          className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}

                  {pollOptions.length < 4 && (
                    <button
                      onClick={addPollOption}
                      className="flex items-center gap-1.5 text-[12px] text-primary hover:text-primary/80 transition-colors mt-1"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add option
                    </button>
                  )}

                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <span className="text-[12px] text-muted-foreground">Poll duration:</span>
                    <select
                      value={pollEndHours}
                      onChange={(e) => setPollEndHours(Number(e.target.value))}
                      className="h-7 px-2 rounded-lg text-[12px] bg-surface-elevated border border-input text-text-secondary focus:outline-none focus:border-primary/50"
                    >
                      <option value={1}>1 hour</option>
                      <option value={6}>6 hours</option>
                      <option value={12}>12 hours</option>
                      <option value={24}>1 day</option>
                      <option value={72}>3 days</option>
                      <option value={168}>7 days</option>
                    </select>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Schedule UI */}
          <AnimatePresence>
            {showSchedule && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-3"
              >
                <div className="rounded-xl border border-border bg-surface p-3 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] font-medium text-text-secondary">Schedule post</span>
                    <button
                      onClick={() => {
                        setShowSchedule(false);
                        setScheduledAt("");
                      }}
                      className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Remove schedule
                    </button>
                  </div>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full h-9 px-3 rounded-lg text-[13px] bg-surface-elevated border border-input text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                  />
                  {scheduledAt && (
                    <p className="text-[11px] text-muted-foreground">
                      Will be published on{" "}
                      {new Date(scheduledAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Location Input */}
      <AnimatePresence>
        {showLocation && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="px-4 pb-2"
          >
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Add location..."
                maxLength={100}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-text-faint focus:outline-none"
              />
              {location && (
                <button
                  onClick={() => { setLocation(""); setShowLocation(false); }}
                  aria-label="Remove location"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content Warning Input */}
      <AnimatePresence>
        {showContentWarning && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="px-4 pb-2"
          >
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/5 border border-warning/20">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
              <input
                type="text"
                value={contentWarning}
                onChange={(e) => setContentWarning(e.target.value)}
                placeholder="Content warning (e.g., spoilers, sensitive content)..."
                maxLength={100}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-text-faint focus:outline-none"
              />
              <button
                onClick={() => { setContentWarning(""); setShowContentWarning(false); }}
                aria-label="Remove content warning"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Visibility Indicator */}
      {visibility === "close_friends" && (
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-success/10 border border-success/20">
            <Users className="h-3.5 w-3.5 text-success" />
            <span className="text-[12px] font-medium text-success">Close Friends only</span>
            <button
              onClick={() => setVisibility("public")}
              aria-label="Set visibility to public"
              className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Moderation Warning */}
      {moderationWarning && (
        <div className="mx-4 mb-2 rounded-xl bg-warning/10 border border-warning/20 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="size-4 text-warning shrink-0">
              <path fillRule="evenodd" d="M6.701 2.25c.577-1 2.02-1 2.598 0l5.196 9a1.5 1.5 0 0 1-1.299 2.25H2.804a1.5 1.5 0 0 1-1.3-2.25l5.197-9ZM8 5a.75.75 0 0 1 .75.75v2.5a.75.75 0 0 1-1.5 0v-2.5A.75.75 0 0 1 8 5Zm0 6.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
            </svg>
            <p className="text-xs text-warning font-medium">{moderationWarning}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setModerationConfirmed(true);
                setModerationWarning(null);
              }}
              className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-warning/20 text-warning hover:bg-warning/30 transition-colors"
            >
              Post anyway
            </button>
            <button
              onClick={() => setModerationWarning(null)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors"
            >
              Edit content
            </button>
          </div>
        </div>
      )}

      {/* Actions Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-t border-border">
        <div className="flex items-center gap-1 flex-wrap min-w-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,video/x-m4v,video/*"
            multiple
            onChange={handleMediaSelect}
            className="hidden"
          />
          <button
            className="h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none"
            onClick={() => fileInputRef.current?.click()}
            disabled={media.length >= MAX_IMAGES}
            title="Add photo"
            aria-label="Add photo"
          >
            <ImageIcon className="h-5 w-5" />
          </button>
          {/* Audio record / upload */}
          <input
            ref={audioFileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleAudioFileSelect}
            className="hidden"
          />
          <button
            className={cn(
              "h-9 w-9 flex items-center justify-center rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none",
              isAudioRecording
                ? "text-destructive hover:text-destructive/80"
                : hasAudio
                  ? "text-primary hover:text-primary/80"
                  : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => {
              if (isAudioRecording) {
                stopAudioRecording();
              } else if (hasAudio) {
                // Already have audio, do nothing
              } else {
                startAudioRecording();
              }
            }}
            disabled={media.length > 0 && hasAudio}
            title={isAudioRecording ? "Stop recording" : hasAudio ? "Audio attached" : "Record audio"}
            aria-label={isAudioRecording ? "Stop recording" : hasAudio ? "Audio attached" : "Record audio"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
              <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
            </svg>
          </button>
          <button
            className={cn(
              "h-9 w-9 flex items-center justify-center rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none",
              showPoll
                ? "text-primary hover:text-primary/80"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={togglePoll}
            title={showPoll ? "Remove poll" : "Add poll"}
            aria-label={showPoll ? "Remove poll" : "Add poll"}
          >
            <BarChart3 className="h-5 w-5" />
          </button>
          <button
            className={cn(
              "h-9 w-9 flex items-center justify-center rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none",
              showSchedule
                ? "text-primary hover:text-primary/80"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => {
              setShowSchedule(!showSchedule);
              if (showSchedule) setScheduledAt("");
            }}
            title={showSchedule ? "Remove schedule" : "Schedule post"}
            aria-label={showSchedule ? "Remove schedule" : "Schedule post"}
          >
            <Clock className="h-5 w-5" />
          </button>
          <button
            className={cn(
              "h-9 w-9 flex items-center justify-center rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none",
              showLocation || location
                ? "text-primary hover:text-primary/80"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setShowLocation(!showLocation)}
            title={showLocation ? "Hide location" : "Add location"}
            aria-label={showLocation ? "Hide location" : "Add location"}
          >
            <MapPin className="h-5 w-5" />
          </button>
          <button
            className="h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none"
            onClick={() => {
              if (!content.trim() && media.length === 0) {
                toast.error("Nothing to save as draft");
                return;
              }
              saveDraft(
                content,
                media.map((m) => ({ preview: m.preview, type: m.type })),
                location || undefined
              );
              toast.success("Draft saved");
            }}
            title="Save as draft"
            aria-label="Save as draft"
          >
            <FileText className="h-5 w-5" />
          </button>
          {/* Visibility toggle */}
          <button
            className={cn(
              "h-9 w-9 flex items-center justify-center rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none",
              visibility === "close_friends"
                ? "text-success hover:text-success/80"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setVisibility(visibility === "public" ? "close_friends" : "public")}
            title={visibility === "public" ? "Switch to Close Friends" : "Switch to Public"}
            aria-label={visibility === "public" ? "Switch to Close Friends" : "Switch to Public"}
          >
            {visibility === "close_friends" ? (
              <Users className="h-5 w-5" />
            ) : (
              <Globe className="h-5 w-5" />
            )}
          </button>
          {/* Content warning toggle */}
          <button
            className={cn(
              "h-9 w-9 flex items-center justify-center rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none",
              showContentWarning
                ? "text-warning hover:text-warning/80"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => {
              setShowContentWarning(!showContentWarning);
              if (showContentWarning) setContentWarning("");
            }}
            title={showContentWarning ? "Remove content warning" : "Add content warning"}
            aria-label={showContentWarning ? "Remove content warning" : "Add content warning"}
          >
            <AlertTriangle className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          {content.length > 0 && (
            <span
              className={`text-xs font-medium ${
                isOverLimit
                  ? "text-destructive"
                  : charCount > MAX_POST_LENGTH * 0.8
                    ? "text-warning"
                    : "text-text-faint"
              }`}
            >
              {charCount}/{MAX_POST_LENGTH}
            </span>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canPost || posting || (showSchedule && !scheduledAt)}
            className={cn(
              "inline-flex items-center gap-1.5 px-[22px] py-2.5 rounded-lg border-0 cursor-pointer text-[13px] font-semibold text-primary-foreground transition-[opacity,transform] duration-150 disabled:opacity-45 hover:enabled:scale-[1.02] active:enabled:scale-[0.98]",
              showSchedule && scheduledAt ? "bg-warning" : "bg-primary"
            )}
          >
            {posting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : showSchedule && scheduledAt ? (
              <>
                <Clock className="h-3.5 w-3.5" />
                Schedule
              </>
            ) : replyToId ? (
              "Reply"
            ) : (
              "Post"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
