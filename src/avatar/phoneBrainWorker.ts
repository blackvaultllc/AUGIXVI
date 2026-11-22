/// <reference lib="webworker" />
/**
 * ON-PHONE BRAIN WORKER — the WebLLM engine's side of the thread.
 *
 * Generation runs here so the stage never freezes while the small
 * brain thinks. This file is only ever loaded as a module Worker
 * (see phoneBrain.ts); it is not part of the app bundle's graph.
 * (Types resolve through the narrowed shim in src/types/web-llm.d.ts.)
 */
import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (event: MessageEvent) => {
  handler.onmessage(event);
};

export {};
