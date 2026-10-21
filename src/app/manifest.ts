import type { MetadataRoute } from "next";

// Added to a home screen, Jamming opens like an app: its own icon and name, no browser bar.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Jamming",
    short_name: "Jamming",
    description: "A band of doodled animals that improvise music together.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f0e1",
    theme_color: "#f6f0e1",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png" },
      { src: "/icon/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
