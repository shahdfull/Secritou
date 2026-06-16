import type { AnalyticsEventName, AnalyticsProperties } from "@/types/analytics";

const isAnalyticsDebugEnabled = import.meta.env.VITE_ANALYTICS_DEBUG === "true";

function enrichProperties(properties: AnalyticsProperties = {}) {
  return {
    ...properties,
    page_path: window.location.pathname,
    page_url: window.location.href,
  };
}

export function trackEvent(eventName: AnalyticsEventName, properties?: AnalyticsProperties) {
  if (typeof window === "undefined") return;

  const payload = enrichProperties(properties);

  window.posthog?.capture(eventName, payload);
  window.gtag?.("event", eventName, payload);

  if (isAnalyticsDebugEnabled) {
    console.info("[analytics]", eventName, payload);
  }
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

