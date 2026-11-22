/**
 * OPERATOR REGISTRY ACCESS — the one stub resolution, server-only.
 *
 * Lives in its own module (imported only by .server.ts files) so the
 * registry plumbing never rides into a client-reachable module: the
 * Durable Object binding online (OSIRIS_OPERATOR_REGISTRY), the
 * file-backed registry in the local build — identical semantics either
 * way, because both run the real OperatorRegistry class.
 */
import { getRequest } from "@tanstack/react-start/server";
import { createLocalOperatorRegistry } from "./localOperatorRegistry.server";
import type { OperatorRegistry } from "./OperatorRegistry";

export type RequestWithCloudflareEnv = Request & {
  runtime?: { cloudflare?: { env?: Record<string, unknown> } };
};

type RegistryBinding = {
  idFromName: (name: string) => unknown;
  get: (id: unknown) => { fetch: (request: Request) => Promise<Response> };
};

function getRegistryBinding(): RegistryBinding | null {
  const request = getRequest() as RequestWithCloudflareEnv;
  const binding: unknown = request.runtime?.cloudflare?.env?.["OSIRIS_OPERATOR_REGISTRY"];
  if (
    typeof binding !== "object" ||
    binding === null ||
    !("idFromName" in binding) ||
    typeof binding.idFromName !== "function" ||
    !("get" in binding) ||
    typeof binding.get !== "function"
  ) {
    return null;
  }
  return binding as RegistryBinding;
}

let localRegistryPromise: Promise<OperatorRegistry | null> | null = null;

function getLocalRegistry(): Promise<OperatorRegistry | null> {
  localRegistryPromise ??= (() => {
    const home = process.env["HOME"]?.trim();
    if (!home) return Promise.resolve(null);
    const directory = `${home}/.local/share/augie`;
    return createLocalOperatorRegistry(directory, `${directory}/operator-registry.json`);
  })();
  return localRegistryPromise;
}

async function getRegistryStub() {
  const binding = getRegistryBinding();
  if (binding) return binding.get(binding.idFromName("operator"));
  // Outside Cloudflare there is no Durable Object binding; serve the same
  // registry from the local file-backed fallback instead.
  return getLocalRegistry();
}

/** True when a registry (binding or local fallback) can be reached at all. */
export async function hasOperatorRegistry(): Promise<boolean> {
  return (await getRegistryStub()) !== null;
}

/** Call the operator registry; null when no registry is reachable. */
export async function requestOperatorRegistry(
  path: string,
  init?: RequestInit,
): Promise<Response | null> {
  const stub = await getRegistryStub();
  if (!stub) return null;
  return stub.fetch(new Request(`https://operator-registry${path}`, init));
}
