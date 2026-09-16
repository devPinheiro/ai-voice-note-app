import type { WhisperDevice, WhisperDevicePrefs, WhisperPass, WhisperQuality } from "./models";
import { DEFAULT_DEVICE_PREFS, shortModelName } from "./models";
import { getDevicePrefs, putDevicePrefs } from "./storage";
import type { TranscribeOptions } from "./types";

export type WhisperProgress = {
  status?: string;
  name?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
  task?: string;
  model?: string;
};

export type WhisperProgressListener = (progress: WhisperProgress, pass?: WhisperPass) => void;
export type WhisperReadyListener = (info: {
  device?: WhisperDevice;
  liveModel?: string;
  accurateModel?: string | null;
  accurateReady: boolean;
}) => void;
export type WhisperErrorListener = (message: string) => void;
export type WhisperPrefsListener = (prefs: WhisperDevicePrefs) => void;

type WorkerReadyMessage = {
  type: "ready";
  device?: WhisperDevice;
  liveModel?: string;
  accurateModel?: string;
  accurateReady?: boolean;
};
type WorkerAccurateReadyMessage = {
  type: "accurate-ready";
  device?: WhisperDevice;
  model?: string;
};
type WorkerPrefsMessage = { type: "prefs"; prefs: WhisperDevicePrefs };
type WorkerProgressMessage = { type: "progress"; data: WhisperProgress; pass?: WhisperPass };
type WorkerResultMessage = { type: "result"; id: string; text: string };
type WorkerErrorMessage = { type: "error"; id?: string; message: string };
type WorkerMessage =
  | WorkerReadyMessage
  | WorkerAccurateReadyMessage
  | WorkerPrefsMessage
  | WorkerProgressMessage
  | WorkerResultMessage
  | WorkerErrorMessage;

class WhisperClient {
  private worker: Worker | null = null;
  private ready = false;
  private loading: Promise<void> | null = null;
  private accurateReady = false;
  private accurateLoading: Promise<void> | null = null;
  private pending = new Map<
    string,
    { resolve: (text: string) => void; reject: (error: Error) => void }
  >();
  private progressListeners = new Set<WhisperProgressListener>();
  private readyListeners = new Set<WhisperReadyListener>();
  private errorListeners = new Set<WhisperErrorListener>();
  private prefsListeners = new Set<WhisperPrefsListener>();
  private accurateListeners = new Set<WhisperReadyListener>();
  private device: WhisperDevice | undefined;
  private liveModel: string | undefined;
  private accurateModel: string | null = null;
  private prefs: WhisperDevicePrefs = { ...DEFAULT_DEVICE_PREFS };

  isReady() {
    return this.ready;
  }

  isAccurateReady() {
    return this.accurateReady;
  }

  getDevice() {
    return this.device;
  }

  getLiveModel() {
    return this.liveModel;
  }

  getAccurateModel() {
    return this.accurateModel;
  }

  getQuality() {
    return this.prefs.quality;
  }

  getPrefs() {
    return this.prefs;
  }

  statusLabel() {
    if (!this.ready) {
      return "Downloading Whisper";
    }
    const live = shortModelName(this.liveModel);
    if (!this.accurateReady) {
      return `Whisper ready · ${live} live · loading refine model`;
    }
    const accurate = shortModelName(this.accurateModel ?? this.liveModel);
    if (accurate === live) {
      return `Whisper ready · ${live} · ${this.device ?? "on-device"}`;
    }
    return `Whisper ready · ${live} live · ${accurate} refine`;
  }

  onProgress(listener: WhisperProgressListener) {
    this.progressListeners.add(listener);
    return () => {
      this.progressListeners.delete(listener);
    };
  }

  onReady(listener: WhisperReadyListener) {
    this.readyListeners.add(listener);
    return () => {
      this.readyListeners.delete(listener);
    };
  }

  onAccurateReady(listener: WhisperReadyListener) {
    this.accurateListeners.add(listener);
    return () => {
      this.accurateListeners.delete(listener);
    };
  }

  onPrefs(listener: WhisperPrefsListener) {
    this.prefsListeners.add(listener);
    return () => {
      this.prefsListeners.delete(listener);
    };
  }

