import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { writeFileSync } from "fs";
import { resolve } from "path";

function sitemapPlugin() {
  return {
    name: "generate-sitemap",
    closeBundle() {
      const base = process.env.VITE_SITE_URL ?? "https://mapleak.xsbcme.cn";
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${base}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;
      writeFileSync(resolve("dist/sitemap.xml"), xml);
    },
  };
}

export default defineConfig({
  plugins: [vue(), tailwindcss(), sitemapPlugin()],
  server: {
    port: 5174,
    proxy: {
      "/api": { target: "http://localhost:3001", changeOrigin: true },
    },
  },
});
