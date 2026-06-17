import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { initWebVitals } from "./observability/webVitals";
import { ThemeProvider } from "./providers/ThemeProvider";
import "./styles.css";
import "./i18n";

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
