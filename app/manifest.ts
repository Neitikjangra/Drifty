import type { MetadataRoute } from "next";

/** Web app manifest: Drifty can be installed from the browser ("Add to Home Screen"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Drifty",
    short_name: "Drifty",
    description: "Client rooms for agencies: AI change lists, drift checks and dispute-proof approvals.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#f8fbf2",
    theme_color: "#124559",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
