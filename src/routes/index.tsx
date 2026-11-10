import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/avatar" });
  },
  head: () => ({
    meta: [
      { title: "Living AI Avatar" },
      {
        name: "description",
        content: "A particle-based AI avatar that follows your hand and speaks.",
      },
      { property: "og:title", content: "Living AI Avatar" },
      {
        property: "og:description",
        content: "A particle-based AI avatar that follows your hand and speaks.",
      },
    ],
  }),
});
