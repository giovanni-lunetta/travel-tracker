import { render } from 'preact';
import { App } from './app';
import { boot } from './boot';
import { registerSW } from 'virtual:pwa-register';
import './styles.css';

render(<App />, document.getElementById('app')!);
void boot();

// Install the service worker (this is what makes the app work offline and installable).
registerSW({ immediate: true });
