import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import * as Sentry from "@sentry/react";
import { App } from "./App";
import { initWebVitals } from "./observability/webVitals";
import { ThemeProvider } from "./providers/ThemeProvider";
// Self-hosted variable fonts (single woff2 per family, all weights): same-origin,
// no extra DNS/TLS round-trip to Google Fonts, font-display: swap built in.
import "@fontsource-variable/inter";
import "@fontsource-variable/plus-jakarta-sans";
import "./styles.css";
import "./i18n";

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
  });
}

initWebVitals();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
