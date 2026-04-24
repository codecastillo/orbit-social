"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useAudioRecorder } from "@/lib/hooks/use-audio-recorder";
import { formatDuration, generateWaveformBars, getAudioExtension } from "@/lib/utils/audio";
import { createClient } from "@/lib/supabase/client";

interface VoiceRecorderProps {
  onSend: (audioUrl: string) => Promise<void>;
  onRecordingChange: (isRecording: boolean) => void;
  disabled?: boolean;
}

export function VoiceRecorder({
  onSend,
  onRecordingChange,
  disabled,
}: VoiceRecorderProps) {
  const {
    isRecording,
    duration,
    audioBlob,
    audioUrl,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
    discardRecording,
  } = useAudioRecorder();

  const [isPlaying, setIsPlaying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [playProgress, setPlayProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformBars = useRef(generateWaveformBars(32));

  useEffect(() => {
    onRecordingChange(isRecording || !!audioBlob);
  }, [isRecording, audioBlob, onRecordingChange]);

  // Regenerate waveform when a new recording starts
  useEffect(() => {
    if (isRecording) {
      waveformBars.current = generateWaveformBars(32);
    }
  }, [isRecording]);

  const togglePlayback = useCallback(() => {
    if (!audioRef.current || !audioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [isPlaying, audioUrl]);

  const handleUploadAndSend = async () => {
    if (!audioBlob) return;
    setUploading(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Not authenticated");

      const ext = getAudioExtension();
      const filePath = `${user.id}/${Date.now()}_voice.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("message-media")
        .upload(filePath, audioBlob, {
          contentType: audioBlob.type,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("message-media").getPublicUrl(filePath);

      await onSend(publicUrl);
      discardRecording();
    } catch {
      // Error handling - toast could be added here
      console.error("Failed to upload voice message");
    } finally {
      setUploading(false);
    }
  };

  const handleMicClick = () => {
    if (isRecording) {
      stopRecording();
    } else if (audioBlob) {
      // Already have a recording, do nothing (user can send or delete)
    } else {
      startRecording();
    }
  };

  // Error display
  if (error) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-destructive/10 text-destructive text-sm">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
        <span className="truncate">{error}</span>
        <button
          onClick={discardRecording}
          className="ml-auto shrink-0 text-xs underline hover:no-underline"
        >
          Dismiss
        </button>
      </div>
    );
  }

  // Recording state
  if (isRecording) {
    return (
      <div className="flex items-center gap-3 w-full">
        {/* Cancel button */}
        <button
          onClick={cancelRecording}
          className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>

        {/* Recording indicator */}
        <div className="flex-1 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
          {/* Pulsing red dot */}
          <div className="relative shrink-0">
            <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
            <div className="absolute inset-0 h-3 w-3 rounded-full bg-red-500 animate-ping opacity-30" />
          </div>

          {/* Waveform animation */}
          <div className="flex items-center gap-[2px] flex-1 h-6">
            {Array.from({ length: 24 }).map((_, i) => (
              <div
                key={i}
                className="w-[3px] rounded-full bg-red-400/70"
                style={{
                  height: `${20 + Math.sin((Date.now() / 200 + i) * 0.5) * 40 + Math.random() * 20}%`,
                  animation: `pulse ${0.5 + Math.random() * 0.5}s ease-in-out infinite alternate`,
                  animationDelay: `${i * 30}ms`,
                }}
              />
            ))}
          </div>

          {/* Duration */}
          <span className="text-sm font-mono text-red-400 tabular-nums shrink-0">
            {formatDuration(duration)}
          </span>
        </div>

        {/* Stop/Send button */}
        <button
          onClick={stopRecording}
          className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
            <rect x="6" y="6" width="8" height="8" rx="1" />
          </svg>
        </button>
      </div>
    );
  }

  // Preview state (recording done, ready to send)
  if (audioBlob && audioUrl) {
    return (
      <div className="flex items-center gap-3 w-full">
        {/* Hidden audio element */}
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={() => {
            setIsPlaying(false);
            setPlayProgress(0);
          }}
          onTimeUpdate={() => {
            if (audioRef.current) {
              setPlayProgress(
                audioRef.current.currentTime / (audioRef.current.duration || 1)
              );
            }
          }}
        />

        {/* Delete button */}
        <button
          onClick={discardRecording}
          className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Audio preview */}
        <div className="flex-1 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20">
          {/* Play/Pause */}
          <button
            onClick={togglePlayback}
            className="shrink-0 h-7 w-7 flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {isPlaying ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
                <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zM12.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-3.5 ml-0.5">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
            )}
          </button>

          {/* Waveform / Progress */}
          <div className="flex items-center gap-[2px] flex-1 h-6">
            {waveformBars.current.map((height, i) => {
              const progress = playProgress * waveformBars.current.length;
              const isActive = i < progress;
              return (
                <div
                  key={i}
                  className={cn(
                    "w-[3px] rounded-full transition-colors",
                    isActive ? "bg-primary" : "bg-primary/30"
                  )}
                  style={{ height: `${height * 100}%` }}
                />
              );
            })}
          </div>

          {/* Duration */}
          <span className="text-xs font-mono text-muted-foreground tabular-nums shrink-0">
            {formatDuration(duration)}
          </span>
        </div>

        {/* Send button */}
        <button
          onClick={handleUploadAndSend}
          disabled={uploading}
          className={cn(
            "h-10 w-10 shrink-0 flex items-center justify-center rounded-xl transition-colors",
            uploading
              ? "bg-primary/50 text-primary-foreground/50 cursor-not-allowed"
              : "bg-primary hover:bg-primary/90 text-primary-foreground"
          )}
        >
          {uploading ? (
            <svg className="size-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4">
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          )}
        </button>
      </div>
    );
  }

  // Default: just the mic button
  return (
    <button
      onClick={handleMicClick}
      disabled={disabled}
      className={cn(
        "h-10 w-10 shrink-0 flex items-center justify-center rounded-xl transition-colors",
        "text-muted-foreground hover:text-foreground hover:bg-muted/50",
        "disabled:opacity-50 disabled:cursor-not-allowed"
      )}
      title="Record voice message"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5">
        <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
        <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
      </svg>
    </button>
  );
}
