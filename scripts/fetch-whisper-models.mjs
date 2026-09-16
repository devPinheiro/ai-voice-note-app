#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODELS_DIR = path.join(ROOT, "public", "models");

const ALIASES = {
  tiny: "Xenova/whisper-tiny.en",
  base: "Xenova/whisper-base.en",
  small: "Xenova/whisper-small.en",
};

const KEEP_FILE = /\.(json|txt|onnx)$/i;

function resolveIds(args) {
  const aliases = args.length > 0 ? args : ["tiny", "base"];
  return aliases.map((alias) => {
    if (alias in ALIASES) {
      return ALIASES[alias];
    }
    if (alias.includes("/")) {
      return alias;
    }
    throw new Error(`Unknown Whisper model "${alias}". Use tiny, base, small, or a Hugging Face id.`);
  });
}

async function listFiles(modelId) {
  const url = `https://huggingface.co/api/models/${modelId}/tree/main?recursive=1`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not list ${modelId}: ${response.status} ${response.statusText}`);
  }
  const entries = await response.json();
  return entries
    .filter((entry) => entry.type === "file" && KEEP_FILE.test(entry.path))
    .map((entry) => entry.path);
}

async function downloadFile(modelId, filePath) {
  const url = `https://huggingface.co/${modelId}/resolve/main/${filePath}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed ${modelId}/${filePath}: ${response.status}`);
  }
  const target = path.join(MODELS_DIR, modelId, filePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
  return target;
}

async function fetchModel(modelId) {
  const files = await listFiles(modelId);
  if (files.length === 0) {
    throw new Error(`No ONNX/config files found for ${modelId}`);
  }
  console.log(`Downloading ${modelId} (${files.length} files) into public/models/`);
  for (const filePath of files) {
    process.stdout.write(`  ${filePath}\n`);
    await downloadFile(modelId, filePath);
  }
}

const ids = resolveIds(process.argv.slice(2));
for (const modelId of ids) {
  await fetchModel(modelId);
}
console.log("Done. Vite will serve these from /models on localhost.");
