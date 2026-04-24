"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/utils/audio";

interface AudioPlayerProps {
  src: string;
  className?: string;
}

export function AudioPlayer({ src, className }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Generate stable waveform bars
  const waveformBars = useMemo(() => {
    const bars: number[] = [];
    for (let i = 0; i < 64; i++) {
      const base = 0.25 + Math.random() * 0.55;
      const wave = Math.sin((i / 64) * Math.PI) * 0.2;
      bars.push(Math.min(1, Math.max(0.08, base + wave)));
    }
    return bars;
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => setTotalDuration(audio.duration);
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
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // Animated bar visualization while playing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isPlaying) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bars = 16;
    const barWidth = canvas.width / bars - 2;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < bars; i++) {
        const height =
          (0.3 + Math.sin(Date.now() / 200 + i * 0.8) * 0.3 + Math.random() * 0.15) *
          canvas.height;
        const x = i * (barWidth + 2);
        const y = (canvas.height - height) / 2;

        ctx.fillStyle = "rgba(59, 130, 246, 0.7)";
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, height, 2);
        ctx.fill();
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [isPlaying]);

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

  return (
    <div
      className={cn(
        "rounded-xl bg-zinc-900/80 border border-white/[0.06] overflow-hidden",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Top section with visualizer */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-4">
          {/* Play Button */}
          <button
            onClick={togglePlay}
            className="shrink-0 h-14 w-14 flex items-center justify-center rounded-full bg-blue-500 hover:bg-blue-600 text-white transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/25"
          >
            {isPlaying ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-6">
                <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-6 ml-1">
                <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          {/* Waveform or Animated Visualizer */}
          <div className="flex-1 min-w-0">
            {isPlaying ? (
              <canvas
                ref={canvasRef}
                width={300}
                height={48}
                className="w-full h-12"
              />
            ) : (
              <div className="flex items-center gap-[2px] h-12">
                {waveformBars.map((height, i) => {
                  const barProgress = progress * waveformBars.length;
                  const isActive = i < barProgress;
                  return (
                    <div
                      key={i}
                      className={cn(
                        "flex-1 min-w-[1.5px] max-w-[4px] rounded-full transition-colors duration-150",
                        isActive ? "bg-blue-500" : "bg-zinc-700"
                      )}
                      style={{ height: `${height * 100}%` }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div
        ref={progressBarRef}
        className="relative h-1 bg-zinc-800 cursor-pointer group"
        onClick={handleSeek}
      >
        <div
          className="absolute inset-y-0 left-0 bg-blue-500 transition-all group-hover:bg-blue-400"
          style={{ width: `${progress * 100}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
          style={{ left: `calc(${progress * 100}% - 6px)` }}
        />
      </div>

      {/* Time display */}
      <div className="flex justify-between px-4 py-2">
        <span className="text-xs font-mono text-zinc-400 tabular-nums">
          {formatDuration(currentTime)}
        </span>
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="size-3.5">
            <path d="M3 3.732a1.5 1.5 0 012.305-1.265l6.706 4.267a1.5 1.5 0 010 2.531l-6.706 4.268A1.5 1.5 0 013 12.267V3.732z" />
          </svg>
          <span>Audio</span>
        </div>
        <span className="text-xs font-mono text-zinc-500 tabular-nums">
          {totalDuration > 0 ? formatDuration(totalDuration) : "--:--"}
        </span>
      </div>
    </div>
  );
}
