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
  isCameraOff: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onAcceptCall: () => void;
  onDeclineCall: () => void;
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
  isCameraOff,
  localStream,
  remoteStream,
  onToggleMute,
  onToggleVideo,
  onAcceptCall,
  onDeclineCall,
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

  // Restart the elapsed counter on every connect. Adjusted during render per
  // the React "adjusting state when a prop changes" pattern so a reconnect
  // never shows the previous call's time.
  const [prevCallState, setPrevCallState] = useState(callState);
  if (callState !== prevCallState) {
    setPrevCallState(callState);
    if (callState !== "connected") setDuration(0);
  }

  // Call duration timer
  useEffect(() => {
    if (callState !== "connected") return;

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

  // The call surface stays dark in both themes to match the video underneath.
  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center">
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
            <h2 className="text-xl font-semibold text-white">{peerName}</h2>
            <p className="text-sm text-white/70 mt-1">{statusText}</p>
          </div>
        </div>
      )}

      {/* Controls */}
      {callState === "ringing" ? (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-8">
          <button
            onClick={onDeclineCall}
            aria-label="Decline call"
            title="Decline"
            className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors shadow-lg shadow-red-500/20"
          >
            <PhoneOff className="h-7 w-7" />
          </button>
          <button
            onClick={onAcceptCall}
            aria-label={isVideo ? "Accept video call" : "Accept call"}
            title="Accept"
            className="h-16 w-16 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center transition-colors shadow-lg shadow-green-500/20"
          >
            <Phone className="h-7 w-7" />
          </button>
        </div>
      ) : (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-4">
          {/* Mute toggle */}
          <button
            onClick={onToggleMute}
            aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
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
            aria-label="End call"
            className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors shadow-lg shadow-red-500/20"
            title="End call"
          >
            <PhoneOff className="h-7 w-7" />
          </button>

          {/* Camera toggle (only on video calls) */}
          {isVideo && (
            <button
              onClick={onToggleVideo}
              aria-label={isCameraOff ? "Turn on camera" : "Turn off camera"}
              className={cn(
                "h-14 w-14 rounded-full flex items-center justify-center transition-all",
                isCameraOff
                  ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/30"
                  : "bg-white/10 text-white hover:bg-white/20"
              )}
              title={isCameraOff ? "Turn on camera" : "Turn off camera"}
            >
              {isCameraOff ? (
                <VideoOff className="h-6 w-6" />
              ) : (
                <Video className="h-6 w-6" />
              )}
            </button>
          )}
        </div>
      )}

      {/* Hidden audio for audio-only calls */}
      {!isVideo && (
        <>
          {/* Audio-only calls reuse the video refs: the effects above only
              touch srcObject, which both element types inherit from
              HTMLMediaElement, and the two branches never mount together. */}
          <audio
            ref={remoteVideoRef as React.RefObject<HTMLAudioElement | null>}
            autoPlay
            playsInline
          />
          <audio
            ref={localVideoRef as React.RefObject<HTMLAudioElement | null>}
            autoPlay
            playsInline
            muted
          />
        </>
      )}
    </div>
  );
}