  onError(listener: WhisperErrorListener) {
    this.errorListeners.add(listener);
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  async load() {
    if (this.ready) {
      return;
    }

    if (this.loading) {
      return this.loading;
    }

    this.prefs = await getDevicePrefs();
    this.ensureWorker();
    this.ensureAccurateLoad();

    this.loading = new Promise<void>((resolve, reject) => {
      const handleReady = () => {
        cleanup();
        resolve();
      };
      const handleError = (message: string) => {
        cleanup();
        reject(new Error(message));
      };

      const unready = this.onReady(handleReady);
      const unerror = this.onError(handleError);
      const cleanup = () => {
        unready();
        unerror();
      };

      this.worker?.postMessage({ type: "load", prefs: this.prefs });
    }).finally(() => {
      this.loading = null;
    });

    return this.loading;
  }

  async setQuality(quality: WhisperQuality) {
    await this.load();
    if (this.prefs.quality === quality && this.accurateReady) {
      return;
    }

    this.prefs = {
      ...this.prefs,
      quality,
      liveModel: this.liveModel ?? this.prefs.liveModel,
      device: this.device ?? this.prefs.device,
    };
    await putDevicePrefs(this.prefs);
    this.prefsListeners.forEach((listener) => listener(this.prefs));
    this.accurateReady = false;
    this.accurateModel = null;
    this.accurateLoading = null;
    this.ensureAccurateLoad();
    this.worker?.postMessage({ type: "reload-accurate", prefs: this.prefs });
    await this.ensureAccurate();
  }

  async waitForAccurate() {
    await this.load();
    await this.ensureAccurate();
  }

  async transcribe(audio: Float32Array, options?: TranscribeOptions) {
    await this.load();
    return this.requestTranscribe(audio, { ...options, pass: options?.pass ?? "live" }, "live");
  }

  async transcribeAccurate(audio: Float32Array, options?: TranscribeOptions) {
    await this.load();
    await this.ensureAccurate();
    return this.requestTranscribe(
      audio,
      { ...options, pass: "accurate" },
      "accurate"
    );
  }

  private ensureAccurateLoad() {
    if (this.accurateReady || this.accurateLoading) {
      return;
    }

    this.accurateLoading = new Promise<void>((resolve) => {
      const done = this.onAccurateReady(() => {
        done();
        resolve();
      });
    }).finally(() => {
      this.accurateLoading = null;
    });
  }

  private async ensureAccurate() {
    if (this.accurateReady) {
      return;
    }
    this.ensureAccurateLoad();
    await this.accurateLoading;
  }

  private requestTranscribe(
    audio: Float32Array,
    options: TranscribeOptions,
    pass: WhisperPass
  ) {
    const id = crypto.randomUUID();
    const copy = new Float32Array(audio);

    return new Promise<string>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker?.postMessage({ type: "transcribe", id, audio: copy, options, pass }, [
        copy.buffer,
      ]);
    });
  }

  private publishReady() {
    const info = {
      device: this.device,
      liveModel: this.liveModel,
      accurateModel: this.accurateModel,
      accurateReady: this.accurateReady,
    };
    this.readyListeners.forEach((listener) => listener(info));
  }

  private publishAccurate() {
    const info = {
      device: this.device,
      liveModel: this.liveModel,
      accurateModel: this.accurateModel,
      accurateReady: this.accurateReady,
    };
    this.accurateListeners.forEach((listener) => listener(info));
  }

  private ensureWorker() {
    if (this.worker) {
      return;
    }

    this.worker = new Worker(new URL("./whisper.worker.ts", import.meta.url), {
      type: "module",
    });

    this.worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;

      if (message.type === "progress") {
        this.progressListeners.forEach((listener) => listener(message.data, message.pass));
        return;
      }

      if (message.type === "prefs") {
        this.prefs = message.prefs;
        void putDevicePrefs(message.prefs);
        this.prefsListeners.forEach((listener) => listener(message.prefs));
        return;
      }

      if (message.type === "ready") {
        this.ready = true;
        this.device = message.device;
        this.liveModel = message.liveModel;
        this.accurateModel = message.accurateModel ?? null;
        this.accurateReady = Boolean(message.accurateReady);
        this.publishReady();
        if (this.accurateReady) {
          this.publishAccurate();
        }
        return;
      }

      if (message.type === "accurate-ready") {
        this.device = message.device ?? this.device;
        this.accurateModel = message.model ?? this.accurateModel;
        this.accurateReady = true;
        this.publishAccurate();
        return;
      }

      if (message.type === "result") {
        this.pending.get(message.id)?.resolve(message.text);
        this.pending.delete(message.id);
        return;
      }

      if (message.type === "error") {
        if (message.id && this.pending.has(message.id)) {
          this.pending.get(message.id)?.reject(new Error(message.message));
          this.pending.delete(message.id);
          return;
        }

        this.errorListeners.forEach((listener) => listener(message.message));
      }
    };

    this.worker.onerror = (event) => {
      const message = event.message || "Whisper worker failed";
      this.errorListeners.forEach((listener) => listener(message));
      this.pending.forEach(({ reject }) => reject(new Error(message)));
      this.pending.clear();
    };
  }
}

export const whisperClient = new WhisperClient();
export { shortModelName };
