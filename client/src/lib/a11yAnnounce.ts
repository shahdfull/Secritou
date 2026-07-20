const ANNOUNCE_EVENT = "secritou:a11y-announce";

export function announce(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ANNOUNCE_EVENT, { detail: message }));
}

export function getAnnounceEventName() {
  return ANNOUNCE_EVENT;
}
