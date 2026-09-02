import { useCallback, useEffect, useRef, useState } from "react";
import {
  CHUNK_SAMPLES,
  createRecorderWorklet,
  isSilent,
  mergeFloat32,
  resample,
  TARGET_SAMPLE_RATE,
} from "../lib/whisper/audio";
import { whisperClient } from "../lib/whisper/client";

export type RecordingState = "idle" | "recording" | "paused";
export type ModelStatus = "idle" | "loading" | "ready" | "error";

export interface VoiceRecordingHook {
  recordingState: RecordingState;
  transcription: string;
  isListening: boolean;
  startRecording: () => Promise<void>;
  pauseRecording: () => void;
  stopRecording: () => void;
  clearTranscription: () => void;
  error: string | null;
  isSupported: boolean;
  modelStatus: ModelStatus;
  modelProgress: number;
  isTranscribing: boolean;
}

function microphoneSupported() {
  return Boolean(navigator.mediaDevices?.getUserMedia);
}

function joinTranscript(current: string, next: string) {
  const incoming = next.trim();
  if (!incoming) {
    return current;
  }

  if (!current) {
    return incoming;
  }

  const needsSpace = !current.endsWith(" ") && !incoming.startsWith(" ");
  return `${current}${needsSpace ? " " : ""}${incoming}`;
}

