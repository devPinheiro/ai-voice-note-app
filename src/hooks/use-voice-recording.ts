import { useCallback, useEffect, useRef, useState } from "react";
import {
  LIVE_HOP_SECONDS,
  LIVE_MIN_SECONDS,
  LIVE_WINDOW_SECONDS,
  SILENCE_HANGOVER_SECONDS,
  createRecorderWorklet,
  isSilent,
  lastSamples,
  mergeFloat32,
  resampleOffline,
  TARGET_SAMPLE_RATE,
} from "../lib/whisper/audio";
import { whisperClient } from "../lib/whisper/client";
import { agreeWindows, joinTranscript, promptTail } from "../lib/whisper/streaming";
import { transcribePcm } from "../lib/whisper/transcribe-media";

export type RecordingState = "idle" | "recording" | "paused";
export type ModelStatus = "idle" | "loading" | "ready" | "error";

export interface VoiceRecordingHook {
  recordingState: RecordingState;
  transcription: string;
  committedTranscription: string;
  interimTranscription: string;
  isListening: boolean;
  startRecording: () => Promise<void>;
  pauseRecording: () => void;
  stopRecording: (options?: { finalize?: boolean }) => Promise<void>;
  clearTranscription: () => void;
  error: string | null;
  isSupported: boolean;
  modelStatus: ModelStatus;
  modelProgress: number;
  isTranscribing: boolean;
  isFinalizing: boolean;
}

type CapturePhase = "idle" | "recording" | "paused" | "finalizing";

function microphoneSupported() {
  return Boolean(navigator.mediaDevices?.getUserMedia);
}

function isLivePhase(phase: CapturePhase) {
  return phase === "recording" || phase === "paused";
}

function createAudioContext() {
  try {
    return new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
  } catch {
    return new AudioContext();
  }
}

async function captureMicrophone() {
  const asrConstraints: MediaStreamConstraints = {
    audio: {
      channelCount: 1,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: true,
      sampleRate: TARGET_SAMPLE_RATE,
    },
  };

  try {
    return await navigator.mediaDevices.getUserMedia(asrConstraints);
  } catch {
    return navigator.mediaDevices.getUserMedia({ audio: true });
  }
}

