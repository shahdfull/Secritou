import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig(({ mode }) => {
  const isDevelopment = mode === "development";
  const isProduction = mode === "production";
  const analyze = process.env.ANALYZE === "true";

  // VITE_CALCOM_LINK is optional — ContactPage.tsx falls back to a static
  // "book a call" card if it's unset, so this warns rather than failing the
  // build (a booking-free launch is a valid choice, just worth flagging).
  // loadEnv reads .env files the same way Vite does for the app code itself
  // (process.env alone would miss a value set only in .env.production).
  if (isProduction) {
    const env = loadEnv(mode, process.cwd(), "VITE_");
    if (!env.VITE_CALCOM_LINK) {
      console.warn(
        "[vite.config] VITE_CALCOM_LINK is not set for this production build — " +
        "the contact page will show the static booking fallback instead of the Cal.com widget."
      );
    }
  }

  const securityHeaders = {
    "Content-Security-Policy": isDevelopment
      ? "default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self' https: http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*; frame-ancestors 'none'"
      : "default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self' https:; frame-ancestors 'none'",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Strict-Transport-Security": isDevelopment ? "" : "max-age=31536000; includeSubDomains; preload",
  };

  return {
    plugins: [
      react(),
      tailwindcss(),
      analyze ? visualizer({
        open: false,
        filename: "dist/stats.json",
        template: "raw-data",
        gzipSize: true,
      }) : undefined,
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom"],
    },
    server: {
      port: 5173,
      headers: securityHeaders,
    },
    preview: {
      headers: securityHeaders,
    },
    esbuild: isProduction ? { drop: ["console", "debugger"] } : undefined,
    build: {
      target: "es2022",
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          // Function form: the object form ("react-dom") misses subpath imports
          // like react-dom/client, which then land in the entry chunk.
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;
            if (/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom)\//.test(id)) return "vendor";
            if (id.includes("node_modules/motion") || id.includes("node_modules/framer-motion")) return "motion";
            if (id.includes("@dnd-kit")) return "dnd";
            return undefined;
          },
        },
      },
    },
  };
});
