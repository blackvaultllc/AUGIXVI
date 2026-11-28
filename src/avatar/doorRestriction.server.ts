/**
 * DOOR RESTRICTION — request-time enforcement (owner order
 * 2026-11-28 ~00:50 CST: the cube is the security).
 *
 * Called by the server entry (src/server.ts) before the app
 * handler, in the same seat as the gate log's trap handler.
 * For a PAGE request (a GET that would serve one of the app's
 * documents) from a restricted address, the answer is made
 * here and the app is never reached: a black page, no words,
 * nothing to press, nothing to read — the end state of the
 * cube. The restriction record is the operator registry's
 * (doorStrikes.ts): the Durable Object online, the local
 * registry file on the core.
 *
 * What this does NOT touch, by design:
 *   · Asset and file requests (the bundle, images) — they
 *     carry no door and grant nothing without the document.
 *   · API and server-function calls — they carry their own
 *     authorization, and the door's own functions consult the
 *     same record themselves.
 *   · Anything at all when the registry cannot be reached —
 *     the check fails open, exactly like the trap handler, so
 *     a storage fault never blacks out the kingdom. (The
 *     door's server-side counting still stands behind it.)
 */
import { clientIpFromRequest } from "./gateLogStore.server";
import { isDoorIpUsable } from "./doorStrikes";
import type { OperatorRegistry } from "./OperatorRegistry";

type RegistryBinding = {
  idFromName: (name: string) => unknown;
  get: (id: unknown) => { fetch: (request: Request) => Promise<Response> };
};

function asBinding(value: unknown): RegistryBinding | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("idFromName" in value) ||
    typeof (value as RegistryBinding).idFromName !== "function" ||
    !("get" in value) ||
    typeof (value as RegistryBinding).get !== "function"
  ) {
    return null;
  }
  return value as RegistryBinding;
}

/**
 * The registry stub for THIS request: the Worker's binding
 * (the entry's env argument first, then the request runtime —
 * the two shapes this build runs under), or the local
 * file-backed registry on the core.
 */
async function getRegistryStub(
  request: Request,
  env: unknown,
): Promise<{ fetch: (request: Request) => Promise<Response> } | OperatorRegistry | null> {
  const envRecord =
    typeof env === "object" && env !== null ? (env as Record<string, unknown>) : null;
  const runtimeEnv = (
    request as Request & { runtime?: { cloudflare?: { env?: Record<string, unknown> } } }
  ).runtime?.cloudflare?.env;
  const binding =
    asBinding(envRecord?.["OSIRIS_OPERATOR_REGISTRY"]) ?? asBinding(runtimeEnv?.["OSIRIS_OPERATOR_REGISTRY"]);
  if (binding) return binding.get(binding.idFromName("operator"));
  try {
    const { createLocalOperatorRegistry } = await import("./localOperatorRegistry.server");
    const home = process.env["HOME"]?.trim();
    if (!home) return null;
    const directory = `${home}/.local/share/augie`;
    return await createLocalOperatorRegistry(directory, `${directory}/operator-registry.json`);
  } catch {
    return null;
  }
}

/** A page request: a GET for a document, not a file, an asset, or a call. */
export function isDoorPageRequest(request: Request): boolean {
  if (request.method !== "GET") return false;
  let pathname: string;
  try {
    pathname = new URL(request.url).pathname;
  } catch {
    return false;
  }
  if (pathname.startsWith("/assets/")) return false;
  if (pathname.startsWith("/api/")) return false;
  if (pathname.startsWith("/_serverFn")) return false;
  const lastSegment = pathname.split("/").pop() ?? "";
  if (lastSegment.includes(".")) return false; // a file (favicon, manifest, …)
  return true;
}

const BLACK_PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{background:#000;margin:0;padding:0;height:100%}</style></head><body></body></html>`;

/**
 * The entry's check. Returns the black page for a restricted
 * address's page request, or null — the caller then continues
 * untouched, so an unrestricted visit pays one pathname check
 * and one registry read.
 */
export async function handleDoorRestriction(
  request: Request,
  env?: unknown,
): Promise<Response | null> {
  if (!isDoorPageRequest(request)) return null;
  const ip = clientIpFromRequest(request);
  if (!isDoorIpUsable(ip)) return null;
  try {
    const stub = await getRegistryStub(request, env);
    if (!stub) return null;
    const response = await stub.fetch(
      new Request("https://operator-registry/door-status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ip }),
      }),
    );
    if (!response.ok) return null;
    const parsed: unknown = await response.json();
    const restricted =
      typeof parsed === "object" &&
      parsed !== null &&
      (parsed as { restricted?: unknown }).restricted === true;
    if (!restricted) return null;
    return new Response(BLACK_PAGE, {
      status: 403,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  } catch {
    // A failed check never changes the answer a visitor gets.
    return null;
  }
}
