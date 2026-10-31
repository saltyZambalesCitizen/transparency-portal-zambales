import type { ReactNode } from 'react';
import type { BridgeGroup, Disclaimer } from '../api/types';
import type { Async } from '../lib/portal-context';
import { usePortal } from '../lib/portal-context';
import type { Reason } from '../lib/scope';
import { mapUrl, type Point } from '../lib/links';

/** The plain status, as the API words it, with the group's colour. */
export function StatusChip({ group, label, held }: { group: BridgeGroup; label: string; held?: boolean }) {
  return (
    <span className="status">
      <span className={`status-dot g-${group}`} aria-hidden="true" />
      <span>{label}</span>
      {held && (
        <span className="tag tag-warn" title="Unconfirmed match: the pairing is fuzzy or ambiguous.">
          unconfirmed match
        </span>
      )}
    </span>
  );
}

export function ReasonTags({ reasons }: { reasons: Reason[] }) {
  return (
    <span className="reasons">
      {reasons.map((r) => (
        <span
          key={r.kind + r.label}
          className={`tag ${r.kind === 'office' ? 'tag-office' : 'tag-place'}`}
          title={r.kind === 'office' ? `Listed under ${r.label}` : `The title names ${r.label}`}
        >
          {r.kind === 'office' ? 'DPWH office' : `names ${r.label}`}
        </span>
      ))}
    </span>
  );
}

/** The API's disclaimers, verbatim: printed from the response, so the wording cannot drift. */
export function Disclaimers({ items, compact }: { items: Disclaimer[]; compact?: boolean }) {
  if (!items.length) return null;
  return (
    <aside className={`disclaimers${compact ? ' compact' : ''}`} aria-label="Disclaimers">
      {items.map((d) => (
        <p key={d.id}>
          <strong>{d.title}</strong> {d.body}{' '}
          <a href={d.restrictions_url ?? d.url} target="_blank" rel="noopener">
            Read more ↗
          </a>
        </p>
      ))}
    </aside>
  );
}

/** Render `ready`, or a loading line, or the error with a retry. */
export function Await<T>({ state, children, what }: { state: Async<T>; children: (value: T) => ReactNode; what: string }) {
  const { retry } = usePortal();
  if (state.status === 'ready') return <>{children(state.value)}</>;
  if (state.status === 'loading') {
    return (
      <div className="state" role="status">
        <span className="spinner" aria-hidden="true" /> Loading {what} from the Budget API…
      </div>
    );
  }
  return (
    <div className="state state-error" role="alert">
      <p>
        <strong>Could not load {what}.</strong> {state.error.message}
      </p>
      <button type="button" className="button" onClick={retry}>
        Try again
      </button>
    </div>
  );
}

export function External({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener">
      {children} <span aria-hidden="true">↗</span>
    </a>
  );
}

/** "Map ↗" to the point in Google Maps, or a dash when there is none. */
export function MapLink({ point, source }: { point: Point | null; source: string }) {
  if (!point) return <span className="muted" title="No coordinates">—</span>;
  return (
    <a href={mapUrl(point.lat, point.lon)} target="_blank" rel="noopener noreferrer" title={`${point.lat}, ${point.lon} (${source}), in Google Maps`}>
      Map ↗
    </a>
  );
}
