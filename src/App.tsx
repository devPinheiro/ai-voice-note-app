import "./index.css";

import {
  Navigate,
  Route,
  BrowserRouter as Router,
  Routes,
} from "react-router-dom";

import ChatPage from "./pages/chat";
import { LoginPage } from "./pages/LoginPage";
import { SignUpPage } from "./pages/SignUpPage";
import { ChatErrorBoundary } from "./components/chat/error-boundary";
import { UnauthorizedPage } from "./pages/UnauthorizedPage";
import { VoiceRecordingTest } from "./components/VoiceRecordingTest";

function ChatShell() {
  return (
    <ChatErrorBoundary>
      <ChatPage />
    </ChatErrorBoundary>
  );
}

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<ChatShell />} />
      <Route path="/c/:conversationId" element={<ChatShell />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/whisper" element={<VoiceRecordingTest />} />
      <Route path="/dashboard" element={<Navigate to="/" replace />} />
      <Route path="/home" element={<Navigate to="/" replace />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}

export default App;
