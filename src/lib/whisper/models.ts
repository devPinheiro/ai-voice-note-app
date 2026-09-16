export const LIVE_MODEL_ID = "Xenova/whisper-tiny.en";

export const ACCURATE_MODELS = {
  tiny: "Xenova/whisper-tiny.en",
  base: "Xenova/whisper-base.en",
  small: "Xenova/whisper-small.en",
} as const;

export type WhisperQuality = "fast" | "balanced" | "high";
export type WhisperDevice = "webgpu" | "wasm";
export type WhisperPass = "live" | "accurate";

export type WhisperDevicePrefs = {
  quality: WhisperQuality;
  device: WhisperDevice | null;
  liveModel: string | null;
  accurateModel: string | null;
  failedModels: string[];
  webgpuFailed: boolean;
};

export const DEFAULT_DEVICE_PREFS: WhisperDevicePrefs = {
  quality: "balanced",
  device: null,
  liveModel: null,
  accurateModel: null,
  failedModels: [],
  webgpuFailed: false,
};

export const QUALITY_LABELS: Record<WhisperQuality, string> = {
  fast: "Fast",
  balanced: "Balanced",
  high: "High",
};

export function failedModelKey(modelId: string, device: WhisperDevice) {
  return `${modelId}:${device}`;
}

export function shortModelName(modelId: string | null | undefined) {
  if (!modelId) {
    return "whisper";
  }
  const name = modelId.split("/").pop() ?? modelId;
  return name.replace(/^whisper-/, "");
}

export function isLocalhostHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function isDeviceFailure(error: unknown) {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return /out of memory|oom|failed to allocate|webgpu|device lost|could not create|gpu buffer|aborted\(\)|failed to execute/.test(
    message
  );
}

export function accurateCandidates(prefs: WhisperDevicePrefs, device: WhisperDevice) {
  const skip = new Set(prefs.failedModels);
  const models: string[] = [];

  if (device === "webgpu" && prefs.quality === "high") {
    models.push(ACCURATE_MODELS.small);
  }
  if (device === "webgpu" && prefs.quality !== "fast") {
    models.push(ACCURATE_MODELS.base);
  }
  models.push(ACCURATE_MODELS.tiny);

  const unique = [...new Set(models)].filter(
    (modelId) => !skip.has(failedModelKey(modelId, device))
  );

  if (
    prefs.accurateModel &&
    unique.includes(prefs.accurateModel) &&
    prefs.accurateModel !== unique[0]
  ) {
    return [prefs.accurateModel, ...unique.filter((modelId) => modelId !== prefs.accurateModel)];
  }

  return unique;
}
