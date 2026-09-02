import { FILE_CHUNK_SAMPLES } from "./audio";
import { whisperClient } from "./client";

export async function transcribePcm(
  audio: Float32Array,
  onChunk?: (done: number, total: number) => void
) {
  if (audio.length === 0) {
    return "";
  }

  if (audio.length <= FILE_CHUNK_SAMPLES) {
    onChunk?.(1, 1);
    return whisperClient.transcribe(audio);
  }

  const total = Math.ceil(audio.length / FILE_CHUNK_SAMPLES);
  const parts: string[] = [];

  for (let index = 0; index < total; index++) {
    const start = index * FILE_CHUNK_SAMPLES;
    const chunk = audio.slice(start, start + FILE_CHUNK_SAMPLES);
    const text = await whisperClient.transcribe(chunk);
    if (text) {
      parts.push(text);
    }
    onChunk?.(index + 1, total);
  }

  return parts.join(" ");
}
