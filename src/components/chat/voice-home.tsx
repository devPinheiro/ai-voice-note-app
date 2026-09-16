import { LoaderCircle, Mic, Square, Upload } from "lucide-react";
import { useRef } from "react";
import type { ModelStatus, RecordingState } from "../../hooks/use-voice-recording";
import type { WhisperQuality } from "../../lib/whisper/models";
import { QUALITY_LABELS } from "../../lib/whisper/models";
import { cn } from "../../lib/utils";
import { LiveTranscript } from "./live-transcript";

const ACCEPT = "audio/*,video/mp4,video/quicktime,.mp3,.wav,.m4a,.aac,.ogg,.webm,.mp4,.mov";
const QUALITIES: WhisperQuality[] = ["fast", "balanced", "high"];

interface VoiceHomeProps {
  transcription: string;
  committedTranscription: string;
  interimTranscription: string;
  recordingState: RecordingState;
  isListening: boolean;
  isTranscribing: boolean;
  isFinalizing: boolean;
  isSupported: boolean;
  modelStatus: ModelStatus;
  modelProgress: number;
  modelLabel: string;
  quality: WhisperQuality;
  accurateReady: boolean;
  uploadName: string | null;
  uploadProgress: string | null;
  error: string | null;
  saving: boolean;
  onToggleRecord: () => void;
  onUpload: (file: File) => void;
  onSave: () => void;
  onClear: () => void;
  onQualityChange: (quality: WhisperQuality) => void;
}

export function VoiceHome({
  transcription,
  committedTranscription,
  interimTranscription,
  recordingState,
  isListening,
  isTranscribing,
  isFinalizing,
  isSupported,
  modelStatus,
  modelProgress,
  modelLabel,
  quality,
  accurateReady,
  uploadName,
  uploadProgress,
  error,
  saving,
  onToggleRecord,
  onUpload,
  onSave,
  onClear,
  onQualityChange,
}: VoiceHomeProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const isRecording = recordingState === "recording";
  const live = isRecording || isFinalizing || isTranscribing;
  const busy = isTranscribing || Boolean(uploadProgress) || saving;
  const canRecord = isSupported && modelStatus === "ready" && !uploadProgress;
  const showTranscript = live || Boolean(transcription.trim()) || Boolean(uploadProgress);
  const committed = live ? committedTranscription : transcription;
  const interim = live ? interimTranscription : "";
  const qualityLocked = live || Boolean(uploadProgress) || modelStatus !== "ready";

  const status =
    modelStatus === "loading"
      ? `Downloading Whisper${modelProgress > 0 ? ` ${modelProgress}%` : ""}`
      : modelStatus === "error"
        ? "Whisper failed to load"
        : uploadProgress
          ? uploadProgress
          : isRecording
            ? "Listening…"
            : isFinalizing
              ? "Refining transcript…"
              : isTranscribing
                ? "Transcribing on-device…"
                : "Tap to speak, or upload audio / mp4";

  return (
    <section className="flex flex-1 flex-col items-center justify-center px-4 py-8">
      <p className="mb-4 text-sm text-[#8e8e8e]">
        {modelStatus === "ready" ? modelLabel : status}
      </p>

      <div className="mb-8 inline-flex rounded-full border border-white/10 bg-[#2a2a2a] p-1">
        {QUALITIES.map((option) => (
          <button
            key={option}
            type="button"
            disabled={qualityLocked}
            onClick={() => onQualityChange(option)}
            title={
              option === "fast"
                ? "tiny.en for live and files"
                : option === "high"
                  ? "tiny.en live, small.en for files when WebGPU allows"
                  : "tiny.en live, base.en for files when WebGPU allows"
            }
            className={cn(
              "rounded-full px-3 py-1 text-xs transition-colors disabled:opacity-40",
              quality === option ? "bg-white text-black" : "text-[#8e8e8e] hover:text-white"
            )}
          >
            {QUALITY_LABELS[option]}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onToggleRecord}
        disabled={!canRecord || isFinalizing}
        title={isRecording ? "Stop recording" : "Start recording"}
        className={cn(
          "relative flex h-44 w-44 items-center justify-center rounded-full transition-transform disabled:opacity-40",
          isRecording
            ? "bg-red-500 shadow-[0_0_48px_rgba(239,68,68,0.45)] scale-105"
            : "bg-[#303030] hover:bg-[#3a3a3a] hover:scale-[1.02]"
        )}
      >
        {isRecording && (
          <span className="absolute inset-0 rounded-full border-4 border-white/20 animate-ping" />
        )}
        {modelStatus === "loading" ? (
          <LoaderCircle className="h-12 w-12 animate-spin text-[#ececec]" />
        ) : isRecording ? (
          <Square className={cn("h-10 w-10 fill-white text-white", isListening && "scale-110")} />
        ) : (
          <Mic className="h-12 w-12 text-[#ececec]" />
        )}
      </button>

      <h1 className="mt-8 text-center text-3xl font-semibold tracking-tight">
        {isRecording ? "Listening" : isFinalizing ? "Refining" : uploadProgress ? "Transcribing file" : "Speak a note"}
      </h1>
      <p className="mt-2 max-w-md text-center text-sm text-[#8e8e8e]">
        {modelStatus === "ready" && !accurateReady && !uploadProgress && !live
          ? "Live captions are ready. Higher-accuracy refine is still loading."
          : status}
      </p>

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) {
            onUpload(file);
          }
        }}
      />

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={modelStatus !== "ready" || isRecording || busy}
        className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-[#ececec] hover:bg-white/5 disabled:opacity-40"
      >
        {uploadProgress ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {uploadName ? `Uploading ${uploadName}` : "Upload audio or mp4"}
      </button>

      {error && <p className="mt-4 max-w-md text-center text-sm text-red-400">{error}</p>}

      {showTranscript && (
        <div className="mt-8 w-full max-w-2xl rounded-2xl border border-white/10 bg-[#2a2a2a] p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-wide text-[#8e8e8e]">
              {isRecording
                ? "Live transcript"
                : isFinalizing
                  ? "Refining"
                  : uploadProgress
                    ? "Transcribing"
                    : "Transcript"}
            </p>
            <button
              type="button"
              onClick={onClear}
              disabled={live || Boolean(uploadProgress)}
              className="text-xs text-[#8e8e8e] hover:text-white disabled:opacity-40"
            >
              Clear
            </button>
          </div>
          <LiveTranscript
            committed={committed}
            interim={interim}
            active={live}
            emptyLabel={isFinalizing ? "Refining transcript…" : "Listening…"}
            className="text-[15px] leading-7 text-[#ececec]"
          />
          <button
            type="button"
            onClick={onSave}
            disabled={!transcription.trim() || busy || isRecording || isFinalizing}
            className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-medium text-black hover:bg-[#ececec] disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save note"}
          </button>
        </div>
      )}
    </section>
  );
}
