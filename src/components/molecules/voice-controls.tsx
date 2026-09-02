import { Mic, Square, Play, Pause } from "lucide-react";
import type { RecordingState } from "../../hooks/use-voice-recording";

interface VoiceControlsProps {
  recordingState: RecordingState;
  isListening: boolean;
  isSupported: boolean;
  disabled?: boolean;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
}

export function VoiceControls({
  recordingState,
  isListening,
  isSupported,
  disabled = false,
  onStart,
  onPause,
  onStop,
}: VoiceControlsProps) {
  if (!isSupported) {
    return (
      <div className="text-center p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
        <p className="text-red-400 text-sm">
          Voice recording is not supported in this browser
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-4">
      {/* Main Action Button - changes based on state */}
      {recordingState === 'idle' && (
        <button
          onClick={onStart}
          disabled={disabled}
          className="p-4 rounded-full text-white bg-blue-500 hover:bg-blue-600 transition-all duration-200 shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
          title="Start Recording"
        >
          <Mic className="w-6 h-6" />
        </button>
      )}

      {recordingState === 'recording' && (
        <>
          <button
            onClick={onPause}
            className="p-3 rounded-full bg-yellow-500 hover:bg-yellow-600 text-white transition-colors shadow-lg"
            title="Pause Recording"
          >
            <Pause className="w-5 h-5" />
          </button>
          
          <button
            onClick={onStop}
            className="p-3 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors shadow-lg"
            title="Stop Recording"
          >
            <Square className="w-5 h-5" />
          </button>
        </>
      )}

      {recordingState === 'paused' && (
        <>
          <button
            onClick={onPause}
            className="p-3 rounded-full bg-green-500 hover:bg-green-600 text-white transition-colors shadow-lg"
            title="Resume Recording"
          >
            <Play className="w-5 h-5" />
          </button>
          
          <button
            onClick={onStop}
            className="p-3 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors shadow-lg"
            title="Stop Recording"
          >
            <Square className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Status indicator */}
      <div className="ml-4 flex items-center gap-2 text-sm min-w-[100px]">
        {recordingState === 'recording' && isListening && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-red-400">Recording...</span>
          </div>
        )}
        
        {recordingState === 'paused' && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            <span className="text-yellow-400">Paused</span>
          </div>
        )}

        {recordingState === 'idle' && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
            <span className="text-gray-400">Ready</span>
          </div>
        )}
      </div>
    </div>
  );
}