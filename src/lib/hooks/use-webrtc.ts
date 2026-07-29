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
  isCameraOff: boolean;
  startCall: (video: boolean) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => void;
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
  // isVideo is the call type (audio vs video); isCameraOff is whether the
  // local camera track is paused. Conflating them is what made the camera
  // impossible to re-enable.
  const [isVideo, setIsVideo] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const supabaseRef = useRef(createClient());
  const callStateRef = useRef<CallState>("idle");
  // The offer waits here between "ringing" and the user pressing Accept.
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  // ICE candidates that arrive before the remote description is set.
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);

    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    pendingOfferRef.current = null;
    pendingCandidatesRef.current = [];

    setRemoteStream(null);
    setIsMuted(false);
    setIsCameraOff(false);
  }, []);

  const finishCall = useCallback(() => {
    setCallState("ended");
    setTimeout(() => {
      setCallState("idle");
      cleanup();
    }, 2000);
  }, [cleanup]);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    const remote = new MediaStream();
    setRemoteStream(remote);

    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        remote.addTrack(track);
      });
      setRemoteStream(new MediaStream(remote.getTracks()));
    };

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
        finishCall();
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [userId, finishCall]);

  const flushPendingCandidates = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc) return;
    const queued = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // A dropped candidate is recoverable; the rest may still connect.
      }
    }
  }, []);

  // One signaling channel per conversation, held for the life of the screen.
  // Handlers read live state through refs so the subscription never has to be
  // torn down and rebuilt mid-call (the old rebuild-on-state-change version
  // leaked channels and could remove the one an outgoing call was using).
  useEffect(() => {
    if (!conversationId || !userId) return;

    const supabase = supabaseRef.current;
    const channel = supabase.channel(`call-${conversationId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "offer" }, ({ payload }) => {
        if (payload.senderId === userId) return;
        if (callStateRef.current !== "idle") return;

        // Ring only. Media stays off until the user explicitly accepts.
        pendingOfferRef.current = payload.offer;
        setIsVideo(payload.isVideo ?? false);
        setCallState("ringing");
      })
      .on("broadcast", { event: "answer" }, async ({ payload }) => {
        if (payload.senderId === userId) return;
        const pc = peerConnectionRef.current;
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
          await flushPendingCandidates();
          setCallState("connected");
        }
      })
      .on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
        if (payload.senderId === userId || !payload.candidate) return;
        const pc = peerConnectionRef.current;
        if (!pc || !pc.remoteDescription) {
          pendingCandidatesRef.current.push(payload.candidate);
          return;
        }
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch {
          // Ignore ICE candidate errors
        }
      })
      .on("broadcast", { event: "end-call" }, ({ payload }) => {
        if (payload.senderId === userId) return;
        if (callStateRef.current === "idle") return;
        finishCall();
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [conversationId, userId, finishCall, flushPendingCandidates]);

  const startCall = useCallback(
    async (video: boolean) => {
      if (callStateRef.current !== "idle") return;

      setIsVideo(video);
      setCallState("calling");

      const pc = createPeerConnection();

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
    [createPeerConnection, userId, cleanup]
  );

  const acceptCall = useCallback(async () => {
    const offer = pendingOfferRef.current;
    if (callStateRef.current !== "ringing" || !offer) return;
    pendingOfferRef.current = null;

    const pc = createPeerConnection();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    } catch {
      channelRef.current?.send({
        type: "broadcast",
        event: "end-call",
        payload: { senderId: userId },
      });
      setCallState("idle");
      cleanup();
      return;
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    await flushPendingCandidates();
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    channelRef.current?.send({
      type: "broadcast",
      event: "answer",
      payload: {
        answer,
        senderId: userId,
      },
    });
  }, [createPeerConnection, isVideo, userId, cleanup, flushPendingCandidates]);

  const declineCall = useCallback(() => {
    if (callStateRef.current !== "ringing") return;
    channelRef.current?.send({
      type: "broadcast",
      event: "end-call",
      payload: { senderId: userId },
    });
    setCallState("idle");
    cleanup();
  }, [userId, cleanup]);

  const endCall = useCallback(() => {
    channelRef.current?.send({
      type: "broadcast",
      event: "end-call",
      payload: { senderId: userId },
    });
    finishCall();
  }, [userId, finishCall]);

  const toggleMute = useCallback(() => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  }, []);

  const toggleVideo = useCallback(() => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsCameraOff(!videoTrack.enabled);
    }
  }, []);

  return {
    localStream,
    remoteStream,
    callState,
    isVideo,
    isMuted,
    isCameraOff,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleVideo,
  };
}
