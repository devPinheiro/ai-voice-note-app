import { Trash2, Copy, Save } from "lucide-react";
import { useState } from "react";

interface TranscriptionDisplayProps {
  transcription: string;
  isListening: boolean;
  isTranscribing?: boolean;
  onClear: () => void;
  onSave?: (text: string) => void;
}

export function TranscriptionDisplay({
  transcription,
  isListening,
  isTranscribing = false,
  onClear,
  onSave,
}: TranscriptionDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (transcription) {
      try {
        await navigator.clipboard.writeText(transcription);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy text:', err);
      }
    }
  };

  const handleSave = () => {
    if (onSave && transcription.trim()) {
      onSave(transcription.trim());
    }
  };

  if (!transcription && !isListening && !isTranscribing) {
    return null;
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-white">Transcription</h3>
          <div className="flex items-center gap-2">
            {transcription && (
              <>
                <button
                  onClick={handleCopy}
                  className="p-2 text-gray-400 hover:text-white transition-colors rounded-md hover:bg-[#2d2d2d]"
                  title="Copy to clipboard"
                >
                  <Copy className="w-4 h-4" />
                </button>
                
                {onSave && (
                  <button
                    onClick={handleSave}
                    className="p-2 text-gray-400 hover:text-white transition-colors rounded-md hover:bg-[#2d2d2d]"
                    title="Save as note"
                  >
                    <Save className="w-4 h-4" />
                  </button>
                )}
                
                <button
                  onClick={onClear}
                  className="p-2 text-gray-400 hover:text-red-400 transition-colors rounded-md hover:bg-[#2d2d2d]"
                  title="Clear transcription"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Transcription Content */}
        <div className="min-h-[120px] max-h-[300px] overflow-y-auto">
          {(isListening || isTranscribing) && !transcription && (
            <div className="text-gray-400 italic">
              {isTranscribing ? "Transcribing on-device..." : "Listening for speech..."}
            </div>
          )}
          
          {transcription && (
            <div className="text-white whitespace-pre-wrap leading-relaxed">
              {transcription}
              {(isListening || isTranscribing) && (
                <span className="inline-block w-2 h-5 bg-blue-500 ml-1 animate-pulse"></span>
              )}
            </div>
          )}
          
          {!transcription && !isListening && (
            <div className="text-gray-500 italic">
              No transcription yet. Start recording to see your speech transcribed here.
            </div>
          )}
        </div>

        {/* Copy confirmation */}
        {copied && (
          <div className="mt-3 text-sm text-green-400">
            ✓ Copied to clipboard
          </div>
        )}

        {/* Word count */}
        {transcription && (
          <div className="mt-3 text-xs text-gray-500 border-t border-[#2d2d2d] pt-3">
            {transcription.trim().split(/\s+/).length} words • {transcription.length} characters
          </div>
        )}
      </div>
    </div>
  );
}