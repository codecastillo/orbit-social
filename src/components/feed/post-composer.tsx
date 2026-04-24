"use client";

import { useState, useRef, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Image as ImageIcon, X, Loader2, BarChart3, Smile, Plus, Minus } from "lucide-react";
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
import { suggestCaptions } from "@/lib/services/caption-suggestions";
import { useAudioRecorder } from "@/lib/hooks/use-audio-recorder";
import { formatDuration, generateWaveformBars, getAudioExtension } from "@/lib/utils/audio";
import { cn } from "@/lib/utils";

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
const MAX_IMAGES = 4;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface MediaPreview {
  file: File;
  preview: string;
  type: "image" | "video" | "gif";
}

export function PostComposer() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const composeOpen = useUIStore((s) => s.composeOpen);
  const setComposeOpen = useUIStore((s) => s.setComposeOpen);

  return (
    <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
      <DialogContent className="sm:max-w-[520px] p-0 gap-0 bg-zinc-900 border-white/[0.1] rounded-xl overflow-hidden shadow-2xl">
        <div className="text-center py-3 border-b border-white/[0.06]">
          <span className="text-sm font-semibold text-zinc-100">Create new post</span>
        </div>
        {user && (
          <ComposerForm
            user={user}
            onSuccess={() => {
              setComposeOpen(false);
              queryClient.invalidateQueries({ queryKey: ["feed"] });
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

export function InlineComposer({
  replyToId,
  onSuccess,
}: {
  replyToId?: string;
  onSuccess?: () => void;
}) {
  const { user } = useAuth();
  const setComposeOpen = useUIStore((s) => s.setComposeOpen);

  const { data: profile } = useCurrentProfileHook();

  if (!user) return null;

  return (
    <div className="border-b border-white/[0.06]">
      <button
        onClick={() => setComposeOpen(true)}
        className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
      >
        <UserAvatar
          src={profile?.avatar_url}
          fallback={profile?.display_name || "U"}
          size="sm"
        />
        <span className="text-sm text-zinc-500">Share something...</span>
      </button>
    </div>
  );
}

function ComposerForm({
  user,
  replyToId,
  onSuccess,
  inline = false,
}: {
  user: { id: string; user_metadata: Record<string, string> };
  replyToId?: string;
  onSuccess?: () => void;
  inline?: boolean;
}) {
  const [content, setContent] = useState("");
  const [media, setMedia] = useState<MediaPreview[]>([]);
  const [posting, setPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioFileInputRef = useRef<HTMLInputElement>(null);

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

  // Poll state
  const [showPoll, setShowPoll] = useState(false);
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollEndHours, setPollEndHours] = useState(24);

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

  // Caption suggestions — shown when textarea is empty and media is attached
  const captionSuggestions = useMemo(() => {
    if (content.length > 0 || media.length === 0) return [];
    const hasImage = media.some((m) => m.type === "image" || m.type === "gif");
    const hasVideo = media.some((m) => m.type === "video");
    return suggestCaptions({
      hasImage,
      hasVideo,
      time: new Date().toISOString(),
    });
  }, [content.length, media]);

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    for (const file of files) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type) && !file.type.startsWith("video/")) {
        toast.error("Unsupported file type");
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error("File must be under 10MB");
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
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeMedia = (index: number) => {
    setMedia((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async () => {
    if (!canPost || posting) return;
    setPosting(true);

    try {
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

      await createPost(
        user.id,
        { content: content.trim() },
        uploadedMedia,
        {
          replyToId,
          type: pollData ? "poll" : undefined,
          pollData,
        }
      );

      setContent("");
      media.forEach((m) => URL.revokeObjectURL(m.preview));
      setMedia([]);
      clearAudio();
      setShowPoll(false);
      setPollOptions(["", ""]);
      setPollEndHours(24);
      toast.success(replyToId ? "Reply posted" : "Post created");
      onSuccess?.();
    } catch {
      toast.error("Failed to create post");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div>
      <div className="flex gap-3 p-4">
        <UserAvatar
          src={user.user_metadata?.avatar_url}
          fallback={user.user_metadata?.display_name || user.user_metadata?.email || "U"}
          size="sm"
        />

        <div className="flex-1 min-w-0">
          <Textarea
            placeholder={replyToId ? "Write a reply..." : "Write a caption..."}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="border-none bg-transparent resize-none p-0 text-sm text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-0 focus-visible:border-none min-h-[60px]"
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
                    className={`relative group/media overflow-hidden ${
                      media.length === 3 && i === 0 ? "row-span-2" : ""
                    }`}
                  >
                    <img
                      src={m.preview}
                      alt=""
                      className="w-full h-full object-cover max-h-[300px]"
                    />
                    <button
                      onClick={() => removeMedia(i)}
                      className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center bg-black/60 backdrop-blur-sm hover:bg-black/80 rounded-full opacity-0 group-hover/media:opacity-100 transition-all"
                    >
                      <X className="h-3.5 w-3.5 text-white" />
                    </button>
                  </motion.div>
                ))}
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
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <div className="relative shrink-0">
                    <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                    <div className="absolute inset-0 h-3 w-3 rounded-full bg-red-500 animate-ping opacity-30" />
                  </div>
                  <span className="text-sm text-red-400">Recording...</span>
                  <span className="text-sm font-mono text-red-400 tabular-nums ml-auto">
                    {formatDuration(audioDuration)}
                  </span>
                  <button
                    onClick={stopAudioRecording}
                    className="h-8 w-8 flex items-center justify-center rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors"
                    title="Stop recording"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
                      <rect x="6" y="6" width="8" height="8" rx="1" />
                    </svg>
                  </button>
                  <button
                    onClick={cancelAudioRecording}
                    className="h-8 w-8 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
                    title="Cancel"
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
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-800/60 border border-white/[0.06]">
                  <audio
                    ref={audioPlayerRef}
                    src={currentAudioUrl}
                    onEnded={() => setIsAudioPlaying(false)}
                  />
                  <button
                    onClick={toggleAudioPlayback}
                    className="shrink-0 h-9 w-9 flex items-center justify-center rounded-full bg-blue-500 hover:bg-blue-600 text-white transition-colors"
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
                        className="w-[3px] rounded-full bg-blue-500/40"
                        style={{ height: `${height * 100}%` }}
                      />
                    ))}
                  </div>

                  <span className="text-xs text-zinc-400 font-mono tabular-nums shrink-0">
                    {audioBlob
                      ? formatDuration(audioDuration)
                      : "Audio"}
                  </span>

                  <button
                    onClick={clearAudio}
                    className="shrink-0 h-7 w-7 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Audio error */}
          {audioError && (
            <div className="mt-2 text-xs text-red-400 flex items-center gap-1.5">
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
                    className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/[0.06] text-zinc-400 border border-white/[0.08] hover:bg-white/[0.1] hover:text-zinc-200 transition-colors"
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
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] font-medium text-zinc-300">Poll options</span>
                    <button
                      onClick={togglePoll}
                      className="text-[12px] text-muted-foreground hover:text-white transition-colors"
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
                        className="flex-1 h-9 px-3 rounded-lg text-[13px] bg-white/[0.04] border border-white/[0.1] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                      />
                      {pollOptions.length > 2 && (
                        <button
                          onClick={() => removePollOption(index)}
                          className="h-7 w-7 flex items-center justify-center rounded-full text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}

                  {pollOptions.length < 4 && (
                    <button
                      onClick={addPollOption}
                      className="flex items-center gap-1.5 text-[12px] text-blue-400 hover:text-blue-300 transition-colors mt-1"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add option
                    </button>
                  )}

                  <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
                    <span className="text-[12px] text-muted-foreground">Poll duration:</span>
                    <select
                      value={pollEndHours}
                      onChange={(e) => setPollEndHours(Number(e.target.value))}
                      className="h-7 px-2 rounded-md text-[12px] bg-white/[0.04] border border-white/[0.1] text-zinc-300 focus:outline-none focus:border-blue-500/50"
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
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={handleMediaSelect}
            className="hidden"
          />
          <button
            className="h-9 w-9 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-40 disabled:pointer-events-none"
            onClick={() => fileInputRef.current?.click()}
            disabled={media.length >= MAX_IMAGES}
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
              "h-9 w-9 flex items-center justify-center rounded-full transition-colors disabled:opacity-40 disabled:pointer-events-none",
              isAudioRecording
                ? "text-red-400 hover:text-red-300"
                : hasAudio
                  ? "text-blue-400 hover:text-blue-300"
                  : "text-zinc-400 hover:text-zinc-200"
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
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
              <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
            </svg>
          </button>
          <button
            className={cn(
              "h-9 w-9 flex items-center justify-center rounded-full transition-colors disabled:opacity-40 disabled:pointer-events-none",
              showPoll
                ? "text-blue-400 hover:text-blue-300"
                : "text-zinc-400 hover:text-zinc-200"
            )}
            onClick={togglePoll}
            title={showPoll ? "Remove poll" : "Add poll"}
          >
            <BarChart3 className="h-5 w-5" />
          </button>
          <button
            className="h-9 w-9 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-40 disabled:pointer-events-none"
            disabled
            title="Emoji"
          >
            <Smile className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          {content.length > 0 && (
            <span
              className={`text-xs font-medium ${
                isOverLimit
                  ? "text-rose-400"
                  : charCount > MAX_POST_LENGTH * 0.8
                    ? "text-amber-400"
                    : "text-zinc-600"
              }`}
            >
              {charCount}/{MAX_POST_LENGTH}
            </span>
          )}
          <Button
            size="sm"
            className="rounded-lg px-6 font-semibold bg-blue-500 hover:bg-blue-600 text-white border-0 transition-colors"
            onClick={handleSubmit}
            disabled={!canPost || posting}
          >
            {posting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : replyToId ? (
              "Reply"
            ) : (
              "Share"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
