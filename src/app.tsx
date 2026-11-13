import { boot, bootError } from './boot';
import { store, type Tab } from './store';
import { Icon } from './ui/icons';
import { Lists } from './ui/Lists';
import { MapChrome } from './ui/MapChrome';
import { MapView } from './ui/MapView';
import { PlaceSheet } from './ui/PlaceSheet';
import { Settings } from './ui/Settings';
import { Stats } from './ui/Stats';
import { ConfirmDialog, Toast } from './ui/Toast';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'map', label: 'Map', icon: 'map' },
  { id: 'lists', label: 'Lists', icon: 'list' },
  { id: 'stats', label: 'Stats', icon: 'chart' },
];

export function App() {
  const tab = store.tab.value;
  const error = bootError.value;

  if (error) {
    return (
      <div class="splash">
        <h1>Couldn’t start</h1>
        <p class="muted">{error}</p>
        <button class="btn primary" onClick={() => void boot()}>Try again</button>
      </div>
    );
  }
  if (!store.ready.value || !store.data.value) {
    return <div class="splash" role="status"><div class="spinner" aria-hidden="true" /><p class="muted">Loading your map…</p></div>;
  }

  const go = (t: Tab) => { store.sheet.value = null; store.tab.value = t; };

  return (
    <div class="app">
      <main class="screens">
        {/* The map stays mounted under the other screens so it keeps its position. */}
        <div class="screen map-screen" aria-hidden={tab !== 'map'}>
          <MapView />
          {tab === 'map' && <MapChrome />}
          {tab === 'map' && <PlaceSheet />}
        </div>
        {tab === 'lists' && <Lists />}
        {tab === 'stats' && <Stats />}
        {tab === 'settings' && (
          <>
            <Settings />
            <button class="back-btn" onClick={() => go('map')}><Icon name="back" size={20} /> Map</button>
          </>
        )}
        <Toast />
      </main>
      <nav class="tabbar" aria-label="Main">
        {TABS.map((t) => (
          <button class={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
            <Icon name={t.icon} size={24} /><span>{t.label}</span>
          </button>
        ))}
      </nav>
      <ConfirmDialog />
    </div>
  );
}
