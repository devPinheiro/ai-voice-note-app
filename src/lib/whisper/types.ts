import type { WhisperPass } from "./models";

export type TranscribeOptions = {
  chunk_length_s?: number;
  stride_length_s?: number;
  prompt?: string;
  pass?: WhisperPass;
};
