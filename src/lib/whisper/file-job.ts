import {
  FILE_CHUNK_SECONDS,
  FILE_STRIDE_SECONDS,
  countPcmChunks,
  isLargeMediaJob,
  isSilent,
  slicePcmChunk,
  TARGET_SAMPLE_RATE,
} from "./audio";
import { whisperClient } from "./client";
import {
  deleteJobFiles,
  deleteJobRecord,
  findResumableJob,
  jobHasChunks,
  putJob,
  readPcmChunk,
  requestPersistentStorage,
  writePcmChunk,
  type WhisperJob,
} from "./storage";
import { appendWithOverlap, promptTail } from "./streaming";

export type TranscribeProgress = {
  done: number;
  total: number;
  text: string;
};

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
}

async function transcribeChunk(pcm: Float32Array, prompt: string) {
  if (isSilent(pcm)) {
    return "";
  }

  return whisperClient.transcribeAccurate(pcm, { prompt: promptTail(prompt) });
}

async function transcribeShortPcm(
  audio: Float32Array,
  onProgress?: (progress: TranscribeProgress) => void
) {
  if (audio.length === 0) {
    return "";
  }

  onProgress?.({ done: 1, total: 1, text: "" });
  const text = await whisperClient.transcribeAccurate(audio, {
    chunk_length_s: FILE_CHUNK_SECONDS,
    stride_length_s: FILE_STRIDE_SECONDS,
  });
  onProgress?.({ done: 1, total: 1, text });
  return text;
}

async function transcribeSequential(
  pcm: Float32Array,
  options?: {
    signal?: AbortSignal;
    onProgress?: (progress: TranscribeProgress) => void;
  }
) {
  const totalChunks = countPcmChunks(pcm.length);
  let text = "";

  for (let index = 0; index < totalChunks; index++) {
    throwIfAborted(options?.signal);
    const piece = await transcribeChunk(new Float32Array(slicePcmChunk(pcm, index)), text);
    text = appendWithOverlap(text, piece);
    options?.onProgress?.({ done: index + 1, total: totalChunks, text });
  }

  return text;
}

async function writeJobChunks(jobId: string, pcm: Float32Array, totalChunks: number) {
  for (let index = 0; index < totalChunks; index++) {
    await writePcmChunk(jobId, index, new Float32Array(slicePcmChunk(pcm, index)));
  }
}

async function finishJob(job: WhisperJob, text: string) {
  await putJob({
    ...job,
    partialText: text,
    nextChunk: job.totalChunks,
    status: "done",
    updatedAt: Date.now(),
  });
  await deleteJobFiles(job.id);
  await deleteJobRecord(job.id);
}

async function transcribePersisted(
  file: File,
  pcm: Float32Array,
  options?: {
    signal?: AbortSignal;
    onProgress?: (progress: TranscribeProgress) => void;
  }
) {
  await requestPersistentStorage();

  const totalChunks = countPcmChunks(pcm.length);
  const now = Date.now();
  const existing = await findResumableJob(file.name, file.size);
  const canResume = Boolean(existing && (await jobHasChunks(existing.id, existing.totalChunks)));

  let job: WhisperJob;
  if (canResume && existing) {
    job = { ...existing, status: "running", updatedAt: now };
    await putJob(job);
  } else {
    if (existing) {
      await deleteJobFiles(existing.id);
      await deleteJobRecord(existing.id);
    }
    job = {
      id: crypto.randomUUID(),
      fileName: file.name,
      fileSize: file.size,
      sampleRate: TARGET_SAMPLE_RATE,
      totalChunks,
      nextChunk: 0,
      partialText: "",
      status: "running",
      createdAt: now,
      updatedAt: now,
    };
    await putJob(job);
    await writeJobChunks(job.id, pcm, totalChunks);
  }

  let text = job.partialText;

  try {
    for (let index = job.nextChunk; index < job.totalChunks; index++) {
      throwIfAborted(options?.signal);
      const piece = await transcribeChunk(await readPcmChunk(job.id, index), text);
      text = appendWithOverlap(text, piece);
      job = {
        ...job,
        nextChunk: index + 1,
        partialText: text,
        status: "running",
        updatedAt: Date.now(),
      };
      await putJob(job);
      options?.onProgress?.({ done: index + 1, total: job.totalChunks, text });
    }

    await finishJob(job, text);
    return text;
  } catch (error) {
    await putJob({
      ...job,
      partialText: text,
      status: options?.signal?.aborted ? "queued" : "error",
      error: options?.signal?.aborted
        ? undefined
        : error instanceof Error
          ? error.message
          : "Transcription failed",
      updatedAt: Date.now(),
    });
    throw error;
  }
}

export async function transcribePcm(
  audio: Float32Array,
  onChunk?: (done: number, total: number) => void
) {
  return transcribeShortPcm(audio, (progress) => onChunk?.(progress.done, progress.total));
}

export async function transcribeMediaPcm(
  file: File,
  pcm: Float32Array,
  options?: {
    signal?: AbortSignal;
    onProgress?: (progress: TranscribeProgress) => void;
  }
) {
  if (!isLargeMediaJob(file, pcm)) {
    return transcribeShortPcm(pcm, options?.onProgress);
  }

  throwIfAborted(options?.signal);

  try {
    return await transcribePersisted(file, pcm, options);
  } catch (error) {
    if (options?.signal?.aborted) {
      throw error;
    }
    console.warn("Persisted chunk transcription failed, using in-memory slices", error);
    return transcribeSequential(pcm, options);
  }
}
