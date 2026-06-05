"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  error: string | null;
}

export function useAudioRecorder() {
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioBlob: null,
    audioUrl: null,
    error: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
      if (state.audioUrl) {
        URL.revokeObjectURL(state.audioUrl);
      }
    };
  }, [cleanup, state.audioUrl]);

  const startRecording = useCallback(async () => {
    try {
      // Clear previous recording
      if (state.audioUrl) {
        URL.revokeObjectURL(state.audioUrl);
      }

      // Pre-flight: getUserMedia requires a secure context (HTTPS or
      // localhost) and a real navigator.mediaDevices on this page.
      if (typeof window === "undefined" || !window.isSecureContext) {
        throw new Error("INSECURE_CONTEXT");
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("NO_MEDIA_DEVICES");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Determine supported mime type
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : "";

      const options: MediaRecorderOptions = {};
      if (mimeType) options.mimeType = mimeType;

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const ext = mimeType.includes("mp4") ? "mp4" : "webm";
        const blobType = mimeType || `audio/${ext}`;
        const blob = new Blob(chunksRef.current, { type: blobType });
        const url = URL.createObjectURL(blob);

        setState((prev) => ({
          ...prev,
          isRecording: false,
          audioBlob: blob,
          audioUrl: url,
        }));

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      mediaRecorder.start(100); // collect data every 100ms
      startTimeRef.current = Date.now();

      timerRef.current = setInterval(() => {
        setState((prev) => ({
          ...prev,
          duration: Math.floor((Date.now() - startTimeRef.current) / 1000),
        }));
      }, 200);

      setState({
        isRecording: true,
        isPaused: false,
        duration: 0,
        audioBlob: null,
        audioUrl: null,
        error: null,
      });
    } catch (err) {
      // Log the raw error so we can see exactly what fired in DevTools.
      // the user-facing toast was masking the real cause when mic was
      // already enabled.
      console.error("audio-recorder startRecording failed", err);

      const name = err instanceof DOMException ? err.name : (err as Error)?.message;
      let message: string;
      switch (name) {
        case "NotAllowedError":
        case "SecurityError":
          message =
            "Microphone access denied. Click the lock icon in the address bar and allow microphone for this site.";
          break;
        case "NotFoundError":
        case "OverconstrainedError":
          message = "No microphone detected on this device.";
          break;
        case "NotReadableError":
          message =
            "Microphone is in use by another app. Close other tabs/apps using the mic and retry.";
          break;
        case "AbortError":
          message = "Recording was aborted. Try again.";
          break;
        case "INSECURE_CONTEXT":
          message =
            "Voice messages need an HTTPS connection. Visit the site over HTTPS to enable the mic.";
          break;
        case "NO_MEDIA_DEVICES":
          message =
            "Your browser doesn't expose a microphone API on this page.";
          break;
        default:
          message = `Couldn't start recording (${name ?? "unknown"}).`;
      }

      setState((prev) => ({ ...prev, error: message }));
    }
  }, [state.audioUrl]);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cancelRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    cleanup();

    if (state.audioUrl) {
      URL.revokeObjectURL(state.audioUrl);
    }

    setState({
      isRecording: false,
      isPaused: false,
      duration: 0,
      audioBlob: null,
      audioUrl: null,
      error: null,
    });
  }, [cleanup, state.audioUrl]);

  const discardRecording = useCallback(() => {
    if (state.audioUrl) {
      URL.revokeObjectURL(state.audioUrl);
    }
    setState({
      isRecording: false,
      isPaused: false,
      duration: 0,
      audioBlob: null,
      audioUrl: null,
      error: null,
    });
  }, [state.audioUrl]);

  return {
    ...state,
    startRecording,
    stopRecording,
    cancelRecording,
    discardRecording,
  };
}
