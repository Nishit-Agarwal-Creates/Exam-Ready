import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/test/", "/results/", "/paper/", "/my-practice", "/search"] }],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
