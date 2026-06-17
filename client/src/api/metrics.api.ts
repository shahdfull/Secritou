const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api/v1";

export type WebVitalPayload = {
  name: "LCP" | "INP" | "CLS" | "TTFB" | "FCP";
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  id?: string;
  navigationType?: string;
  route: string;
};

export async function reportWebVital(payload: WebVitalPayload): Promise<void> {
  const url = `${API_BASE_URL}/metrics/web-vitals`;

  if (navigator.sendBeacon) {
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    if (navigator.sendBeacon(url, blob)) return;
  }

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  });
}
