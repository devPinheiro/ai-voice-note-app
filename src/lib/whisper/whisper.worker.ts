/// <reference lib="webworker" />

import { env, pipeline, type ProgressCallback } from "@huggingface/transformers";
import {
  LIVE_MODEL_ID,
  accurateCandidates,
  failedModelKey,
  isDeviceFailure,
  isLocalhostHost,
  type WhisperDevice,
  type WhisperDevicePrefs,
  type WhisperPass,
} from "./models";
import type { TranscribeOptions } from "./types";

env.useBrowserCache = true;
env.allowLocalModels = false;

if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.proxy = false;
  env.backends.onnx.wasm.numThreads = 1;
}

type IncomingMessage =
  | { type: "load"; prefs: WhisperDevicePrefs }
  | { type: "reload-accurate"; prefs: WhisperDevicePrefs }
  | {
      type: "transcribe";
      id: string;
      audio: Float32Array;
      options?: TranscribeOptions;
      pass?: WhisperPass;
    };

type Transcriber = Awaited<ReturnType<typeof pipeline<"automatic-speech-recognition">>>;

type LoadedModel = {
  transcriber: Transcriber;
  modelId: string;
  device: WhisperDevice;
};

let live: LoadedModel | null = null;
let accurate: LoadedModel | null = null;
let prefs: WhisperDevicePrefs | null = null;
let accurateTask: Promise<void> | null = null;
let accurateGeneration = 0;
let queue: Promise<void> = Promise.resolve();

function serialize<T>(fn: () => Promise<T>) {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function hostname() {
  try {
    return self.location?.hostname ?? "";
  } catch {
    return "";
  }
}

async function hasLocalModel(modelId: string) {
  if (!isLocalhostHost(hostname())) {
    return false;
  }

  try {
    const response = await fetch(`/models/${modelId}/config.json`);
    if (!response.ok) {
      return false;
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("text/html")) {
      return false;
    }
    const body = await response.text();
    const parsed = JSON.parse(body) as { model_type?: string };
    return Boolean(parsed && typeof parsed === "object");
  } catch {
    return false;
  }
}

async function configureModelSource(modelId: string) {
  const local = await hasLocalModel(modelId);
  Object.assign(env, {
    allowLocalModels: local,
    allowRemoteModels: true,
    useBrowserCache: true,
    ...(local ? { localModelPath: "/models/" } : {}),
  });
}

async function probeWebGpu() {
  const gpu = (self.navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } })
    .gpu;
  if (!gpu) {
    return false;
  }
  try {
    return Boolean(await gpu.requestAdapter());
  } catch {
    return false;
  }
}

function markFailed(modelId: string, device: WhisperDevice) {
  if (!prefs) {
    return;
  }
  const key = failedModelKey(modelId, device);
  if (!prefs.failedModels.includes(key)) {
    prefs.failedModels = [...prefs.failedModels, key];
  }
  if (device === "webgpu") {
    prefs.webgpuFailed = true;
  }
}

function publishPrefs() {
  if (prefs) {
    self.postMessage({ type: "prefs", prefs });
  }
}

function dtypesFor(device: WhisperDevice) {
  if (device === "webgpu") {
    return [
      { encoder_model: "fp32", decoder_model_merged: "q4" },
      { encoder_model: "fp32", decoder_model_merged: "q8" },
      { encoder_model: "fp16", decoder_model_merged: "fp16" },
      "fp32",
      "q8",
    ] as const;
  }
  return ["q8", "fp32"] as const;
}