export const useVoiceRecording = (): VoiceRecordingHook => {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [transcription, setTranscription] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [modelStatus, setModelStatus] = useState<ModelStatus>(
    whisperClient.isReady() ? "ready" : "idle"
  );
  const [modelProgress, setModelProgress] = useState(whisperClient.isReady() ? 100 : 0);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const recordingStateRef = useRef<RecordingState>("idle");
  const chunksRef = useRef<Float32Array[]>([]);
  const samplesRef = useRef(0);
  const transcribeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingChunksRef = useRef(0);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  useEffect(() => {
    recordingStateRef.current = recordingState;
  }, [recordingState]);

  useEffect(() => {
    setIsSupported(microphoneSupported());

    const unsubscribeProgress = whisperClient.onProgress((progress) => {
      if (progress.status === "progress_total" && typeof progress.progress === "number") {
        setModelProgress(Math.max(0, Math.min(100, Math.round(progress.progress))));
        return;
      }

      if (progress.status === "progress" && typeof progress.progress === "number") {
        setModelProgress(Math.max(0, Math.min(100, Math.round(progress.progress))));
      }
    });

    const unsubscribeReady = whisperClient.onReady(() => {
      setModelStatus("ready");
      setModelProgress(100);
      setError(null);
    });

    const unsubscribeError = whisperClient.onError((message) => {
      setModelStatus("error");
      setError(message);
    });

    if (whisperClient.isReady()) {
      setModelStatus("ready");
      setModelProgress(100);
    } else {
      setModelStatus("loading");
      whisperClient.load().catch((loadError: unknown) => {
        setModelStatus("error");
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load the on-device Whisper model"
        );
      });
    }

    return () => {
      unsubscribeProgress();
      unsubscribeReady();
      unsubscribeError();
    };
  }, []);

  const markTranscribeStart = useCallback(() => {
    pendingChunksRef.current += 1;
    setIsTranscribing(true);
  }, []);

  const markTranscribeEnd = useCallback(() => {
    pendingChunksRef.current = Math.max(0, pendingChunksRef.current - 1);
    if (pendingChunksRef.current === 0) {
      setIsTranscribing(false);
    }
  }, []);

  const enqueueTranscription = useCallback(
    (audio: Float32Array) => {
      if (audio.length === 0 || isSilent(audio)) {
        return;
      }

      markTranscribeStart();
      transcribeQueueRef.current = transcribeQueueRef.current
        .then(async () => {
          const text = await whisperClient.transcribe(audio);
          if (text) {
            setTranscription((current) => joinTranscript(current, text));
          }
        })
        .catch((transcribeError: unknown) => {
          console.error("Whisper transcription failed", transcribeError);
          setError(
            transcribeError instanceof Error
              ? transcribeError.message
              : "Failed to transcribe audio on-device"
          );
        })
        .finally(markTranscribeEnd);
    },
    [markTranscribeEnd, markTranscribeStart]
  );

  const flushBuffer = useCallback(() => {
    if (chunksRef.current.length === 0) {
      return;
    }

    const merged = mergeFloat32(chunksRef.current);
    chunksRef.current = [];
    samplesRef.current = 0;

    const sampleRate = audioContextRef.current?.sampleRate ?? TARGET_SAMPLE_RATE;
    enqueueTranscription(resample(merged, sampleRate, TARGET_SAMPLE_RATE));
  }, [enqueueTranscription]);

  const handleAudioFrame = useCallback(
    (frame: Float32Array) => {
      if (recordingStateRef.current !== "recording") {
        return;
      }

      chunksRef.current.push(new Float32Array(frame));
      samplesRef.current += frame.length;

      if (samplesRef.current >= CHUNK_SAMPLES) {
        flushBuffer();
      }
    },
    [flushBuffer]
  );

  const teardownCapture = useCallback(() => {
    workletRef.current?.port.close();
    workletRef.current?.disconnect();
    sourceRef.current?.disconnect();
    gainRef.current?.disconnect();

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      void audioContextRef.current.close();
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());

    workletRef.current = null;
    sourceRef.current = null;
    gainRef.current = null;
    audioContextRef.current = null;
    streamRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    if (!microphoneSupported()) {
      setError("Voice recording needs a browser with microphone access");
      return;
    }

    if (modelStatus !== "ready") {
      setError("Whisper is still loading on this device. Try again in a moment.");
      return;
    }

    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      const audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
      await audioContext.resume();

      const source = audioContext.createMediaStreamSource(stream);
      const worklet = await createRecorderWorklet(audioContext);
      const gain = audioContext.createGain();
      gain.gain.value = 0;

      worklet.port.onmessage = (event: MessageEvent<Float32Array>) => {
        handleAudioFrame(event.data);
      };

      source.connect(worklet);
      worklet.connect(gain);
      gain.connect(audioContext.destination);

      streamRef.current = stream;
      audioContextRef.current = audioContext;
      sourceRef.current = source;
      workletRef.current = worklet;
      gainRef.current = gain;

      setRecordingState("recording");
      setIsListening(true);
    } catch (startError: unknown) {
      teardownCapture();
      console.error("Error starting recording:", startError);
      const name = startError instanceof DOMException ? startError.name : "";
      setError(
        name === "NotAllowedError"
          ? "Microphone access denied. Allow microphone access and try again."
          : "Failed to start recording. Check your microphone and try again."
      );
    }
  }, [handleAudioFrame, modelStatus, teardownCapture]);

  const pauseRecording = useCallback(() => {
    if (recordingState === "recording") {
      flushBuffer();
      setRecordingState("paused");
      setIsListening(false);
      return;
    }

    if (recordingState === "paused") {
      if (!streamRef.current || !audioContextRef.current) {
        void startRecording();
        return;
      }

      void audioContextRef.current.resume();
      setRecordingState("recording");
      setIsListening(true);
    }
  }, [flushBuffer, recordingState, startRecording]);

  const stopRecording = useCallback(() => {
    flushBuffer();
    teardownCapture();
    setRecordingState("idle");
    setIsListening(false);
  }, [flushBuffer, teardownCapture]);

  const clearTranscription = useCallback(() => {
    setTranscription("");
  }, []);

  useEffect(() => {
    return () => {
      teardownCapture();
    };
  }, [teardownCapture]);

  return {
    recordingState,
    transcription,
    isListening,
    startRecording,
    pauseRecording,
    stopRecording,
    clearTranscription,
    error,
    isSupported,
    modelStatus,
    modelProgress,
    isTranscribing,
  };
};
