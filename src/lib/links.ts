/** Where this portal's source lives; the "Build your own" links point here. */
export const SOURCE_CODE_URL = 'https://github.com/bettergovph/transparency-portal';
/** The national HGAB section on budget.bettergov.ph. */
export const NATIONAL_URL = 'https://budget.bettergov.ph/hgab/2027/overview';

/** A Google Maps link to one point. */
export const mapUrl = (lat: number, lon: number) => `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

export interface Point { lat: number; lon: number }

/**
 * Coordinates typed into a name: "…, Iba, Zambales (15.39008, 120.01959)" or
 * "… LAT 15.749263, LONG 119.909295". Kept only inside the Philippines, so a
 * kilometre post or a station number is not read as a place.
 */
export function pointInText(text: string): Point | null {
  const m = text.match(/(?:LAT\.?\s*)?\b(\d{1,2}\.\d{3,})\s*,?\s*(?:LONG?\.?\s*)?\b(1[12]\d\.\d{3,})\b/i);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  return lat >= 4 && lat <= 21.5 && lon >= 116 && lon <= 127 ? { lat, lon } : null;
}
