export type AnalyticsEventName =
  | "cta_clicked"
  | "contact_form_submitted"
  | "contact_form_failed"
  | "service_card_clicked"
  | "solution_segment_clicked"
  | "solution_need_clicked";

export type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    gtag?: (
      command: "event" | "config" | "js",
      eventName: string,
      properties?: AnalyticsProperties,
    ) => void;
    posthog?: {
      capture: (eventName: string, properties?: AnalyticsProperties) => void;
    };
  }
}

