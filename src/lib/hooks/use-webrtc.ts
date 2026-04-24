"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export type CallState = "idle" | "calling" | "ringing" | "connected" | "ended";

interface UseWebRTCReturn {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  callState: CallState;
  isVideo: boolean;
  isMuted: boolean;
  startCall: (video: boolean) => Promise<void>;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export function useWebRTC(
  conversationId: string,
  userId: string
): UseWebRTCReturn {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callState, setCallState] = useState<CallState>("idle");
  const [isVideo, setIsVideo] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const supabaseRef = useRef(createClient());

  const cleanup = useCallback(() => {
    // Stop local tracks
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);

    // Close peer connection
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;

    setRemoteStream(null);
    setIsMuted(false);

    // Remove channel
    if (channelRef.current) {
      supabaseRef.current.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Handle remote tracks
    const remote = new MediaStream();
    setRemoteStream(remote);

    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        remote.addTrack(track);
      });
      setRemoteStream(new MediaStream(remote.getTracks()));
    };

    // Handle ICE candidates - send via Supabase Realtime
    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "ice-candidate",
          payload: {
            candidate: event.candidate.toJSON(),
            senderId: userId,
          },
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setCallState("connected");
      } else if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed" ||
        pc.connectionState === "closed"
      ) {
        setCallState("ended");
        setTimeout(() => {
          setCallState("idle");
          cleanup();
        }, 2000);
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [userId, cleanup]);

  const setupSignaling = useCallback(() => {
    const supabase = supabaseRef.current;
    const channel = supabase.channel(`call-${conversationId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "offer" }, async ({ payload }) => {
        if (payload.senderId === userId) return;

        // Incoming call
        setCallState("ringing");
        setIsVideo(payload.isVideo ?? false);

        const pc = createPeerConnection();

        // Get media
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: payload.isVideo ?? false,
          });
          localStreamRef.current = stream;
          setLocalStream(stream);
          stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        } catch {
          setCallState("idle");
          cleanup();
          return;
        }

        await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        channel.send({
          type: "broadcast",
          event: "answer",
          payload: {
            answer: answer,
            senderId: userId,
          },
        });

        setCallState("connected");
      })
      .on("broadcast", { event: "answer" }, async ({ payload }) => {
        if (payload.senderId === userId) return;
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(payload.answer)
          );
          setCallState("connected");
        }
      })
      .on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
        if (payload.senderId === userId) return;
        if (peerConnectionRef.current && payload.candidate) {
          try {
            await peerConnectionRef.current.addIceCandidate(
              new RTCIceCandidate(payload.candidate)
            );
          } catch {
            // Ignore ICE candidate errors
          }
        }
      })
      .on("broadcast", { event: "end-call" }, ({ payload }) => {
        if (payload.senderId === userId) return;
        setCallState("ended");
        setTimeout(() => {
          setCallState("idle");
          cleanup();
        }, 2000);
      })
      .subscribe();

    channelRef.current = channel;
  }, [conversationId, userId, createPeerConnection, cleanup]);

  const startCall = useCallback(
    async (video: boolean) => {
      if (callState !== "idle") return;

      setIsVideo(video);
      setCallState("calling");

      // Setup signaling channel
      setupSignaling();

      const pc = createPeerConnection();

      // Get local media
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video,
        });
        localStreamRef.current = stream;
        setLocalStream(stream);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      } catch {
        setCallState("idle");
        cleanup();
        return;
      }

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      channelRef.current?.send({
        type: "broadcast",
        event: "offer",
        payload: {
          offer,
          senderId: userId,
          isVideo: video,
        },
      });
    },
    [callState, setupSignaling, createPeerConnection, userId, cleanup]
  );

  const endCall = useCallback(() => {
    channelRef.current?.send({
      type: "broadcast",
      event: "end-call",
      payload: { senderId: userId },
    });
    setCallState("ended");
    setTimeout(() => {
      setCallState("idle");
      cleanup();
    }, 2000);
  }, [userId, cleanup]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideo(videoTrack.enabled);
      }
    }
  }, []);

  // Listen for incoming calls when idle
  useEffect(() => {
    if (!conversationId || !userId) return;
    if (callState !== "idle") return;

    setupSignaling();

    return () => {
      if (channelRef.current && callState === "idle") {
        supabaseRef.current.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [conversationId, userId, callState, setupSignaling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    localStream,
    remoteStream,
    callState,
    isVideo,
    isMuted,
    startCall,
    endCall,
    toggleMute,
    toggleVideo,
  };
}
