import { useMutation, useQuery } from "convex/react";
import { Menu } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ChatMessage } from "../../components/chat/chat-message";
import { ChatSidebar } from "../../components/chat/chat-sidebar";
import { PromptInput } from "../../components/chat/prompt-input";
import { VoiceHome } from "../../components/chat/voice-home";
import { useAuth } from "../../hooks/use-auth";
import { useVoiceRecording } from "../../hooks/use-voice-recording";
import { decodeMediaFile } from "../../lib/whisper/audio";
import { transcribePcm } from "../../lib/whisper/transcribe-media";

function joinText(current: string, next: string) {
  const incoming = next.trim();
  if (!incoming) {
    return current;
  }
  if (!current.trim()) {
    return incoming;
  }
  const needsSpace = !current.endsWith(" ") && !incoming.startsWith(" ");
  return `${current}${needsSpace ? " " : ""}${incoming}`;
}

const ChatPage = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, signOut } = useAuth();
  const conversations = useQuery(api.conversations.list);
  const sendMessage = useMutation(api.conversations.send);
  const removeConversation = useMutation(api.conversations.remove);

  const activeId = (conversationId as Id<"conversations"> | undefined) ?? null;
  const messages = useQuery(
    api.conversations.listMessages,
    activeId ? { conversationId: activeId } : "skip"
  );

  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= 768
  );
  const [source, setSource] = useState<"text" | "voice">("voice");
  const [sending, setSending] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const baselineRef = useRef("");
  const threadRef = useRef<HTMLDivElement>(null);

  const {
    recordingState,
    transcription,
    committedTranscription,
    interimTranscription,
    isListening,
    startRecording,
    stopRecording,
    clearTranscription,
    error,
    isSupported,
    modelStatus,
    modelProgress,
    isTranscribing,
    isFinalizing,
  } = useVoiceRecording();

  const userName = user?.name || user?.email || "Guest";
  const hasMessages = (messages?.length ?? 0) > 0;
  const isHome = !activeId;

  useEffect(() => {
    if (recordingState === "recording" || isFinalizing || transcription) {
      setInput(joinText(baselineRef.current, transcription));
      if (transcription) {
        setSource("voice");
      }
    }
  }, [isFinalizing, recordingState, transcription]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [messages]);

  const resetComposer = () => {
    baselineRef.current = "";
    setInput("");
    setSource("voice");
    setFileError(null);
    setUploadName(null);
    setUploadProgress(null);
    clearTranscription();
  };

  const handleNewChat = () => {
    if (recordingState === "recording") {
      void stopRecording({ finalize: false });
    }
    resetComposer();
    navigate("/");
  };

  const saveTranscript = async (content: string, nextSource: "text" | "voice" = source) => {
    const text = content.trim();
    if (!text || sending) {
      return;
    }

    if (recordingState === "recording") {
      await stopRecording();
    }

    setSending(true);
    try {
      const result = await sendMessage({
        conversationId: activeId ?? undefined,
        content: text,
        source: nextSource,
      });
      resetComposer();
      if (!activeId || result.conversationId !== activeId) {
        navigate(`/c/${result.conversationId}`);
      }
    } finally {
      setSending(false);
    }
  };

  const handleToggleVoice = () => {
    if (recordingState === "recording") {
      void stopRecording();
      return;
    }

    if (isFinalizing) {
      return;
    }

    baselineRef.current = input;
    clearTranscription();
    setFileError(null);
    void startRecording();
  };

  const handleUpload = async (file: File) => {
    if (modelStatus !== "ready") {
      setFileError("Whisper is still loading. Try the file again in a moment.");
      return;
    }

    if (recordingState === "recording") {
      await stopRecording({ finalize: false });
    }

    setFileError(null);
    setUploadName(file.name);
    setUploadProgress(`Reading ${file.name}…`);
    setSource("voice");

    try {
      const audio = await decodeMediaFile(file);
      setUploadProgress("Transcribing on-device…");
      const text = await transcribePcm(audio, (done, total) => {
        setUploadProgress(`Transcribing ${done} of ${total}…`);
      });

      if (!text.trim()) {
        setFileError("No speech found in that file.");
        return;
      }

      setInput((current) => joinText(current, text));
      if (isHome) {
        clearTranscription();
      }
    } catch (uploadError) {
      setFileError(
        uploadError instanceof Error ? uploadError.message : "Could not transcribe that file"
      );
    } finally {
      setUploadName(null);
      setUploadProgress(null);
    }
  };

  const displayedHomeText = input || transcription;
  const prevActiveRef = useRef(activeId);

  useEffect(() => {
    if (prevActiveRef.current === activeId) {
      return;
    }

    prevActiveRef.current = activeId;
    void stopRecording({ finalize: false });
    baselineRef.current = "";
    setInput("");
    setSource("voice");
    setFileError(null);
    setUploadName(null);
    setUploadProgress(null);
    clearTranscription();
  }, [activeId, clearTranscription, stopRecording]);

  return (
    <div className="dark flex h-dvh bg-[#212121] text-[#ececec]">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      )}

      <div
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } fixed inset-y-0 left-0 z-30 md:static md:translate-x-0`}
      >
        <ChatSidebar
          userName={userName}
          conversations={conversations}
          activeId={activeId}
          collapsed={!sidebarOpen}
          onToggle={() => setSidebarOpen((open) => !open)}
          onNewChat={handleNewChat}
          onSelect={(id) => {
            navigate(`/c/${id}`);
            if (window.innerWidth < 768) {
              setSidebarOpen(false);
            }
          }}
          onDelete={(id) => {
            void removeConversation({ id });
            if (activeId === id) {
              navigate("/");
            }
          }}
          onSignOut={isAuthenticated ? () => void signOut() : undefined}
        />
      </div>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 px-3 py-2 md:px-4">
          {!sidebarOpen && (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#b4b4b4] hover:bg-white/10 hover:text-white md:hidden"
              title="Open sidebar"
            >
              <Menu className="h-4 w-4" />
            </button>
          )}
          <h1 className="text-sm font-medium text-[#ececec]">
            {activeId
              ? conversations?.find((conversation) => conversation._id === activeId)?.title ||
                "Chat"
              : "Voice"}
          </h1>
        </header>

        {isHome ? (
          <VoiceHome
            transcription={displayedHomeText}
            committedTranscription={committedTranscription}
            interimTranscription={interimTranscription}
            recordingState={recordingState}
            isListening={isListening}
            isTranscribing={isTranscribing}
            isFinalizing={isFinalizing}
            isSupported={isSupported}
            modelStatus={modelStatus}
            modelProgress={modelProgress}
            uploadName={uploadName}
            uploadProgress={uploadProgress}
            error={fileError || error}
            saving={sending}
            onToggleRecord={handleToggleVoice}
            onUpload={(file) => void handleUpload(file)}
            onSave={() => void saveTranscript(displayedHomeText, "voice")}
            onClear={resetComposer}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div ref={threadRef} className="flex-1 overflow-y-auto">
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
                {hasMessages ? (
                  messages?.map((message) => (
                    <ChatMessage key={message._id} message={message} />
                  ))
                ) : (
                  <p className="text-center text-sm text-[#8e8e8e]">
                    Speak, type, or upload audio into this chat.
                  </p>
                )}
              </div>
            </div>

            <div className="mx-auto w-full max-w-3xl px-4 pb-3">
              {(error || fileError) && (
                <p className="mb-2 text-center text-xs text-red-400">{fileError || error}</p>
              )}

              <PromptInput
                value={input}
                onChange={(value) => {
                  setInput(value);
                  if (recordingState === "idle" && !uploadProgress && !isFinalizing) {
                    setSource("text");
                  }
                }}
                onSubmit={() => void saveTranscript(input)}
                disabled={sending}
                recordingState={recordingState}
                isTranscribing={isTranscribing}
                isFinalizing={isFinalizing}
                liveCommitted={joinText(baselineRef.current, committedTranscription)}
                liveInterim={interimTranscription}
                modelStatus={modelStatus}
                modelProgress={modelProgress}
                isSupported={isSupported}
                onToggleVoice={handleToggleVoice}
                onUpload={(file) => void handleUpload(file)}
                uploading={Boolean(uploadProgress)}
              />

              <p className="mt-3 pb-2 text-center text-[11px] text-[#8e8e8e]">
                Whisper runs on this device. Audio never leaves the browser.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ChatPage;
