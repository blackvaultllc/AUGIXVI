import { createFileRoute } from "@tanstack/react-router";
import { AvatarStage } from "@/avatar/AvatarStage";

export const Route = createFileRoute("/avatar")({
  ssr: false,
  component: AvatarStage,
  head: () => ({
    meta: [
      { title: "Avatar — Living AI Interface" },
      { name: "description", content: "Glowing particle bust that follows your hand, reacts to snaps and speaks." },
      { property: "og:title", content: "Avatar — Living AI Interface" },
      { property: "og:description", content: "Glowing particle bust that follows your hand, reacts to snaps and speaks." },
    ],
  }),
});
