/** The scoreboard. Big serif numerals and one ink-stamp badge: the only flourish in the app. */
import { useMemo } from 'preact/hooks';
import { formatPartialDate } from '../lib/dates';
import { computeStats } from '../lib/stats';
import { store } from '../store';
import { BackupNudge } from './BackupNudge';

export function Stats() {
  const data = store.data.value!;
  const mode = store.settings.value.countMode;
  const s = useMemo(() => computeStats([...store.places.value.values()], data.catalog, mode), [store.places.value, mode]);
  const continents = Object.entries(s.continents).sort(([a], [b]) => a.localeCompare(b));
  const pct = Number.isInteger(s.percent) ? String(s.percent) : s.percent.toFixed(1);

  return (
    <section class="screen scroll" aria-label="Stats">
      <header class="screen-head"><h1>Stats</h1></header>
      <BackupNudge />

      <div class="stamp-wrap">
        <div class="stamp" role="img" aria-label={`${pct} percent of the world visited`}>
          <span class="stamp-num">{pct}<small>%</small></span>
          <span class="stamp-cap">of the world</span>
        </div>
        <p class="stamp-note">
          {s.countriesVisited} of {s.worldTotal} countries.{' '}
          <button class="text-btn" onClick={() => { store.tab.value = 'settings'; }}>Change how this is counted</button>
        </p>
      </div>

      <dl class="numbers">
        <div><dd>{s.countriesVisited}</dd><dt>Countries</dt></div>
        <div><dd>{s.statesVisited}<small>/{s.statesTotal}</small></dd><dt>US states</dt></div>
        <div><dd>{s.cities + s.pins}</dd><dt>Cities and pins</dt></div>
        <div><dd>{s.wishlist}</dd><dt>Want to go</dt></div>
      </dl>

      {s.extraVisited > 0 && (
        <p class="muted">Plus {s.extraVisited} {s.extraVisited === 1 ? 'territory or disputed place' : 'territories and disputed places'} outside the {s.worldTotal}.</p>
      )}
      {(s.firstVisit || s.latestVisit) && (
        <p class="muted">First trip on record: {formatPartialDate(s.firstVisit!)}. Latest: {formatPartialDate(s.latestVisit!)}.</p>
      )}

      <div class="group">
        <h2>By continent</h2>
        <ul class="plain bars">
          {continents.map(([name, c]) => (
            <li>
              <div class="bar-head"><span>{name}</span><span class="muted">{c.visited} of {c.total}</span></div>
              <div class="bar" role="presentation"><div style={{ width: `${c.total ? (c.visited / c.total) * 100 : 0}%` }} /></div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
