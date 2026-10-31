/**
 * Towns and barangays read from project titles.
 *
 * The API places DPWH money by office and finds other lines by name; it does not
 * say which town or barangay a project is in. Most titles spell it out, though:
 * "Construction of Road, Barangay Amungan, Iba, Zambales". This reads that
 * address back out, so the list can be filtered by town and barangay.
 *
 * A town is the comma-separated phrase right before the province's name, kept
 * only if it looks like a place name (title case, no figures). Titles that do
 * not name the province ("…, Barangay Kalaklan, Olongapo City") are matched
 * against the towns learned that way. A barangay is a "Barangay"/"Brgy." phrase
 * before its town, or a bare phrase right before the town that another title
 * names as a barangay of that town. A title that names neither is "not stated":
 * the filters say so rather than guess.
 */

import { shortNameOf, type PortalConfig } from '../config';

export interface PlaceMention {
  /** "Botolan, Zambales": the town filter's value. */
  town: string;
  /** "Porac, Botolan, Zambales": the barangay filter's values. */
  barangays: string[];
}

export interface PlaceOption {
  /** The phrase compared with the titles, e.g. "Porac, Botolan, Zambales". */
  value: string;
  /** What the option shows, e.g. "Porac". */
  name: string;
  rows: number;
  /** For a town: its rows whose title names no barangay. */
  unnamed?: number;
}

export interface PlaceIndex {
  /** Every town named, A–Z. */
  towns: PlaceOption[];
  /** Titles that name no town. */
  unnamed: number;
  /** Each town's barangays, A–Z, by the town's value. */
  barangays: Map<string, PlaceOption[]>;
  /** Each title's places (empty when it names no town). */
  of: (title: string) => PlaceMention[];
}

/** The filter value for "the title does not name one". */
export const NOT_STATED = '-';

/** A place index over some rows, with each row's places read once. */
export interface RowPlaces<T> extends PlaceIndex {
  byRow: Map<T, PlaceMention[]>;
}

/**
 * Places named in the rows' text, for a province portal (the names are read
 * against the province's name); null for any other kind of portal.
 */
export function placesOf<T>(rows: readonly T[], text: (row: T) => string, config: PortalConfig): RowPlaces<T> | null {
  if (config.kind !== 'province') return null;
  const index = indexPlaces(rows.map(text), shortNameOf(config));
  return { ...index, byRow: new Map(rows.map((r) => [r, index.of(text(r))] as const)) };
}

/** Whether a row's places pass the town and barangay filters (values from the URL). */
export function inPlace(named: readonly PlaceMention[], town: string, brgy: string): boolean {
  if (!town) return true;
  if (town === NOT_STATED) return named.length === 0;
  const here = named.find((n) => n.town === town);
  if (!here) return false;
  if (brgy === NOT_STATED) return here.barangays.length === 0;
  return !brgy || here.barangays.includes(brgy);
}

const BARANGAY = String.raw`(?:Barangay\.?|Brgy\.?|Bgy\.?|Bgry\.?|Bo\.|Barrio)`;
// A barangay name ends at a comma, a parenthesis with figures, " to ", " and ",
// a dash before the next "Barangay", or the end. Other dashes are part of the
// name: "Barangay East Bajac - Bajac" is East Bajac-Bajac.
const BARANGAY_NAME = new RegExp(String.raw`\b${BARANGAY}\s+([^,()]+?(?:\s*\([A-Za-z ]+\))?)(?=\s*(?:,|\(|[-–]\s*${BARANGAY}|\bto\b|\band\b|$))`, 'gi');
// Words that start a road, building or site, not a barangay name: what follows
// them is cut ("Brgy. San Agustin FMR" → San Agustin, "Mambog Road" → Mambog).
// The same goes for a stretch of road or river ("Amungan Section", "North
// Approach", "Upstream") and for what a phrase that is no place starts with.
const WORKS = /(?:^|\s+)(?:roads?|rd|by-?pass|street|st|bridge|br|fmr|highway|hwy|avenue|ave|building|hall|school|port|river|market|office|center|centre|facility|facilities|hospital|supply|resettlement|phase|extension|section|segment|package|approach|upstream|downstream|area|care|cave|construction|rehabilitation|repair|improvement|installation|concreting|in-house|day care)\b.*$/i;
const PLACE_WORD = /^(?:[A-Z][a-zA-Zñ'.-]*|de|del|dela)$/;
// "Municipality of Botolan", "City of Olongapo": the town is the name after it.
const LGU_PREFIX = /^(?:municipality|city|province|town)\s+of\s+/i;
/** A town key that also treats "Olongapo" and "Olongapo City" as one. */
const townKey = (s: string) => placeKey(s.replace(LGU_PREFIX, '')).replace(/ city$/, '');

/** A key that treats "Sta Cruz", "Sta. Cruz", "Santa Cruz" and "STA. CRUZ" as one. */
export function placeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, ' ')
    .replace(/\bsanta\b/g, 'sta')
    .replace(/\bsanto\b/g, 'sto')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// "Sto. Ni±o": an ñ the source documents lost in conversion.
const tidy = (s: string) => s.replace(/±/g, 'ñ').replace(/\s+/g, ' ').replace(/\s*-$/, '').trim();
/** "San isidro" → "San Isidro"; "de", "del" and "dela" stay lower case. */
const capitalise = (s: string) =>
  s.split(' ').map((w, i) => (i > 0 && /^(de|del|dela)$/.test(w) ? w : w.replace(/^[a-zñ]/, (c) => c.toUpperCase()))).join(' ');

function looksLikePlace(s: string): boolean {
  const words = s.split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 3 || /\d/.test(s)) return false;
  if (new RegExp(String.raw`^${BARANGAY}$`, 'i').test(words[0])) return false;
  if (/^[A-Z.-]+$/.test(words[0]) && words[0].length > 3) return false; // "DSWD", "NLSG"
  return words.every((w) => PLACE_WORD.test(w));
}

