import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import "./index.css";
import App from "./App.tsx";

const DEFAULT_CONVEX_URL = "https://confident-ermine-605.convex.cloud";
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL || DEFAULT_CONVEX_URL;

const convex = new ConvexReactClient(CONVEX_URL);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <ConvexAuthProvider client={convex}>
        <App />
      </ConvexAuthProvider>
    </ConvexProvider>
  </StrictMode>
);
