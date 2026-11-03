const SPANISH_MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function isRelevantEventSlug(slug: string, now = new Date(), lookbackMonths = 1): boolean {
  const monthPattern = SPANISH_MONTHS.join("|");
  const matches = [...slug.matchAll(new RegExp(`(?:^|-)(${monthPattern})-(20\\d{2})(?=-|$)`, "gi"))];
  if (matches.length === 0) return true;
  const match = matches[matches.length - 1];
  const eventMonth = Number(match[2]) * 12 + SPANISH_MONTHS.indexOf(match[1].toLowerCase());
  const currentMonth = now.getUTCFullYear() * 12 + now.getUTCMonth();
  return eventMonth >= currentMonth - lookbackMonths;
}
