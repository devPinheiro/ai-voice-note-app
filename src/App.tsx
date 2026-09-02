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
import { RouteWrapper } from "./components/molecules/route-wrapper";
import { UnauthorizedPage } from "./pages/UnauthorizedPage";
import { VoiceRecordingTest } from "./components/VoiceRecordingTest";

function ProtectedChat() {
  return (
    <RouteWrapper isProtected={true} redirectTo="/login">
      <ChatErrorBoundary>
        <ChatPage />
      </ChatErrorBoundary>
    </RouteWrapper>
  );
}

const AppRoutes = () => {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RouteWrapper redirectTo="/">
            <LoginPage />
          </RouteWrapper>
        }
      />

      <Route
        path="/signup"
        element={
          <RouteWrapper redirectTo="/">
            <SignUpPage />
          </RouteWrapper>
        }
      />

      <Route path="/whisper" element={<VoiceRecordingTest />} />

      <Route element={<ProtectedChat />}>
        <Route path="/" />
        <Route path="c/:conversationId" />
      </Route>

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
