import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Studybook",
    short_name: "Studybook",
    description:
      "Your personal student planner for schedules, assignments, notes, and study goals.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#1f2326",
    theme_color: "#1f2326",
    categories: ["education", "productivity"],
    icons: [
      {
        src: "/studybook-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/studybook-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/studybook-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
