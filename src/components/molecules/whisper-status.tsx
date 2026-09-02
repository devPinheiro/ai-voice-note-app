import { LoaderCircle, ShieldCheck } from "lucide-react";
import type { ModelStatus } from "../../hooks/use-voice-recording";

interface WhisperStatusProps {
  status: ModelStatus;
  progress: number;
}

export function WhisperStatus({ status, progress }: WhisperStatusProps) {
  if (status === "ready") {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
        <ShieldCheck className="h-3.5 w-3.5" />
        Whisper ready · on-device
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs text-red-300">
        Whisper failed to load
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-300">
      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
      Downloading Whisper {progress > 0 ? `${progress}%` : ""}
    </div>
  );
}
