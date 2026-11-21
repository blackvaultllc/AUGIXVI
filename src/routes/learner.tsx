import { createFileRoute } from "@tanstack/react-router";
import { LearnerHome } from "@/avatar/learner/LearnerHome";

/**
 * KHADIJA'S LEARNING SIDE — /learner (operator order 2026-11-21).
 * Her own route space, reached through the heart door on the footer.
 * Education only: this route renders her grand page and nothing from
 * the operator side — no operator gate, no operator rooms, no operator
 * data. Her session is her name + birth year, kept entirely apart from
 * the operator's Supabase session.
 */
export const Route = createFileRoute("/learner")({
  ssr: false,
  component: LearnerHome,
  head: () => ({
    meta: [
      { title: "Khadija's Learning Page — DIJA'S Academy" },
      {
        name: "description",
        content:
          "A learning page just for Khadija: her game, her diary, her squishies, her homework.",
      },
    ],
  }),
});
