import { DEFAULT_DEVICE_PREFS, type WhisperDevicePrefs } from "./models";

const DB_NAME = "ai-notepad-whisper";
const DB_VERSION = 2;
const JOB_STORE = "jobs";
const SETTINGS_STORE = "settings";
const DEVICE_PREFS_KEY = "device";
const OPFS_ROOT = "whisper-jobs";

export type WhisperJobStatus = "queued" | "running" | "done" | "error";

export type WhisperJob = {
  id: string;
  fileName: string;
  fileSize: number;
  sampleRate: number;
  totalChunks: number;
  nextChunk: number;
  partialText: string;
  status: WhisperJobStatus;
  error?: string;
  createdAt: number;
  updatedAt: number;
};

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(JOB_STORE)) {
        const store = db.createObjectStore(JOB_STORE, { keyPath: "id" });
        store.createIndex("by_file", ["fileName", "fileSize"], { unique: false });
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open Whisper job storage"));
  });
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

export async function putJob(job: WhisperJob) {
  const db = await openDb();
  try {
    const tx = db.transaction(JOB_STORE, "readwrite");
    await requestToPromise(tx.objectStore(JOB_STORE).put(job));
  } finally {
    db.close();
  }
}

export async function getJob(id: string) {
  const db = await openDb();
  try {
    const tx = db.transaction(JOB_STORE, "readonly");
    return await requestToPromise<WhisperJob | undefined>(tx.objectStore(JOB_STORE).get(id));
  } finally {
    db.close();
  }
}

export async function findResumableJob(fileName: string, fileSize: number) {
  const db = await openDb();
  try {
    const tx = db.transaction(JOB_STORE, "readonly");
    const index = tx.objectStore(JOB_STORE).index("by_file");
    const matches = await requestToPromise<WhisperJob[]>(index.getAll([fileName, fileSize]));
    return (
      matches
        .filter((job) => job.status === "queued" || job.status === "running")
        .sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null
    );
  } finally {
    db.close();
  }
}

export async function deleteJobRecord(id: string) {
  const db = await openDb();
  try {
    const tx = db.transaction(JOB_STORE, "readwrite");
    await requestToPromise(tx.objectStore(JOB_STORE).delete(id));
  } finally {
    db.close();
  }
}

async function jobsDirectory() {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(OPFS_ROOT, { create: true });
}

async function jobDirectory(jobId: string, create = true) {
  const jobs = await jobsDirectory();
  return jobs.getDirectoryHandle(jobId, { create });
}

function chunkFileName(index: number) {
  return `${String(index).padStart(4, "0")}.bin`;
}

export async function writePcmChunk(jobId: string, index: number, pcm: Float32Array) {
  const dir = await jobDirectory(jobId);
  const handle = await dir.getFileHandle(chunkFileName(index), { create: true });
  const writable = await handle.createWritable();
  try {
    await writable.write(pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength));
  } finally {
    await writable.close();
  }
}

export async function readPcmChunk(jobId: string, index: number) {
  const dir = await jobDirectory(jobId, false);
  const handle = await dir.getFileHandle(chunkFileName(index));
  const file = await handle.getFile();
  return new Float32Array(await file.arrayBuffer());
}

export async function jobHasChunks(jobId: string, totalChunks: number) {
  try {
    const dir = await jobDirectory(jobId, false);
    for (let index = 0; index < totalChunks; index++) {
      await dir.getFileHandle(chunkFileName(index));
    }
    return true;
  } catch {
    return false;
  }
}

export async function deleteJobFiles(jobId: string) {
  try {
    const jobs = await jobsDirectory();
    await jobs.removeEntry(jobId, { recursive: true });
  } catch {
    // Job folder may already be gone.
  }
}

export async function getDevicePrefs(): Promise<WhisperDevicePrefs> {
  const db = await openDb();
  try {
    const tx = db.transaction(SETTINGS_STORE, "readonly");
    const stored = await requestToPromise<WhisperDevicePrefs | undefined>(
      tx.objectStore(SETTINGS_STORE).get(DEVICE_PREFS_KEY)
    );
    if (!stored) {
      return { ...DEFAULT_DEVICE_PREFS };
    }
    return {
      ...DEFAULT_DEVICE_PREFS,
      ...stored,
      failedModels: Array.isArray(stored.failedModels) ? stored.failedModels : [],
    };
  } catch {
    return { ...DEFAULT_DEVICE_PREFS };
  } finally {
    db.close();
  }
}

export async function putDevicePrefs(prefs: WhisperDevicePrefs) {
  const db = await openDb();
  try {
    const tx = db.transaction(SETTINGS_STORE, "readwrite");
    await requestToPromise(tx.objectStore(SETTINGS_STORE).put(prefs, DEVICE_PREFS_KEY));
  } finally {
    db.close();
  }
}

export async function requestPersistentStorage() {
  if (!navigator.storage?.persist) {
    return false;
  }
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
