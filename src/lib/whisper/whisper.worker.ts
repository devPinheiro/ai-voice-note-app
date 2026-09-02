/// <reference lib="webworker" />

import { env, pipeline, type ProgressCallback } from "@huggingface/transformers";

env.allowLocalModels = false;
env.useBrowserCache = true;

if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.proxy = false;
  env.backends.onnx.wasm.numThreads = 1;
}

const MODEL_ID = "Xenova/whisper-tiny.en";

type IncomingMessage =
  | { type: "load" }
  | { type: "transcribe"; id: string; audio: Float32Array };

type Transcriber = Awaited<ReturnType<typeof pipeline<"automatic-speech-recognition">>>;

let transcriber: Transcriber | null = null;

async function loadTranscriber() {
  const reportProgress: ProgressCallback = (data) => {
    self.postMessage({ type: "progress", data });
  };

  if (typeof navigator !== "undefined" && "gpu" in navigator) {
    try {
      transcriber = await pipeline("automatic-speech-recognition", MODEL_ID, {
        device: "webgpu",
        dtype: {
          encoder_model: "fp32",
          decoder_model_merged: "q4",
        },
        progress_callback: reportProgress,
      });
      return "webgpu";
    } catch (error) {
      console.warn("WebGPU Whisper failed, falling back to WASM", error);
    }
  }

  transcriber = await pipeline("automatic-speech-recognition", MODEL_ID, {
    device: "wasm",
    dtype: "q8",
    progress_callback: reportProgress,
  });

  return "wasm";
}

self.onmessage = async (event: MessageEvent<IncomingMessage>) => {
  const message = event.data;

  try {
    if (message.type === "load") {
      if (!transcriber) {
        const device = await loadTranscriber();
        self.postMessage({ type: "ready", device });
        return;
      }

      self.postMessage({ type: "ready" });
      return;
    }

    if (message.type === "transcribe") {
      if (!transcriber) {
        throw new Error("Whisper model is not loaded yet");
      }

      const result = await transcriber(message.audio);

      const text =
        result && typeof result === "object" && "text" in result
          ? String(result.text)
          : "";

      self.postMessage({ type: "result", id: message.id, text: text.trim() });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Whisper failed";
    self.postMessage({
      type: "error",
      id: message.type === "transcribe" ? message.id : undefined,
      message: errorMessage,
    });
  }
};
