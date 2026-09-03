import { ArrowUp, LoaderCircle, Mic, Square, Upload } from "lucide-react";
import { useEffect, useRef, type FormEvent, type KeyboardEvent } from "react";
import type { ModelStatus, RecordingState } from "../../hooks/use-voice-recording";
import { cn } from "../../lib/utils";
import { LiveTranscript } from "./live-transcript";

const ACCEPT = "audio/*,video/mp4,video/quicktime,.mp3,.wav,.m4a,.aac,.ogg,.webm,.mp4,.mov";

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  recordingState: RecordingState;
  isTranscribing: boolean;
  isFinalizing?: boolean;
  liveCommitted?: string;
  liveInterim?: string;
  modelStatus: ModelStatus;
  modelProgress: number;
  isSupported: boolean;
  onToggleVoice: () => void;
  onUpload?: (file: File) => void;
  uploading?: boolean;
}

export function PromptInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  recordingState,
  isTranscribing,
  isFinalizing = false,
  liveCommitted = "",
  liveInterim = "",
  modelStatus,
  modelProgress,
  isSupported,
  onToggleVoice,
  onUpload,
  uploading = false,
}: PromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const isRecording = recordingState === "recording";
  const live = isRecording || isFinalizing;
  const canSend = value.trim().length > 0 && !disabled && !live;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el || live) {
      return;
    }
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [live, value]);

  const handleSubmit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!canSend) {
      return;
    }
    onSubmit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const voiceLabel =
    modelStatus !== "ready"
      ? `Downloading Whisper${modelProgress > 0 ? ` ${modelProgress}%` : ""}`
      : isRecording
        ? "Stop recording"
        : "Start voice input";

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="rounded-[28px] border border-white/10 bg-[#303030] shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.24)]">
        {live ? (
          <div className="max-h-[200px] min-h-[52px] overflow-y-auto px-5 pt-4 pb-2 text-[16px] leading-6 text-[#ececec]">
            <LiveTranscript
              committed={liveCommitted}
              interim={liveInterim}
              active
              emptyLabel={isFinalizing ? "Refining transcript…" : "Listening…"}
            />
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={isTranscribing ? "Transcribing on-device…" : "Ask anything"}
            className="max-h-[200px] min-h-[52px] w-full resize-none bg-transparent px-5 pt-4 pb-2 text-[16px] leading-6 text-[#ececec] outline-none placeholder:text-[#8e8e8e]"
          />
        )}

        <div className="flex items-center justify-between px-2 pb-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToggleVoice}
              disabled={!isSupported || modelStatus === "error" || isFinalizing}
              title={voiceLabel}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full text-[#b4b4b4] transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40",
                isRecording && "bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300",
                modelStatus === "loading" && "text-blue-300"
              )}
            >
              {modelStatus === "loading" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : isRecording ? (
                <Square className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>
            {modelStatus === "loading" && (
              <span className="text-xs text-[#8e8e8e]">Whisper {modelProgress}%</span>
            )}
            {onUpload && (
              <>
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
                  disabled={modelStatus !== "ready" || live || uploading}
                  title="Upload audio or mp4"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[#b4b4b4] hover:bg-white/10 hover:text-white disabled:opacity-40"
                >
                  {uploading ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                </button>
              </>
            )}
            {isRecording && <span className="text-xs text-[#8e8e8e]">Listening…</span>}
            {isFinalizing && <span className="text-xs text-[#8e8e8e]">Refining…</span>}
            {!live && isTranscribing && (
              <span className="text-xs text-[#8e8e8e]">Transcribing…</span>
            )}
          </div>

          <button
            type="submit"
            disabled={!canSend}
            title="Send"
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
              canSend
                ? "bg-white text-black hover:bg-[#ececec]"
                : "bg-[#424242] text-[#8e8e8e]"
            )}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </form>
  );
}
