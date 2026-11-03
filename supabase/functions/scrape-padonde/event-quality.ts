const BLOCKED_SOURCE_PAGES = new Set([
  "zonacolonial.do/actividades",
]);

export type EventQualityCandidate = {
  more_info_url?: unknown;
};

export type EventQualityIssue = "embedded_ad_listing";

export function getEventQualityIssue(candidate: EventQualityCandidate): EventQualityIssue | null {
  if (typeof candidate.more_info_url !== "string" || candidate.more_info_url.trim() === "") return null;

  try {
    const url = new URL(candidate.more_info_url);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    const pathname = url.pathname.replace(/\/+$/, "").toLowerCase();
    if (BLOCKED_SOURCE_PAGES.has(`${hostname}${pathname}`)) return "embedded_ad_listing";
  } catch {
    // A malformed external URL should not make an otherwise valid event disappear.
  }

  return null;
}
