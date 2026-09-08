import { FILE_CHUNK_SECONDS, FILE_STRIDE_SECONDS } from "./audio";
import { whisperClient } from "./client";

export async function transcribePcm(
  audio: Float32Array,
  onChunk?: (done: number, total: number) => void
) {
  if (audio.length === 0) {
    return "";
  }

  onChunk?.(1, 1);
  return whisperClient.transcribe(audio, {
    chunk_length_s: FILE_CHUNK_SECONDS,
    stride_length_s: FILE_STRIDE_SECONDS,
  });
}
