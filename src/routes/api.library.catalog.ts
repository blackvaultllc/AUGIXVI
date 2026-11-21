import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/library/catalog — the books the offline library is
 * serving right now, read from kiwix-serve's OPDS catalog by
 * avatar/library.server.ts (imported lazily so nothing server-side
 * leaks into the client bundle).
 */
export const Route = createFileRoute("/api/library/catalog")({
  server: {
    handlers: {
      GET: async () => {
        const { forwardLibraryCatalog } = await import("@/avatar/library.server");
        return forwardLibraryCatalog();
      },
    },
  },
});
