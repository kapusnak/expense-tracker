import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Klid — Calm Spend",
    short_name: "Klid",
    description: "Zero-UI expense tracker. Řekni, co jsi koupil, a měj klid.",
    start_url: "/",
    display: "standalone",
    background_color: "#FBFBFA",
    theme_color: "#FBFBFA",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
