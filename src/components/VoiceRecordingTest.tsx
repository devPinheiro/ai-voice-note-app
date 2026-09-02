import { VoiceControls } from "./molecules/voice-controls";
import { TranscriptionDisplay } from "./molecules/transcription-display";
import { WhisperStatus } from "./molecules/whisper-status";
import { useVoiceRecording } from "../hooks/use-voice-recording";

export const VoiceRecordingTest = () => {
  const {
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
  } = useVoiceRecording();

  const handleSave = (text: string) => {
    console.log("Save transcription:", text);
    alert(`Saving: "${text}"`);
  };

  return (
    <div className="min-h-screen bg-[#212020] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4 text-center">On-device Whisper</h1>
        <div className="flex justify-center mb-8">
          <WhisperStatus status={modelStatus} progress={modelProgress} />
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400">
            <strong>Error:</strong> {error}
          </div>
        )}

        <div className="mb-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
          <p>
            <strong>Microphone:</strong>{" "}
            <span className={isSupported ? "text-green-400" : "text-red-400"}>
              {isSupported ? "Available" : "Not available"}
            </span>
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Audio is transcribed locally with Whisper. Nothing is sent to a speech API.
          </p>
        </div>

        <div className="mb-8 flex justify-center">
          <VoiceControls
            recordingState={recordingState}
            isListening={isListening}
            isSupported={isSupported}
            disabled={modelStatus !== "ready"}
            onStart={startRecording}
            onPause={pauseRecording}
            onStop={stopRecording}
          />
        </div>

        <div className="mb-6 text-center">
          <p className="text-lg">
            <strong>State:</strong> {recordingState}
          </p>
          <p className="text-sm text-gray-400">
            {isTranscribing
              ? "Transcribing on-device"
              : isListening
                ? "Listening"
                : "Idle"}
          </p>
        </div>

        <TranscriptionDisplay
          transcription={transcription}
          isListening={isListening}
          isTranscribing={isTranscribing}
          onClear={clearTranscription}
          onSave={handleSave}
        />
      </div>
    </div>
  );
};
