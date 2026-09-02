export const TARGET_SAMPLE_RATE = 16_000;
export const CHUNK_SECONDS = 5;
export const CHUNK_SAMPLES = TARGET_SAMPLE_RATE * CHUNK_SECONDS;
export const SILENCE_RMS = 0.012;

const RECORDER_WORKLET = `
class RecorderProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel && channel.length > 0) {
      this.port.postMessage(channel);
    }
    return true;
  }
}
registerProcessor('recorder-processor', RecorderProcessor);
`;

export function mergeFloat32(chunks: Float32Array[]): Float32Array {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const result = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate || input.length === 0) {
    return input;
  }

  const ratio = fromRate / toRate;
  const output = new Float32Array(Math.max(1, Math.round(input.length / ratio)));

  for (let i = 0; i < output.length; i++) {
    const srcIndex = i * ratio;
    const index = Math.floor(srcIndex);
    const next = Math.min(index + 1, input.length - 1);
    const fraction = srcIndex - index;
    output[i] = input[index] * (1 - fraction) + input[next] * fraction;
  }

  return output;
}

export function rootMeanSquare(samples: Float32Array): number {
  if (samples.length === 0) {
    return 0;
  }

  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

export function isSilent(samples: Float32Array, threshold = SILENCE_RMS): boolean {
  return rootMeanSquare(samples) < threshold;
}

export function mixToMono(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) {
    return buffer.getChannelData(0);
  }

  const length = buffer.length;
  const mixed = new Float32Array(length);
  const channelCount = buffer.numberOfChannels;

  for (let channel = 0; channel < channelCount; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      mixed[i] += data[i] / channelCount;
    }
  }

  return mixed;
}

export async function decodeMediaFile(file: File): Promise<Float32Array> {
  const data = await file.arrayBuffer();
  const context = new AudioContext();

  try {
    const audioBuffer = await context.decodeAudioData(data.slice(0));
    return resample(mixToMono(audioBuffer), audioBuffer.sampleRate, TARGET_SAMPLE_RATE);
  } catch {
    throw new Error(
      "Could not read audio from that file. Try mp3, wav, m4a, or an mp4 with an audio track."
    );
  } finally {
    await context.close();
  }
}

export const FILE_CHUNK_SAMPLES = TARGET_SAMPLE_RATE * 30;

export async function createRecorderWorklet(audioContext: AudioContext): Promise<AudioWorkletNode> {
  const blob = new Blob([RECORDER_WORKLET], { type: "application/javascript" });
  const url = URL.createObjectURL(blob);

  try {
    await audioContext.audioWorklet.addModule(url);
  } finally {
    URL.revokeObjectURL(url);
  }

  return new AudioWorkletNode(audioContext, "recorder-processor");
}
