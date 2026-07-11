import type { AnalyticsEventName, AnalyticsProperties } from "@/types/analytics";

const isAnalyticsDebugEnabled = import.meta.env.VITE_ANALYTICS_DEBUG === "true";
const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api/v1";
const EVENTS_ENDPOINT = `${API_BASE_URL}/analytics/events`;

// Random per-tab session id, not persisted to localStorage/cookies — a fresh id
// is generated on every page load, so events can't be correlated across visits.
const sessionId = crypto.randomUUID();

function enrichProperties(properties: AnalyticsProperties = {}) {
  return {
    ...properties,
    page_path: window.location.pathname,
    page_url: window.location.href,
  };
}

export function trackEvent(eventName: AnalyticsEventName, properties?: AnalyticsProperties) {
  if (typeof window === "undefined") return;

  const enriched = enrichProperties(properties);
  const { page_path, page_url, ...rest } = enriched;

  const body = JSON.stringify({
    name: eventName,
    properties: rest,
    sessionId,
    pagePath: page_path,
    pageUrl: page_url,
    referrer: document.referrer || undefined,
  });

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon(EVENTS_ENDPOINT, blob);
  } else {
    fetch(EVENTS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // Best-effort: analytics must never surface an error to the user.
    });
  }

  if (isAnalyticsDebugEnabled) {
    console.info("[analytics]", eventName, enriched);
  }
}

export function trackPageView(properties?: AnalyticsProperties) {
  trackEvent("page_view", properties);
}

export function trackCtaClick(properties: AnalyticsProperties) {
  trackEvent("cta_clicked", properties);
}

export function trackContactFormSubmitted(properties: AnalyticsProperties) {
  trackEvent("contact_form_submitted", properties);
}

export function trackContactFormFailed(properties: AnalyticsProperties) {
  trackEvent("contact_form_failed", properties);
}

export function trackServiceCardClicked(properties: AnalyticsProperties) {
  trackEvent("service_card_clicked", properties);
}

export function trackSolutionSegmentClicked(properties: AnalyticsProperties) {
  trackEvent("solution_segment_clicked", properties);
}

export function trackSolutionNeedClicked(properties: AnalyticsProperties) {
  trackEvent("solution_need_clicked", properties);
}