/** The most common spelling of each key: "Sta. Cruz" over "Sta Cruz". */
class Spellings {
  private seen = new Map<string, Map<string, number>>();
  private key: (s: string) => string;
  constructor(key: (s: string) => string = placeKey) { this.key = key; }
  /** How many times a key was seen. */
  count(k: string) { let n = 0; for (const c of this.seen.get(k)?.values() ?? []) n += c; return n; }
  delete(k: string) { this.seen.delete(k); }
  add(s: string) {
    const k = this.key(s);
    const m = this.seen.get(k) ?? new Map<string, number>();
    m.set(s, (m.get(s) ?? 0) + 1);
    this.seen.set(k, m);
  }
  has(k: string) { return this.seen.has(k); }
  keys() { return this.seen.keys(); }
  best(k: string): string {
    const m = this.seen.get(k);
    if (!m) return k;
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
  }
}

interface RawMention { town: string; before: string }

/** Each "<town>, <province>" in a title, with the text before it (back to the previous one). */
function anchored(title: string, province: string): RawMention[] {
  const out: RawMention[] = [];
  // Not part of a road name: "Pangasinan - Zambales Rd" and "Tarlac Zambales Road"
  // do not place a project in Pangasinan or Tarlac.
  const p = province.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(String.raw`([^,()]*?)[\s,]*(?<![-–]\s*)\b${p}\b(?!\s*[-–]\s*\w)(?!\s+(?:road|rd|highway|hwy|north|south)\b)`, 'gi');
  let from = 0;
  for (let m = re.exec(title); m; m = re.exec(title)) {
    out.push({ town: tidy(m[1]), before: title.slice(from, m.index) });
    from = m.index + m[0].length;
  }
  return out;
}

function barangaysIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(BARANGAY_NAME)) {
    // "Barangay Hall Extension Barangay Baraca": the last "Barangay" names it.
    const inner = m[1].split(new RegExp(String.raw`\b${BARANGAY}\s+`, 'i')).pop() ?? '';
    const name = capitalise(tidy(inner.replace(WORKS, '')).replace(/\s*[-–]\s*/g, '-'));
    if (name && name.split(/\s+/).length <= 4) out.push(name);
  }
  return out;
}

