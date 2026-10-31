/**
 * One model, one generation, off the main thread.
 * Gemma 3 270M is the séance when WebGPU can hold the q4f16 build.
 * The CPU path is a smaller open model on purpose: Gemma's WASM file is
 * about a gigabyte, and a surprise download is not a candle, it is a bill.
 */

import { pipeline, TextStreamer, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/+esm";

env.allowLocalModels = false;
env.useBrowserCache = true;

const MODELS = {
  gemma: {
    id: "onnx-community/gemma-3-270m-it-ONNX",
    label: "Gemma 3 270M",
  },
  understudy: {
    id: "HuggingFaceTB/SmolLM2-135M-Instruct",
    label: "SmolLM2 135M",
  },
};

let pipe = null;
let loadedKey = "";
let busy = false;
let ticket = 0;

self.onmessage = async (event) => {
  const msg = event.data || {};
  if (msg.type === "load") {
    const mine = ++ticket;
    busy = false;
    try {
      await load(msg.which, mine);
      if (mine !== ticket) return;
      const spec = MODELS[msg.which];
      self.postMessage({ type: "ready", which: msg.which, label: spec.label, key: loadedKey });
    } catch (err) {
      if (mine !== ticket) return;
      pipe = null;
      loadedKey = "";
      self.postMessage({ type: "error", message: err && err.message ? err.message : String(err) });
    }
    return;
  }
  if (msg.type === "generate") {
    if (!pipe || busy) {
      self.postMessage({
        type: "error",
        id: msg.id,
        message: pipe ? "The candle is already speaking." : "Light a model first.",
      });
      return;
    }
    busy = true;
    const started = performance.now();
    let steps = 0;
    try {
      const streamer = new TextStreamer(pipe.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (text) => {
          steps += 1;
          self.postMessage({
            type: "token",
            id: msg.id,
            text,
            steps,
            seconds: (performance.now() - started) / 1000,
          });
        },
      });
      const output = await pipe(msg.messages, {
        max_new_tokens: msg.maxNewTokens || 160,
        do_sample: true,
        temperature: 0.6,
        top_p: 0.9,
        top_k: 40,
        repetition_penalty: 1.12,
        no_repeat_ngram_size: 3,
        streamer,
      });
      self.postMessage({
        type: "done",
        id: msg.id,
        text: textOf(output),
        steps,
        seconds: (performance.now() - started) / 1000,
      });
    } catch (err) {
      self.postMessage({ type: "error", id: msg.id, message: err && err.message ? err.message : String(err) });
    } finally {
      busy = false;
    }
  }
};

async function load(which, mine) {
  const spec = MODELS[which];
  if (!spec) throw new Error("Unknown model.");
  const gpu = await hasWebGPU();
  if (which === "gemma" && !gpu) {
    throw new Error("Gemma's small build needs WebGPU, and this browser has no adapter. Light the understudy, or open Veladora in a current desktop Chromium browser.");
  }
  const device = gpu ? "webgpu" : "wasm";
  const dtype = gpu ? "q4f16" : "q4";
  const key = `${spec.id}:${device}:${dtype}`;
  if (pipe && loadedKey === key) return;
  pipe = null;
  loadedKey = "";
  self.postMessage({ type: "status", state: "loading", label: spec.label, device, dtype });
  try {
    pipe = await create(spec.id, device, dtype, mine);
  } catch (err) {
    if (!(gpu && which === "understudy")) throw err;
    self.postMessage({ type: "status", state: "loading", label: spec.label, device: "wasm", dtype: "q4" });
    pipe = await create(spec.id, "wasm", "q4", mine);
    loadedKey = `${spec.id}:wasm:q4`;
    return;
  }
  loadedKey = key;
}

function create(id, device, dtype, mine) {
  const progress_callback = (progress) => {
    if (mine !== ticket) return;
    self.postMessage({
      type: "progress",
      status: progress.status || "",
      file: progress.file || "",
      progress: typeof progress.progress === "number" ? progress.progress : null,
    });
  };
  return pipeline("text-generation", id, { device, dtype, progress_callback }).catch(() =>
    pipeline("text-generation", id, { device, progress_callback }),
  );
}

async function hasWebGPU() {
  if (!navigator.gpu || !navigator.gpu.requestAdapter) return false;
  try {
    return Boolean(await navigator.gpu.requestAdapter());
  } catch {
    return false;
  }
}

function textOf(output) {
  const generated = output && output[0] && output[0].generated_text;
  if (typeof generated === "string") return generated.trim();
  if (Array.isArray(generated)) {
    const last = generated[generated.length - 1];
    if (typeof last === "string") return last.trim();
    if (last && typeof last.content === "string") return last.content.trim();
  }
  return "";
}
