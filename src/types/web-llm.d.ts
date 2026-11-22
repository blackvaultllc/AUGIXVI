/**
 * TYPE SHIM for @mlc-ai/web-llm (wired in tsconfig "paths").
 *
 * The package's own type graph drags @webgpu/types' global canvas
 * declarations into the whole program, which breaks unrelated
 * canvas typing elsewhere in the app (vision tests). This shim is
 * the compile-time view of the package — deliberately narrowed to
 * the exact surface phoneBrain.ts and phoneBrainWorker.ts call.
 * Runtime resolution is untouched: Vite/Vitest resolve the real
 * package from node_modules; only TypeScript reads this file.
 */

export type InitProgressReport = { text: string; progress: number };

export type EngineConfigLike = {
  initProgressCallback?: (report: InitProgressReport) => void;
};

export type EngineLike = {
  chat: {
    completions: {
      create: (request: unknown) => Promise<{
        choices?: { message?: { content?: string | null } }[];
      }>;
    };
  };
  unload: () => Promise<void>;
};

export declare function CreateMLCEngine(
  modelId: string,
  engineConfig?: EngineConfigLike,
): Promise<EngineLike>;

export declare function CreateWebWorkerMLCEngine(
  worker: Worker,
  modelId: string,
  engineConfig?: EngineConfigLike,
): Promise<EngineLike>;

export declare function hasModelInCache(modelId: string): Promise<boolean>;

export declare function deleteModelAllInfoInCache(modelId: string): Promise<void>;

export declare class WebWorkerMLCEngineHandler {
  onmessage: (event: MessageEvent) => void;
}
