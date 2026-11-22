import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

type TrapHandler = {
  handleTrapRequest: (request: Request) => Promise<Response | null>;
};

let trapHandlerPromise: Promise<TrapHandler | null> | undefined;

/**
 * GATE LOG / HONEYPOT (local server): requests for classic probe paths
 * that are not routes here (/.env, /.git/config, /wp-admin, …) are
 * answered with a bland 404 and recorded — IP, time, path, agent — in
 * the operator's local gate log. Loaded lazily; where the local log
 * store does not exist (the Cloudflare Worker build) the handler
 * reports no trap and the request continues exactly as before.
 */
async function getTrapHandler(): Promise<TrapHandler | null> {
  if (!trapHandlerPromise) {
    trapHandlerPromise = import("./avatar/gateLogStore.server").catch(() => null);
  }
  return trapHandlerPromise;
}

let connectionsBootPromise: Promise<unknown> | undefined;

/**
 * CONNECTIONS BOOT (local server): the Captain's stored API/data
 * slot values (Connections area) are applied to the server
 * process's environment once, lazily, so the plumbing that reads
 * env names — the brain pipe, the server voice — sees a filled
 * slot after a restart exactly as it did when he saved it. Where
 * the store does not exist (the Cloudflare Worker) this is a
 * no-op; Worker secrets carry the same names there.
 */
async function bootConnectionsOnce(): Promise<void> {
  if (!connectionsBootPromise) {
    connectionsBootPromise = import("./avatar/connections.server")
      .then((module) => module.bootConnections())
      .catch(() => null);
  }
  await connectionsBootPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Hosting compresses every response at the edge. Never compress a body (gzip, brotli,
// CompressionStream) or set content-encoding here or in a server route: the body gets encoded
// twice and renders garbled.
export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const trapHandler = await getTrapHandler();
      if (trapHandler) {
        const trapResponse = await trapHandler.handleTrapRequest(request);
        if (trapResponse) return trapResponse;
      }
      await bootConnectionsOnce();
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
