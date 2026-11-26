import { createFileRoute } from "@tanstack/react-router";
import { VioletHome } from "@/avatar/violet/VioletHome";

/**
 * VIOLET'S SIDE — /violet (Captain's order 2026-11-26). His
 * sister Violet Hernandez, Agent 011, the Financial Advisor,
 * has her own login and her own side of the system: her god,
 * her notepad, her calculator, the finance records, her
 * email. Her session is a core-kept credential of her own,
 * kept entirely apart from the operator's Supabase session —
 * this route renders her side and nothing from the operator
 * side, and her session opens nothing operator-side.
 */
export const Route = createFileRoute("/violet")({
  ssr: false,
  component: VioletHome,
  head: () => ({
    meta: [
      { title: "Violet's Side — Financial Advisor, I-E-M" },
      {
        name: "description",
        content:
          "Violet Hernandez's own side of the system: her notepad, her calculator, the company's finance records, and her email.",
      },
    ],
  }),
});
