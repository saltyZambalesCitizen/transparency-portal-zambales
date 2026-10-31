/**
 * The Municipality → Barangay filters, under a "More filters" toggle. Shared by
 * the 2027 project list and the 2020–2026 programs list; the towns and
 * barangays are read from each row's name (src/lib/places.ts).
 */
import { useMemo, useState } from 'react';
import { count } from '../lib/format';
import { NOT_STATED, type RowPlaces } from '../lib/places';

// Whether the row is shown; a per-browser convenience, so storage may fail.
const OPEN_KEY = 'portal.filters-open';
function readOpen(): boolean {
  try { return localStorage.getItem(OPEN_KEY) !== 'false'; } catch { return true; }
}
function saveOpen(open: boolean) {
  try { localStorage.setItem(OPEN_KEY, String(open)); } catch { /* not stored */ }
}

export default function PlaceFilters<T>({ places, town, brgy, onTown, onBarangay }: {
  places: RowPlaces<T> | null;
  town: string;
  brgy: string;
  /** Sets the town and clears the barangay, which belongs to its town. */
  onTown: (value: string) => void;
  onBarangay: (value: string) => void;
}) {
  const [open, setOpen] = useState(readOpen);
  const [townOption, barangays] = useMemo(() => {
    const t = places?.towns.find((o) => o.value === town);
    return [t, (t && places?.barangays.get(town)) || []] as const;
  }, [places, town]);
  if (!places || !places.towns.length) return null;
  // Counted so a hidden filter is not forgotten.
  const active = [town, brgy].filter(Boolean).length;
  const chosen = !!town && town !== NOT_STATED;

  return (
    <>
      <div className="filters-head">
        <span className="label">More filters{active ? ` · ${active} active` : ''}</span>
        <button
          type="button"
          className="link-button"
          aria-expanded={open}
          aria-controls="more-filters"
          onClick={() => { setOpen(!open); saveOpen(!open); }}
        >
          {open ? 'Hide' : 'Show'}
        </button>
      </div>
      <div className="toolbar" id="more-filters" hidden={!open}>
        <label className="field">
          <span className="label">Municipality</span>
          <select value={town} onChange={(e) => onTown(e.target.value)}>
            <option value="">Any municipality</option>
            {places.towns.map((t) => <option key={t.value} value={t.value}>{t.name} ({count(t.rows)})</option>)}
            <option value={NOT_STATED}>Not stated in title ({count(places.unnamed)})</option>
          </select>
        </label>
        <label className="field">
          <span className="label">Barangay</span>
          <select
            value={chosen ? brgy : ''}
            disabled={!chosen}
            title={chosen ? undefined : 'Choose a municipality first'}
            onChange={(e) => onBarangay(e.target.value)}
          >
            <option value="">{chosen ? 'Any barangay' : 'Choose a municipality first'}</option>
            {barangays.map((b) => <option key={b.value} value={b.value}>{b.name} ({count(b.rows)})</option>)}
            {townOption?.unnamed ? <option value={NOT_STATED}>Not stated in title ({count(townOption.unnamed)})</option> : null}
          </select>
        </label>
      </div>
    </>
  );
}
