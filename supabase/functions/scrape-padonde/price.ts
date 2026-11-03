const currencyPriceRe = /RD\$|US\$|DOP|\$/i;
const freePriceRe = /gratis|entrada libre|\bfree\b/i;
const paidLanguageRe = /consumo\s+m[ií]nimo|\bcover\b|\bboletas?\b|\btickets?\b|\bpreventa\b|\badmisi[oó]n\b/i;

export function isPaidPriceText(value: string): boolean {
  return currencyPriceRe.test(value) || paidLanguageRe.test(value);
}

export function isFreePriceText(value: string): boolean {
  return freePriceRe.test(value);
}

function formatDominicanAmount(raw: string): string | null {
  const normalized = raw.toLowerCase().trim();
  const mil = normalized.match(/(\d+(?:[.,]\d+)?)\s*mil/);
  if (mil) {
    const value = Number(mil[1].replace(",", ".")) * 1000;
    return Number.isFinite(value) ? Math.round(value).toLocaleString("en-US") : null;
  }
  const digits = normalized.replace(/[^\d]/g, "");
  if (!digits) return null;
  const value = Number(digits);
  return Number.isFinite(value) && value > 0 ? value.toLocaleString("en-US") : null;
}

export function inferPaidPriceFromText(text: string): string | null {
  if (!text) return null;
  const minimum = text.match(
    /consumo\s+m[ií]nimo(?:\s+en\s+el\s+local)?(?:\s+de)?\s*(?:(?:RD|DOP)\s*\$?\s*)?((?:\d+(?:[.,]\d+)?\s*mil)|(?:\d[\d.,]*))(?:\s*pesos?)?/i,
  );
  if (minimum) {
    const amount = formatDominicanAmount(minimum[1]);
    return amount ? `Consumo mínimo RD$${amount}` : "Consumo mínimo";
  }
  if (/consumo\s+m[ií]nimo/i.test(text)) return "Consumo mínimo";

  const ticketPrice = text.match(
    /(?:cover|boletas?|tickets?|preventa|admisi[oó]n|entrada)\s*(?::|desde|a partir de|-)?\s*((?:RD|DOP|US)\s*\$?\s*\d[\d.,]*|\$\s*\d[\d.,]*)/i,
  );
  return ticketPrice ? ticketPrice[1].replace(/\s+/g, "").replace(/^RD(?=\d)/i, "RD$") : null;
}

type PriceEvidence = {
  ldPrice: unknown;
  rscPrice?: unknown;
  mainBadges?: string[];
  description?: string;
};

export function resolveEventPrice({ ldPrice, rscPrice, mainBadges = [], description = "" }: PriceEvidence): unknown {
  const paidBadge = mainBadges.find((value) => isPaidPriceText(value));
  if (paidBadge) return paidBadge.trim();

  const inferred = inferPaidPriceFromText(description);
  if (inferred) return inferred;

  if (typeof rscPrice === "string" && isPaidPriceText(rscPrice)) return rscPrice.trim();
  if (typeof ldPrice === "string" && isPaidPriceText(ldPrice)) return ldPrice.trim();
  if (typeof ldPrice === "number" && ldPrice > 0) return ldPrice;
  if (typeof rscPrice === "number" && rscPrice > 0) return rscPrice;

  const freeBadge = mainBadges.find((value) => isFreePriceText(value));
  if (freeBadge) return "Gratis";
  if (typeof rscPrice === "string" && isFreePriceText(rscPrice)) return "Gratis";
  if (typeof ldPrice === "string" && isFreePriceText(ldPrice)) return "Gratis";

  return "De pago";
}

export function mapPrice(rawPrice: unknown): { priceTag: string; priceText: string | null } {
  if (typeof rawPrice === "string" && isPaidPriceText(rawPrice)) {
    return { priceTag: "De pago", priceText: rawPrice === "De pago" ? null : rawPrice.trim() };
  }
  if (typeof rawPrice === "string" && isFreePriceText(rawPrice)) {
    return { priceTag: "Gratis", priceText: "Gratis" };
  }
  if (typeof rawPrice === "number" && rawPrice > 0) {
    return { priceTag: "De pago", priceText: `RD$${Number(rawPrice).toLocaleString("es-DO")}` };
  }
  if (typeof rawPrice === "string" && !isNaN(Number(rawPrice)) && Number(rawPrice) > 0) {
    return { priceTag: "De pago", priceText: `RD$${Number(rawPrice).toLocaleString("es-DO")}` };
  }
  return { priceTag: "De pago", priceText: null };
}
