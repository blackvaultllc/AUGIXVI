import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/library/article?book=…&path=… — one article from the
 * offline books, sanitized for reading by avatar/library.server.ts
 * (no scripts, no pictures — the book's own words, kept light).
 */
export const Route = createFileRoute("/api/library/article")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { forwardLibraryArticle } = await import("@/avatar/library.server");
        return forwardLibraryArticle(request);
      },
    },
  },
});