async function createTranscriber(
  modelId: string,
  device: WhisperDevice,
  reportProgress: ProgressCallback
) {
  await configureModelSource(modelId);
  let lastError: unknown;
  for (const dtype of dtypesFor(device)) {
    try {
      return await pipeline("automatic-speech-recognition", modelId, {
        device,
        dtype,
        progress_callback: reportProgress,
      });
    } catch (error) {
      lastError = error;
      if (isDeviceFailure(error)) {
        throw error;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Failed to load ${modelId}`);
}

async function tryLoadModel(
  modelId: string,
  device: WhisperDevice,
  reportProgress: ProgressCallback
): Promise<LoadedModel> {
  const transcriber = await createTranscriber(modelId, device, reportProgress);
  return { transcriber, modelId, device };
}

async function loadLive(reportProgress: ProgressCallback) {
  if (live) {
    return live.device;
  }

  const preferWebGpu = Boolean(prefs && !prefs.webgpuFailed && (await probeWebGpu()));

  if (preferWebGpu) {
    try {
      live = await tryLoadModel(LIVE_MODEL_ID, "webgpu", reportProgress);
      if (prefs) {
        prefs.device = "webgpu";
        prefs.liveModel = LIVE_MODEL_ID;
        prefs.webgpuFailed = false;
      }
      return "webgpu" as const;
    } catch (error) {
      console.warn("WebGPU Whisper failed, falling back to WASM", error);
      if (isDeviceFailure(error)) {
        markFailed(LIVE_MODEL_ID, "webgpu");
      }
    }
  }

  live = await tryLoadModel(LIVE_MODEL_ID, "wasm", reportProgress);
  if (prefs) {
    prefs.device = "wasm";
    prefs.liveModel = LIVE_MODEL_ID;
  }
  return "wasm" as const;
}

function publishAccurateReady(model: LoadedModel) {
  if (prefs) {
    prefs.accurateModel = model.modelId;
    prefs.device = model.device;
    publishPrefs();
  }
  self.postMessage({
    type: "accurate-ready",
    device: model.device,
    model: model.modelId,
  });
}

async function loadAccurate(reportProgress: ProgressCallback) {
  if (!live || !prefs) {
    return;
  }

  const generation = ++accurateGeneration;
  const device = live.device;
  const stillCurrent = () => generation === accurateGeneration && live;

  for (const modelId of accurateCandidates(prefs, device)) {
    if (!stillCurrent()) {
      return;
    }
    if (modelId === live.modelId) {
      accurate = live;
      publishAccurateReady(live);
      return;
    }

    try {
      const loaded = await tryLoadModel(modelId, device, reportProgress);
      if (!stillCurrent()) {
        return;
      }
      accurate = loaded;
      publishAccurateReady(loaded);
      return;
    } catch (error) {
      console.warn(`Whisper ${modelId} failed on ${device}`, error);
      if (isDeviceFailure(error)) {
        markFailed(modelId, device);
        publishPrefs();
      }
    }
  }

  if (!stillCurrent() || !live) {
    return;
  }
  accurate = live;
  publishAccurateReady(live);
}

function startAccurateLoad(force = false) {
  if (!force && accurateTask) {
    return accurateTask;
  }
  if (!force && accurate) {
    return Promise.resolve();
  }

  const reportProgress: ProgressCallback = (data) => {
    self.postMessage({ type: "progress", data, pass: "accurate" });
  };

  const task = loadAccurate(reportProgress)
    .catch((error) => {
      console.warn("Accurate Whisper load failed", error);
      if (live) {
        accurate = live;
        publishAccurateReady(live);
      }
    })
    .finally(() => {
      if (accurateTask === task) {
        accurateTask = null;
      }
    });
  accurateTask = task;
  return task;
}

function buildDecoderInputIds(transcriber: Transcriber, prompt: string | undefined) {
  const text = prompt?.trim();
  if (!text) {
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

async function transcribeAudio(
  loaded: LoadedModel,
  audio: Float32Array,
  options?: TranscribeOptions
) {
  const decoderInputIds = buildDecoderInputIds(loaded.transcriber, options?.prompt);
  const generate: Record<string, unknown> = {};

  if (options?.chunk_length_s && options.chunk_length_s > 0) {
    generate.chunk_length_s = options.chunk_length_s;
    generate.stride_length_s = options.stride_length_s ?? options.chunk_length_s / 6;
  }

  if (decoderInputIds) {
    generate.decoder_input_ids = decoderInputIds;
  }

  try {
    const result = await loaded.transcriber(audio, generate);
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
    const result = await loaded.transcriber(audio, fallback);
    const text =
      result && typeof result === "object" && "text" in result ? String(result.text) : "";
    return text.trim();
  }
}

function pickModel(pass: WhisperPass | undefined) {
  if (pass === "accurate") {
    return accurate ?? live;
  }
  return live;
}

self.onmessage = (event: MessageEvent<IncomingMessage>) => {
  const message = event.data;

  if (message.type === "reload-accurate") {
    prefs = {
      ...(prefs ?? message.prefs),
      ...message.prefs,
      device: prefs?.device ?? message.prefs.device,
      liveModel: prefs?.liveModel ?? message.prefs.liveModel,
    };
    accurate = null;
    void startAccurateLoad(true);
    return;
  }

  void serialize(async () => {
    try {
      if (message.type === "load") {
        prefs = { ...message.prefs };
        const reportProgress: ProgressCallback = (data) => {
          self.postMessage({ type: "progress", data, pass: "live" });
        };
        const device = await loadLive(reportProgress);
        self.postMessage({
          type: "ready",
          device,
          liveModel: live?.modelId,
          accurateModel: accurate?.modelId,
          accurateReady: Boolean(accurate),
        });
        publishPrefs();
        void startAccurateLoad();
        return;
      }

      if (message.type === "transcribe") {
        const pass = message.pass ?? message.options?.pass ?? "live";
        if (pass === "accurate" && !accurate) {
          await startAccurateLoad();
        }

        const loaded = pickModel(pass);
        if (!loaded) {
          throw new Error("Whisper model is not loaded yet");
        }

        try {
          const text = await transcribeAudio(loaded, message.audio, message.options);
          self.postMessage({ type: "result", id: message.id, text });
        } catch (error) {
          if (pass === "accurate" && live && loaded !== live) {
            console.warn("Accurate Whisper failed, retrying with live model", error);
            if (isDeviceFailure(error) && prefs) {
              markFailed(loaded.modelId, loaded.device);
              accurate = live;
              prefs.accurateModel = live.modelId;
              publishPrefs();
            }
            const text = await transcribeAudio(live, message.audio, message.options);
            self.postMessage({ type: "result", id: message.id, text });
            return;
          }
          throw error;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Whisper failed";
      self.postMessage({
        type: "error",
        id: message.type === "transcribe" ? message.id : undefined,
        message: errorMessage,
      });
    }
  });
};
