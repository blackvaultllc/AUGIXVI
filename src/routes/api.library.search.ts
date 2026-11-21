import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/library/search?q=…&books=id1,id2 — full-text search
 * across the offline books, proxied to kiwix-serve by
 * avatar/library.server.ts. Every result names its book.
 */
export const Route = createFileRoute("/api/library/search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { forwardLibrarySearch } = await import("@/avatar/library.server");
        return forwardLibrarySearch(request);
      },
    },
  },
});
