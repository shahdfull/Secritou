import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  const isDevelopment = mode === "development";
  const isProduction = mode === "production";

  const securityHeaders = {
    "Content-Security-Policy": isDevelopment
      ? "default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https: http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*; frame-ancestors 'none'"
      : "default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https:; frame-ancestors 'none'",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Strict-Transport-Security": isDevelopment ? "" : "max-age=31536000; includeSubDomains; preload",
  };

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@shared": path.resolve(__dirname, "../shared/src"),
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
          manualChunks: {
            vendor: ["react", "react-dom", "react-router-dom"],
            charts: ["recharts"],
            motion: ["motion"],
            exports: ["jspdf", "jspdf-autotable", "xlsx"],
            dnd: ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
          },
        },
      },
    },
  };
});
