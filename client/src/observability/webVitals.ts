import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from "web-vitals";
import { reportWebVital } from "../api/metrics.api";

function sendMetric(metric: Metric) {
  const route = window.location.pathname;
  void reportWebVital({
    name: metric.name as "LCP" | "INP" | "CLS" | "TTFB" | "FCP",
    value: metric.value,
    rating: metric.rating,
    id: metric.id,
    navigationType: metric.navigationType,
    route,
  });
}

export function initWebVitals() {
  if (import.meta.env.DEV && import.meta.env.VITE_OBSERVABILITY_DEBUG !== "true") {
    return;
  }

  onLCP(sendMetric);
  onINP(sendMetric);
  onCLS(sendMetric);
  onTTFB(sendMetric);
  onFCP(sendMetric);
}