export function indexPlaces(titles: readonly string[], province: string): PlaceIndex {
  const townNames = new Spellings(townKey);
  const brgyNames = new Map<string, Spellings>(); // by town key

  // 1. Towns: the phrase before the province, where it looks like a place and
  // names no road or building ("Capas-Botolan Road", "Subic Fishing Port").
  for (const t of titles) for (const m of anchored(t, province)) {
    const name = m.town.replace(LGU_PREFIX, '');
    if (looksLikePlace(name) && !WORKS.test(name) && !/^(?:sitio|purok)\b/i.test(name)) townNames.add(name);
  }
  // Drop what only looks like a town: a name seen once (a naval station, a
  // stray word), a barangay written before its town without a comma ("Yamot
  // Candelaria"), and a road between two towns ("Iba-Palauig").
  for (const k of [...townNames.keys()]) {
    const others = [...townNames.keys()].filter((o) => o !== k);
    const halves = townNames.best(k).split('-').map(townKey);
    if (
      townNames.count(k) < 2 ||
      others.some((o) => k.endsWith(` ${o}`)) ||
      (halves.length === 2 && halves.every((h) => others.includes(h)))
    ) townNames.delete(k);
  }
  const townKeys = [...townNames.keys()];

  // A phrase that ends with a known town: "Barangay San Nicolas Castillejos".
  const splitTown = (phrase: string): { town: string; rest: string } | null => {
    const k = townKey(phrase);
    if (townNames.has(k)) return { town: k, rest: '' };
    for (const tk of townKeys) {
      if (k.endsWith(` ${tk}`)) {
        const words = tk.split(' ').length;
        return { town: tk, rest: phrase.split(/\s+/).slice(0, -words).join(' ') };
      }
    }
    return null;
  };

  // 2. Each title's raw mentions: town key + the text that may hold its barangay.
  const mentionsOf = (title: string): { town: string; text: string }[] => {
    const out: { town: string; text: string }[] = [];
    for (const m of anchored(title, province)) {
      const hit = splitTown(m.town);
      if (hit) out.push({ town: hit.town, text: `${m.before}, ${hit.rest}` });
    }
    if (out.length) return out;
    // No "<town>, <province>": a bare comma phrase that is a known town ("…, Olongapo City (14.8, 120.2)").
    const parts = title.split(',');
    for (let i = 0; i < parts.length; i++) {
      const phrase = tidy(parts[i].replace(/\(.*$/, ''));
      if (townNames.has(townKey(phrase))) out.push({ town: townKey(phrase), text: parts.slice(0, i).join(',') });
    }
    return out;
  };

  // 3. Barangays named with "Barangay"/"Brgy.", by town.
  const cache = new Map<string, { town: string; text: string }[]>();
  for (const t of titles) {
    const ms = mentionsOf(t);
    cache.set(t, ms);
    for (const m of ms) {
      const s = brgyNames.get(m.town) ?? new Spellings();
      for (const b of barangaysIn(m.text)) s.add(b);
      brgyNames.set(m.town, s);
    }
  }

  // A phrase right before the town with no "Barangay": "Biay, Sta Cruz", "Yamot- Lauis, Candelaria".
  // Kept when it reads as a place name with nothing built in it, or when, cut
  // before a works word, it is a barangay another title names ("Mambog Road").
  const bareBarangays = (phrase: string, town: string): string[] => {
    const known = brgyNames.get(town);
    const out: string[] = [];
    for (const raw of phrase.split(/\s*-\s+|\s+-\s*|\s+to\s+/)) {
      const part = tidy(raw);
      if (known?.has(placeKey(part))) { out.push(part); continue; } // "Zone 6, Iba"
      const cut = tidy(part.replace(WORKS, ''));
      if (!cut || townNames.has(townKey(cut))) continue;
      if (cut !== part) { if (known?.has(placeKey(cut))) out.push(cut); continue; }
      if (!looksLikePlace(part) || /^(?:sitio|purok)\b/i.test(part)) continue;
      // "Botolan Sta. Barbara", "Iba-Botolan": a phrase naming a town is no barangay.
      if (townKeys.some((tk) => ` ${placeKey(part)} `.includes(` ${tk} `))) continue;
      // "Bangantalinga-Amungan": a road between two known barangays, not a third.
      const halves = part.split('-');
      if (halves.length === 2 && halves.every((h) => known?.has(placeKey(h)))) out.push(...halves);
      else out.push(capitalise(part));
    }
    return out;
  };

  // 4. Each title's town keys and barangay keys (bare names join the spellings).
  const rawOf = (title: string, learn: boolean): Map<string, Set<string>> => {
    const byTown = new Map<string, Set<string>>();
    for (const m of cache.get(title) ?? mentionsOf(title)) {
      const set = byTown.get(m.town) ?? new Set<string>();
      const named = barangaysIn(m.text);
      for (const b of named) set.add(placeKey(b));
      if (!named.length) {
        const last = tidy(m.text.split(',').filter((p) => p.trim()).pop()?.replace(/\(.*$/, '') ?? '');
        for (const b of bareBarangays(last, m.town)) {
          set.add(placeKey(b));
          if (learn) brgyNames.get(m.town)?.add(b);
        }
      }
      byTown.set(m.town, set);
    }
    return byTown;
  };
  const raw = new Map(titles.map((t) => [t, rawOf(t, true)] as const));

  const townValue = (tk: string) => `${townNames.best(tk)}, ${province}`;
  const of = (title: string): PlaceMention[] =>
    [...(raw.get(title) ?? rawOf(title, false)).entries()].map(([tk, bs]) => ({
      town: townValue(tk),
      barangays: [...bs].map((bk) => `${brgyNames.get(tk)?.best(bk) ?? bk}, ${townValue(tk)}`),
    }));

  // 5. Options with counts (a project counts once per town and once per barangay).
  const townRows = new Map<string, number>();
  const townUnnamed = new Map<string, number>();
  const brgyRows = new Map<string, Map<string, number>>();
  let unnamed = 0;
  for (const t of titles) {
    const ps = of(t);
    if (!ps.length) unnamed++;
    for (const p of ps) {
      townRows.set(p.town, (townRows.get(p.town) ?? 0) + 1);
      if (!p.barangays.length) townUnnamed.set(p.town, (townUnnamed.get(p.town) ?? 0) + 1);
      const m = brgyRows.get(p.town) ?? new Map<string, number>();
      for (const b of p.barangays) m.set(b, (m.get(b) ?? 0) + 1);
      brgyRows.set(p.town, m);
    }
  }
  const az = (a: PlaceOption, b: PlaceOption) => a.name.localeCompare(b.name, 'en', { numeric: true });
  const towns = [...townRows.entries()]
    .map(([value, rows]) => ({ value, name: value.slice(0, -(province.length + 2)), rows, unnamed: townUnnamed.get(value) ?? 0 }))
    .sort(az);
  const barangays = new Map<string, PlaceOption[]>();
  for (const [town, m] of brgyRows) {
    barangays.set(town, [...m.entries()].map(([value, rows]) => ({ value, name: value.slice(0, -(town.length + 2)), rows })).sort(az));
  }
  return { towns, unnamed, barangays, of };
}
