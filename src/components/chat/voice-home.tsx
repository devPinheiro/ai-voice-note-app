import { LoaderCircle, Mic, Square, Upload } from "lucide-react";
import { useRef } from "react";
import type { ModelStatus, RecordingState } from "../../hooks/use-voice-recording";
import { cn } from "../../lib/utils";
import { LiveTranscript } from "./live-transcript";

const ACCEPT = "audio/*,video/mp4,video/quicktime,.mp3,.wav,.m4a,.aac,.ogg,.webm,.mp4,.mov";

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
  uploadName: string | null;
  uploadProgress: string | null;
  error: string | null;
  saving: boolean;
  onToggleRecord: () => void;
  onUpload: (file: File) => void;
  onSave: () => void;
  onClear: () => void;
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
  uploadName,
  uploadProgress,
  error,
  saving,
  onToggleRecord,
  onUpload,
  onSave,
  onClear,
}: VoiceHomeProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const isRecording = recordingState === "recording";
  const live = isRecording || isFinalizing || isTranscribing;
  const busy = isTranscribing || Boolean(uploadProgress) || saving;
  const canRecord = isSupported && modelStatus === "ready" && !uploadProgress;
  const showTranscript = live || Boolean(transcription.trim());
  const committed = live ? committedTranscription : transcription;
  const interim = live ? interimTranscription : "";

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
      <p className="mb-10 text-sm text-[#8e8e8e]">
        {modelStatus === "ready" ? "Whisper ready · on-device" : status}
      </p>

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
      <p className="mt-2 max-w-md text-center text-sm text-[#8e8e8e]">{status}</p>

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
              {isRecording ? "Live transcript" : isFinalizing ? "Refining" : "Transcript"}
            </p>
            <button
              type="button"
              onClick={onClear}
              disabled={live}
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
