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

export type WhisperProgressListener = (progress: WhisperProgress) => void;
export type WhisperReadyListener = (device?: string) => void;
export type WhisperErrorListener = (message: string) => void;

type WorkerReadyMessage = { type: "ready"; device?: string };
type WorkerProgressMessage = { type: "progress"; data: WhisperProgress };
type WorkerResultMessage = { type: "result"; id: string; text: string };
type WorkerErrorMessage = { type: "error"; id?: string; message: string };
type WorkerMessage =
  | WorkerReadyMessage
  | WorkerProgressMessage
  | WorkerResultMessage
  | WorkerErrorMessage;

class WhisperClient {
  private worker: Worker | null = null;
  private ready = false;
  private loading: Promise<void> | null = null;
  private pending = new Map<
    string,
    { resolve: (text: string) => void; reject: (error: Error) => void }
  >();
  private progressListeners = new Set<WhisperProgressListener>();
  private readyListeners = new Set<WhisperReadyListener>();
  private errorListeners = new Set<WhisperErrorListener>();
  private device: string | undefined;

  isReady() {
    return this.ready;
  }

  getDevice() {
    return this.device;
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

    this.ensureWorker();

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

      this.worker?.postMessage({ type: "load" });
    }).finally(() => {
      this.loading = null;
    });

    return this.loading;
  }

  async transcribe(audio: Float32Array, options?: TranscribeOptions) {
    await this.load();

    const id = crypto.randomUUID();
    const copy = new Float32Array(audio);

    return new Promise<string>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker?.postMessage({ type: "transcribe", id, audio: copy, options }, [copy.buffer]);
    });
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
        this.progressListeners.forEach((listener) => listener(message.data));
        return;
      }

      if (message.type === "ready") {
        this.ready = true;
        this.device = message.device;
        this.readyListeners.forEach((listener) => listener(message.device));
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
