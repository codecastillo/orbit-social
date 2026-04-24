"use client";

import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { cn } from "@/lib/utils";
import type { CallState } from "@/lib/hooks/use-webrtc";

interface CallOverlayProps {
  callState: CallState;
  peerName: string;
  peerAvatarUrl: string | null;
  isVideo: boolean;
  isMuted: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
}

function formatCallDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function CallOverlay({
  callState,
  peerName,
  peerAvatarUrl,
  isVideo,
  isMuted,
  localStream,
  remoteStream,
  onToggleMute,
  onToggleVideo,
  onEndCall,
}: CallOverlayProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);

  // Attach streams to video elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Call duration timer
  useEffect(() => {
    if (callState !== "connected") {
      setDuration(0);
      return;
    }

    const interval = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [callState]);

  const statusText =
    callState === "calling"
      ? "Calling..."
      : callState === "ringing"
        ? "Incoming call..."
        : callState === "connected"
          ? formatCallDuration(duration)
          : callState === "ended"
            ? "Call ended"
            : "";

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/95 backdrop-blur-xl flex flex-col items-center justify-center">
      {/* Video streams */}
      {isVideo && callState === "connected" ? (
        <div className="absolute inset-0">
          {/* Remote video (full screen) */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />

          {/* Local video (picture-in-picture) */}
          <div className="absolute top-4 right-4 w-32 h-44 rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover mirror"
              style={{ transform: "scaleX(-1)" }}
            />
          </div>
        </div>
      ) : (
        /* Audio-only or pre-connected state */
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <UserAvatar
              src={peerAvatarUrl}
              fallback={peerName}
              size="xl"
            />
            {(callState === "calling" || callState === "ringing") && (
              <div className="absolute inset-0 rounded-full border-2 border-blue-500/40 animate-ping" />
            )}
          </div>

          <div className="text-center">
            <h2 className="text-xl font-semibold text-zinc-100">{peerName}</h2>
            <p className="text-sm text-zinc-400 mt-1">{statusText}</p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-4">
        {/* Mute toggle */}
        <button
          onClick={onToggleMute}
          className={cn(
            "h-14 w-14 rounded-full flex items-center justify-center transition-all",
            isMuted
              ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/30"
              : "bg-white/10 text-white hover:bg-white/20"
          )}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? (
            <MicOff className="h-6 w-6" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </button>

        {/* End call */}
        <button
          onClick={onEndCall}
          className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors shadow-lg shadow-red-500/20"
          title="End call"
        >
          <PhoneOff className="h-7 w-7" />
        </button>

        {/* Video toggle (only if video call) */}
        {isVideo && (
          <button
            onClick={onToggleVideo}
            className={cn(
              "h-14 w-14 rounded-full flex items-center justify-center transition-all",
              !isVideo
                ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/30"
                : "bg-white/10 text-white hover:bg-white/20"
            )}
            title={isVideo ? "Turn off camera" : "Turn on camera"}
          >
            {isVideo ? (
              <Video className="h-6 w-6" />
            ) : (
              <VideoOff className="h-6 w-6" />
            )}
          </button>
        )}
      </div>

      {/* Hidden audio for audio-only calls */}
      {!isVideo && (
        <>
          <audio ref={remoteVideoRef as any} autoPlay playsInline />
          <audio
            ref={localVideoRef as any}
            autoPlay
            playsInline
            muted
          />
        </>
      )}
    </div>
  );
}
