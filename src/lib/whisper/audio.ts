export const TARGET_SAMPLE_RATE = 16_000;

export const LIVE_WINDOW_SECONDS = 12;
export const LIVE_HOP_SECONDS = 2;
export const LIVE_MIN_SECONDS = 2;
export const LIVE_WINDOW_SAMPLES = TARGET_SAMPLE_RATE * LIVE_WINDOW_SECONDS;
export const LIVE_HOP_SAMPLES = TARGET_SAMPLE_RATE * LIVE_HOP_SECONDS;
export const LIVE_MIN_SAMPLES = TARGET_SAMPLE_RATE * LIVE_MIN_SECONDS;

export const FILE_CHUNK_SECONDS = 30;
export const FILE_STRIDE_SECONDS = 5;
export const FILE_CHUNK_SAMPLES = TARGET_SAMPLE_RATE * FILE_CHUNK_SECONDS;

export const SILENCE_RMS = 0.012;
export const SILENCE_HANGOVER_SECONDS = 0.3;

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

export function lastSamples(chunks: Float32Array[], total: number, count: number): Float32Array {
  const n = Math.min(count, total);
  if (n <= 0) {
    return new Float32Array(0);
  }

  const out = new Float32Array(n);
  let needed = n;

  for (let i = chunks.length - 1; i >= 0 && needed > 0; i--) {
    const chunk = chunks[i];
    const take = Math.min(chunk.length, needed);
    needed -= take;
    out.set(chunk.subarray(chunk.length - take), needed);
  }

  return out;
}

export function resampleLinear(input: Float32Array, fromRate: number, toRate: number): Float32Array {
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

export async function resampleOffline(
  input: Float32Array,
  fromRate: number,
  toRate: number
): Promise<Float32Array> {
  if (fromRate === toRate || input.length === 0) {
    return input;
  }

  try {
    const frameCount = Math.max(1, Math.round((input.length / fromRate) * toRate));
    const offline = new OfflineAudioContext(1, frameCount, toRate);
    const buffer = offline.createBuffer(1, input.length, fromRate);
    buffer.copyToChannel(input, 0);
    const source = offline.createBufferSource();
    source.buffer = buffer;
    source.connect(offline.destination);
    source.start(0);
    const rendered = await offline.startRendering();
    return rendered.getChannelData(0).slice();
  } catch {
    return resampleLinear(input, fromRate, toRate);
  }
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
    return resampleOffline(mixToMono(audioBuffer), audioBuffer.sampleRate, TARGET_SAMPLE_RATE);
  } catch {
    throw new Error(
      "Could not read audio from that file. Try mp3, wav, m4a, or an mp4 with an audio track."
    );
  } finally {
    await context.close();
  }
}

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
