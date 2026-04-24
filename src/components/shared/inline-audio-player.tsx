"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { formatDuration, generateWaveformBars } from "@/lib/utils/audio";

interface InlineAudioPlayerProps {
  src: string;
  variant?: "message" | "feed";
  isOwn?: boolean;
  className?: string;
}

export function InlineAudioPlayer({
  src,
  variant = "message",
  isOwn = false,
  className,
}: InlineAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [waveformBars] = useState(() => generateWaveformBars(variant === "feed" ? 48 : 28));
  const progressBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      setTotalDuration(audio.duration);
    };
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      setProgress(audio.currentTime / (audio.duration || 1));
    };
    const onEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current || !progressBarRef.current) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));

    audioRef.current.currentTime = pct * (audioRef.current.duration || 0);
    setProgress(pct);
  };

  if (variant === "message") {
    return (
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-2xl px-3 py-2 min-w-[200px] max-w-[280px]",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <audio ref={audioRef} src={src} preload="metadata" />

        {/* Play/Pause */}
        <button
          onClick={togglePlay}
          className={cn(
            "shrink-0 h-8 w-8 flex items-center justify-center rounded-full transition-colors",
            isOwn
              ? "bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground"
              : "bg-foreground/10 hover:bg-foreground/15 text-foreground"
          )}
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

        {/* Waveform */}
        <div className="flex-1 flex flex-col gap-1">
          <div
            ref={progressBarRef}
            className="flex items-center gap-[2px] h-5 cursor-pointer"
            onClick={handleSeek}
          >
            {waveformBars.map((height, i) => {
              const barProgress = progress * waveformBars.length;
              const isActive = i < barProgress;
              return (
                <div
                  key={i}
                  className={cn(
                    "w-[2.5px] rounded-full transition-colors duration-100",
                    isOwn
                      ? isActive
                        ? "bg-primary-foreground"
                        : "bg-primary-foreground/30"
                      : isActive
                        ? "bg-foreground"
                        : "bg-foreground/20"
                  )}
                  style={{ height: `${height * 100}%` }}
                />
              );
            })}
          </div>

          {/* Time */}
          <span
            className={cn(
              "text-[10px] font-mono tabular-nums",
              isOwn ? "text-primary-foreground/60" : "text-muted-foreground/60"
            )}
          >
            {isPlaying || currentTime > 0
              ? formatDuration(currentTime)
              : totalDuration > 0
                ? formatDuration(totalDuration)
                : "0:00"}
          </span>
        </div>
      </div>
    );
  }

  // Feed variant
  return (
    <div
      className={cn(
        "rounded-xl bg-zinc-800/60 border border-white/[0.06] p-4",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <audio ref={audioRef} src={src} preload="metadata" />

      <div className="flex items-center gap-4">
        {/* Play/Pause */}
        <button
          onClick={togglePlay}
          className="shrink-0 h-12 w-12 flex items-center justify-center rounded-full bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
        >
          {isPlaying ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5">
              <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5 ml-0.5">
              <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          {/* Waveform */}
          <div
            ref={progressBarRef}
            className="flex items-center gap-[2px] h-8 cursor-pointer mb-2"
            onClick={handleSeek}
          >
            {waveformBars.map((height, i) => {
              const barProgress = progress * waveformBars.length;
              const isActive = i < barProgress;
              return (
                <div
                  key={i}
                  className={cn(
                    "flex-1 min-w-[2px] max-w-[4px] rounded-full transition-colors duration-100",
                    isActive ? "bg-primary" : "bg-zinc-600"
                  )}
                  style={{ height: `${height * 100}%` }}
                />
              );
            })}
          </div>

          {/* Time display */}
          <div className="flex justify-between">
            <span className="text-xs font-mono text-zinc-400 tabular-nums">
              {formatDuration(currentTime)}
            </span>
            <span className="text-xs font-mono text-zinc-500 tabular-nums">
              {totalDuration > 0 ? formatDuration(totalDuration) : "--:--"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