export const useVoiceRecording = (): VoiceRecordingHook => {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [transcription, setTranscription] = useState("");
  const [committedTranscription, setCommittedTranscription] = useState("");
  const [interimTranscription, setInterimTranscription] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [modelStatus, setModelStatus] = useState<ModelStatus>(
    whisperClient.isReady() ? "ready" : "idle"
  );
  const [modelProgress, setModelProgress] = useState(whisperClient.isReady() ? 100 : 0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const recordingStateRef = useRef<RecordingState>("idle");
  const phaseRef = useRef<CapturePhase>("idle");
  const sessionIdRef = useRef(0);
  const chunksRef = useRef<Float32Array[]>([]);
  const samplesRef = useRef(0);
  const samplesSinceHopRef = useRef(0);
  const nativeRateRef = useRef(TARGET_SAMPLE_RATE);
  const lastSpeechSampleRef = useRef(0);
  const committedRef = useRef("");
  const interimRef = useRef("");
  const prevWindowTextRef = useRef("");
  const liveRunningRef = useRef(false);
  const pendingLiveRef = useRef<Float32Array | null>(null);
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

  const publishTranscript = useCallback(() => {
    const next = joinTranscript(committedRef.current, interimRef.current);
    setCommittedTranscription(committedRef.current);
    setInterimTranscription(interimRef.current);
    setTranscription(next);
  }, []);

  const resetLiveState = useCallback(() => {
    chunksRef.current = [];
    samplesRef.current = 0;
    samplesSinceHopRef.current = 0;
    lastSpeechSampleRef.current = 0;
    committedRef.current = "";
    interimRef.current = "";
    prevWindowTextRef.current = "";
    pendingLiveRef.current = null;
    publishTranscript();
  }, [publishTranscript]);

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

  const applyLiveResult = useCallback(
    (text: string, sessionId: number) => {
      if (sessionId !== sessionIdRef.current || !isLivePhase(phaseRef.current)) {
        return;
      }

      const next = text.trim();
      if (!next) {
        return;
      }

      const previous = prevWindowTextRef.current;
      if (previous) {
        const { commit } = agreeWindows(previous, next);
        if (commit) {
          committedRef.current = joinTranscript(committedRef.current, commit);
        }
      }

      prevWindowTextRef.current = next;
      interimRef.current = next;
      publishTranscript();
    },
    [publishTranscript]
  );

  const runLiveWindow = useCallback(
    async (audio: Float32Array, sessionId: number) => {
      if (audio.length === 0) {
        return;
      }

      if (liveRunningRef.current) {
        pendingLiveRef.current = audio;
        return;
      }

      liveRunningRef.current = true;
      markTranscribeStart();

      try {
        let current: Float32Array | null = audio;

        while (current && sessionId === sessionIdRef.current && isLivePhase(phaseRef.current)) {
          const text = await whisperClient.transcribe(current, {
            prompt: promptTail(committedRef.current),
          });
          applyLiveResult(text, sessionId);
          current = pendingLiveRef.current;
          pendingLiveRef.current = null;
        }
      } catch (transcribeError: unknown) {
        console.error("Whisper transcription failed", transcribeError);
        if (sessionId === sessionIdRef.current) {
          setError(
            transcribeError instanceof Error
              ? transcribeError.message
              : "Failed to transcribe audio on-device"
          );
        }
      } finally {
        liveRunningRef.current = false;
        markTranscribeEnd();
      }
    },
    [applyLiveResult, markTranscribeEnd, markTranscribeStart]
  );

  const queueLiveWindow = useCallback(() => {
    if (phaseRef.current !== "recording" && phaseRef.current !== "paused") {
      return;
    }

    const rate = nativeRateRef.current;
    const minSamples = Math.round(LIVE_MIN_SECONDS * rate);
    if (samplesRef.current < minSamples) {
      return;
    }

    const windowSamples = Math.round(LIVE_WINDOW_SECONDS * rate);
    const hangoverSamples = Math.round(SILENCE_HANGOVER_SECONDS * rate);
    const window = lastSamples(chunksRef.current, samplesRef.current, windowSamples);
    const silentWindow = isSilent(window);
    const silentLongEnough =
      samplesRef.current - lastSpeechSampleRef.current > hangoverSamples;

    if (silentWindow) {
      if (silentLongEnough && interimRef.current) {
        committedRef.current = joinTranscript(committedRef.current, interimRef.current);
        interimRef.current = "";
        prevWindowTextRef.current = "";
        publishTranscript();
      }
      return;
    }

    lastSpeechSampleRef.current = samplesRef.current;
    const sessionId = sessionIdRef.current;

    void resampleOffline(window, rate, TARGET_SAMPLE_RATE).then((pcm) => {
      if (sessionId !== sessionIdRef.current) {
        return;
      }
      void runLiveWindow(pcm, sessionId);
    });
  }, [publishTranscript, runLiveWindow]);

  const handleAudioFrame = useCallback(
    (frame: Float32Array) => {
      if (recordingStateRef.current !== "recording") {
        return;
      }

      chunksRef.current.push(new Float32Array(frame));
      samplesRef.current += frame.length;
      samplesSinceHopRef.current += frame.length;

      if (!isSilent(frame)) {
        lastSpeechSampleRef.current = samplesRef.current;
      }

      const hopSamples = Math.round(LIVE_HOP_SECONDS * nativeRateRef.current);
      const minSamples = Math.round(LIVE_MIN_SECONDS * nativeRateRef.current);

      if (samplesRef.current >= minSamples && samplesSinceHopRef.current >= hopSamples) {
        samplesSinceHopRef.current = 0;
        queueLiveWindow();
      }
    },
    [queueLiveWindow]
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
    sessionIdRef.current += 1;
    phaseRef.current = "recording";
    resetLiveState();

    try {
      const stream = await captureMicrophone();

      const audioContext = createAudioContext();
      await audioContext.resume();

      const source = audioContext.createMediaStreamSource(stream);
      const worklet = await createRecorderWorklet(audioContext);
      const gain = audioContext.createGain();
      gain.gain.value = 0;

      nativeRateRef.current = audioContext.sampleRate;
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
      setIsFinalizing(false);
    } catch (startError: unknown) {
      phaseRef.current = "idle";
      teardownCapture();
      console.error("Error starting recording:", startError);
      const name = startError instanceof DOMException ? startError.name : "";
      setError(
        name === "NotAllowedError"
          ? "Microphone access denied. Allow microphone access and try again."
          : "Failed to start recording. Check your microphone and try again."
      );
    }
  }, [handleAudioFrame, modelStatus, resetLiveState, teardownCapture]);

  const pauseRecording = useCallback(() => {
    if (recordingState === "recording") {
      queueLiveWindow();
      phaseRef.current = "paused";
      setRecordingState("paused");
      setIsListening(false);
      return;
    }

    if (recordingState === "paused") {
      if (!streamRef.current || !audioContextRef.current) {
        void startRecording();
        return;
      }

      phaseRef.current = "recording";
      void audioContextRef.current.resume();
      setRecordingState("recording");
      setIsListening(true);
    }
  }, [queueLiveWindow, recordingState, startRecording]);

  const stopRecording = useCallback(async (options?: { finalize?: boolean }) => {
    const shouldFinalize = options?.finalize !== false;
    const sessionId = sessionIdRef.current;
    const native = mergeFloat32(chunksRef.current);
    const nativeRate = nativeRateRef.current;

    pendingLiveRef.current = null;
    teardownCapture();
    setRecordingState("idle");
    setIsListening(false);

    if (!shouldFinalize) {
      sessionIdRef.current += 1;
      phaseRef.current = "idle";
      setIsFinalizing(false);
      return;
    }

    phaseRef.current = "finalizing";
    setIsFinalizing(true);
    markTranscribeStart();

    try {
      const pcm = await resampleOffline(native, nativeRate, TARGET_SAMPLE_RATE);
      if (sessionId !== sessionIdRef.current) {
        return;
      }

      if (isSilent(pcm)) {
        committedRef.current = joinTranscript(
          committedRef.current,
          interimRef.current
        ).trim();
        interimRef.current = "";
        prevWindowTextRef.current = "";
        publishTranscript();
        return;
      }

      const text = await transcribePcm(pcm);
      if (sessionId !== sessionIdRef.current || phaseRef.current !== "finalizing") {
        return;
      }

      committedRef.current = text.trim();
      interimRef.current = "";
      prevWindowTextRef.current = "";
      publishTranscript();
    } catch (transcribeError: unknown) {
      console.error("Whisper final transcription failed", transcribeError);
      if (sessionId === sessionIdRef.current) {
        setError(
          transcribeError instanceof Error
            ? transcribeError.message
            : "Failed to transcribe audio on-device"
        );
      }
    } finally {
      if (sessionId === sessionIdRef.current) {
        phaseRef.current = "idle";
        setIsFinalizing(false);
      }
      markTranscribeEnd();
    }
  }, [markTranscribeEnd, markTranscribeStart, publishTranscript, teardownCapture]);

  const clearTranscription = useCallback(() => {
    sessionIdRef.current += 1;
    committedRef.current = "";
    interimRef.current = "";
    prevWindowTextRef.current = "";
    publishTranscript();
  }, [publishTranscript]);

  useEffect(() => {
    return () => {
      sessionIdRef.current += 1;
      teardownCapture();
    };
  }, [teardownCapture]);

  return {
    recordingState,
    transcription,
    committedTranscription,
    interimTranscription,
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
    isFinalizing,
  };
};
