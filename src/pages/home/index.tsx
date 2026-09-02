import { useMutation, useQuery } from "convex/react";
import { AlertCircle, LogOut, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { TranscriptionDisplay } from "../../components/molecules/transcription-display";
import { VoiceControls } from "../../components/molecules/voice-controls";
import { WhisperStatus } from "../../components/molecules/whisper-status";
import Aside from "../../components/molecules/aside";
import Main from "../../components/molecules/main";
import { useAuth } from "../../hooks/use-auth";
import { useVoiceRecording } from "../../hooks/use-voice-recording";
import AnimatedVoice from "./components/animated-voice";

function titleFromText(text: string) {
  const firstLine = text.split("\n")[0]?.trim() || "Untitled note";
  return firstLine.length <= 48 ? firstLine : `${firstLine.slice(0, 45).trimEnd()}…`;
}

const HomePage = () => {
  const { user, signOut } = useAuth();
  const notes = useQuery(api.notes.list);
  const createNote = useMutation(api.notes.create);
  const updateNote = useMutation(api.notes.update);
  const removeNote = useMutation(api.notes.remove);
  const [selectedNoteId, setSelectedNoteId] = useState<Id<"notes"> | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const syncedNoteIdRef = useRef<Id<"notes"> | null>(null);

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

  const selectedNote = notes?.find((note) => note._id === selectedNoteId) ?? null;

  useEffect(() => {
    if (selectedNoteId === syncedNoteIdRef.current) {
      return;
    }

    if (selectedNoteId && !notes?.some((note) => note._id === selectedNoteId)) {
      return;
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const nextNote = notes?.find((note) => note._id === selectedNoteId);
    syncedNoteIdRef.current = selectedNoteId;
    setDraftTitle(nextNote?.title ?? "");
    setDraftContent(nextNote?.content ?? "");
  }, [notes, selectedNoteId]);

  const scheduleNoteSave = (id: Id<"notes">, title: string, content: string) => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      void updateNote({
        id,
        title: title.trim() || "Untitled note",
        content,
      });
    }, 400);
  };

  const handleSaveTranscription = async (text: string) => {
    setSaveError(null);
    try {
      const title = titleFromText(text);
      const noteId = await createNote({
        title,
        content: text,
        source: "voice",
      });
      syncedNoteIdRef.current = noteId;
      setSelectedNoteId(noteId);
      setDraftTitle(title);
      setDraftContent(text);
      clearTranscription();
    } catch (noteError) {
      console.error("Failed to save note", noteError);
      setSaveError("Could not save that note. Try again in a moment.");
    }
  };

  const handleNewNote = () => {
    syncedNoteIdRef.current = null;
    setSelectedNoteId(null);
    setDraftTitle("");
    setDraftContent("");
    setSaveError(null);
    clearTranscription();
  };

  return (
    <div className="flex w-full h-screen">
      <Aside>
        <div className="p-4 border-b border-[#2d2d2d]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{user?.name || user?.email || "User"}</p>
              <p className="text-xs text-gray-400">AI Notepad</p>
            </div>
            <button
              onClick={() => signOut()}
              className="p-1 text-gray-400 hover:text-white transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4">
          <button
            onClick={handleNewNote}
            className="flex items-center gap-2 w-full text-left text-sm hover:bg-[#2d2d2d] rounded px-2 py-1 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Note
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {notes === undefined && (
            <p className="px-4 py-2 text-xs text-gray-500">Loading notes…</p>
          )}
          {notes?.length === 0 && (
            <p className="px-4 py-2 text-xs text-gray-500">
              No notes yet. Record something and save it.
            </p>
          )}
          {notes?.map((note) => (
            <div
              key={note._id}
              className={`group flex items-start gap-2 px-4 py-2 cursor-pointer border-b border-[#1a1a1a] transition-colors ${
                selectedNoteId === note._id ? "bg-[#2d2d2d]" : "hover:bg-[#2d2d2d]"
              }`}
            >
              <button
                className="flex-1 min-w-0 text-left"
                onClick={() => setSelectedNoteId(note._id)}
              >
                <div className="text-sm font-medium mb-1 truncate">{note.title}</div>
                <div className="text-xs text-gray-400 truncate">{note.content}</div>
              </button>
              <button
                className="p-1 text-gray-500 opacity-0 group-hover:opacity-100 hover:text-red-400"
                title="Delete note"
                onClick={(event) => {
                  event.stopPropagation();
                  void removeNote({ id: note._id });
                  if (selectedNoteId === note._id) {
                    setSelectedNoteId(null);
                  }
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </Aside>

      <Main>
        <div className="p-6 border-b border-[#2d2d2d] flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Welcome to AI Notepad</h1>
            <p className="text-sm text-gray-400 mt-1">
              Speak a note. Whisper transcribes it on this device, then you can save it.
            </p>
          </div>
          <WhisperStatus status={modelStatus} progress={modelProgress} />
        </div>

        <section
          role="region"
          aria-label="Voice controls"
          className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto"
        >
          {(error || saveError) && (
            <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{saveError || error}</span>
            </div>
          )}

          <div className="mb-8">
            <AnimatedVoice recordingState={recordingState} isListening={isListening} />
          </div>

          <div className="mb-6">
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

          <div className="text-center mb-8">
            {!isSupported ? (
              <>
                <h2 className="text-lg font-medium mb-2 text-red-400">Voice Recording Unavailable</h2>
                <p className="text-sm text-gray-400">This browser doesn't support microphone access</p>
              </>
            ) : modelStatus !== "ready" ? (
              <>
                <h2 className="text-lg font-medium mb-2">Preparing Whisper</h2>
                <p className="text-sm text-gray-400">
                  The local model downloads once, then stays on this device
                </p>
              </>
            ) : recordingState === "idle" ? (
              <>
                <h2 className="text-lg font-medium mb-2">Ready to Record</h2>
                <p className="text-sm text-gray-400">
                  Click the microphone to start. Audio never leaves this browser.
                </p>
              </>
            ) : recordingState === "recording" ? (
              <>
                <h2 className="text-lg font-medium mb-2 text-red-400">Recording Active</h2>
                <p className="text-sm text-gray-400">
                  Speak clearly. Chunks are transcribed locally as you go.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-lg font-medium mb-2 text-yellow-400">Recording Paused</h2>
                <p className="text-sm text-gray-400">Resume to keep going, or stop to finish</p>
              </>
            )}
          </div>

          <TranscriptionDisplay
            transcription={transcription}
            isListening={isListening}
            isTranscribing={isTranscribing}
            onClear={clearTranscription}
            onSave={handleSaveTranscription}
          />

          {selectedNote && (
            <div className="w-full max-w-2xl mx-auto mt-6 bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-6">
              <input
                value={draftTitle}
                onChange={(event) => {
                  const title = event.target.value;
                  setDraftTitle(title);
                  scheduleNoteSave(selectedNote._id, title, draftContent);
                }}
                className="w-full bg-transparent text-lg font-medium text-white outline-none mb-3"
              />
              <textarea
                value={draftContent}
                onChange={(event) => {
                  const content = event.target.value;
                  setDraftContent(content);
                  scheduleNoteSave(selectedNote._id, draftTitle, content);
                }}
                className="w-full min-h-[160px] bg-transparent text-sm text-gray-200 outline-none resize-y"
              />
            </div>
          )}
        </section>
      </Main>
    </div>
  );
};

export default HomePage;
