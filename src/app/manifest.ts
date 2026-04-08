import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JnUITS Full Stack",
    short_name: "JnUITS",
    description: "Unified public website, portal, and admin platform for JnUITS.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f2ec",
    theme_color: "#163753",
    icons: [],
  };
}
