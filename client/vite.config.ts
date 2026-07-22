import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { visualizer } from "rollup-plugin-visualizer";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig(({ mode }) => {
  const isDevelopment = mode === "development";
  const isProduction = mode === "production";
  const analyze = process.env.ANALYZE === "true";
  // playwright.config.ts sets this when starting the production preview server for e2e: real
  // prod's connect-src is deliberately 'self' https: only (no plain http://), but the e2e suite
  // runs that same production build against a local http://localhost:5000 server — without this
  // exception the CSP silently blocks every API call (confirmed via a captured browser console
  // CSP violation: "Connecting to 'http://localhost:5000/api/v1/auth/login' violates ...
  // connect-src 'self' https:"), which looked like a broken login with no visible error.
  const isE2E = process.env.VITE_E2E === "true";

  // loadEnv reads .env files the same way Vite does for the app code itself
  // (process.env alone would miss a value set only in .env.production).
  if (isProduction) {
    void loadEnv(mode, process.cwd(), "VITE_");
  }

  const securityHeaders = {
    "Content-Security-Policy": isDevelopment || isE2E
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
        "@": srcDir,
      },
      dedupe: ["react", "react-dom"],
    },
    server: {
      port: 5173,
      headers: securityHeaders,
    },
    preview: {
      // Same port as the dev server: the server's CORS allowlist (FRONTEND_URL) is fixed to
      // http://localhost:5173, and e2e (playwright.config.ts) runs preview instead of dev to avoid
      // React StrictMode's dev-only double-mount — but it still needs to pass CORS.
      port: 5173,
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
