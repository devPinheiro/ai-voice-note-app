/// <reference lib="webworker" />

import { env, pipeline, type ProgressCallback } from "@huggingface/transformers";
import type { TranscribeOptions } from "./types";

env.allowLocalModels = false;
env.useBrowserCache = true;

if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.proxy = false;
  env.backends.onnx.wasm.numThreads = 1;
}

const MODEL_ID = "Xenova/whisper-tiny.en";

type IncomingMessage =
  | { type: "load" }
  | { type: "transcribe"; id: string; audio: Float32Array; options?: TranscribeOptions };

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

function buildDecoderInputIds(prompt: string | undefined) {
  const text = prompt?.trim();
  if (!text || !transcriber) {
    return undefined;
  }

  const tokenizer = transcriber.tokenizer;
  const startOfPrev = tokenizer.convert_tokens_to_ids("<|startofprev|>");
  const startOfTranscript = tokenizer.convert_tokens_to_ids("<|startoftranscript|>");
  const noTimestamps = tokenizer.convert_tokens_to_ids("<|notimestamps|>");

  if (
    typeof startOfPrev !== "number" ||
    typeof startOfTranscript !== "number" ||
    typeof noTimestamps !== "number" ||
    startOfPrev < 0 ||
    startOfTranscript < 0 ||
    noTimestamps < 0
  ) {
    return undefined;
  }

  const promptIds = tokenizer.encode(` ${text}`, { add_special_tokens: false }).slice(-180);
  if (promptIds.length === 0) {
    return undefined;
  }

  return [startOfPrev, ...promptIds, startOfTranscript, noTimestamps];
}

function stripPromptEcho(text: string, prompt: string | undefined) {
  const prefix = prompt?.trim();
  if (!prefix || !text) {
    return text;
  }

  const lowerText = text.trimStart();
  const lowerPrompt = prefix.toLowerCase();
  if (lowerText.toLowerCase().startsWith(lowerPrompt)) {
    return lowerText.slice(prefix.length).trim();
  }

  return text;
}

async function transcribeAudio(audio: Float32Array, options?: TranscribeOptions) {
  if (!transcriber) {
    throw new Error("Whisper model is not loaded yet");
  }

  const decoderInputIds = buildDecoderInputIds(options?.prompt);
  const generate: Record<string, unknown> = {};

  if (options?.chunk_length_s && options.chunk_length_s > 0) {
    generate.chunk_length_s = options.chunk_length_s;
    generate.stride_length_s = options.stride_length_s ?? options.chunk_length_s / 6;
  }

  if (decoderInputIds) {
    generate.decoder_input_ids = decoderInputIds;
  }

  try {
    const result = await transcriber(audio, generate);
    const text =
      result && typeof result === "object" && "text" in result ? String(result.text) : "";
    return stripPromptEcho(text.trim(), options?.prompt);
  } catch (error) {
    if (!decoderInputIds) {
      throw error;
    }

    console.warn("Whisper prompt decode failed, retrying without prompt", error);
    const fallback = { ...generate };
    delete fallback.decoder_input_ids;
    const result = await transcriber(audio, fallback);
    const text =
      result && typeof result === "object" && "text" in result ? String(result.text) : "";
    return text.trim();
  }
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
      const text = await transcribeAudio(message.audio, message.options);
      self.postMessage({ type: "result", id: message.id, text });
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
