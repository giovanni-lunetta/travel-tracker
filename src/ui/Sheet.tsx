/**
 * A bottom sheet that behaves like a physical object:
 *  - follows your finger 1:1 while you drag it;
 *  - on release, uses your flick speed to decide whether to close, and carries
 *    that speed into a spring so there's no jolt between dragging and settling;
 *  - can be grabbed again at any moment, even mid-animation;
 *  - resists (rubber-bands) if you pull it past the top.
 * On wide screens it becomes a fixed side panel and these gestures are off.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { project, rubberband, stepSpring, type SpringState } from '../lib/spring';
import { Icon } from './icons';

const OPEN = { response: 0.38, damping: 1 };      // opening: smooth, no bounce
const CLOSE = { response: 0.3, damping: 1 };      // closing: smooth, no bounce
const SETTLE = { response: 0.3, damping: 0.8 };   // snapping back after a flick: a little bounce
const wide = () => window.matchMedia('(min-width: 900px)').matches;
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Sheet({ label, header, onClose, children }: {
  label: string; header: ComponentChildren; onClose: () => void; children: ComponentChildren;
}) {
  const el = useRef<HTMLDivElement>(null);
  const pos = useRef<SpringState>({ x: 0, v: 0 }); // where the sheet is NOW (px down from fully open)
  const raf = useRef(0);
  const drag = useRef<{ startY: number; startX: number; trail: { t: number; y: number }[] } | null>(null);

  const paint = (y: number) => { if (el.current) el.current.style.transform = `translate3d(0, ${y}px, 0)`; };

  /** Spring from the current position and velocity to `to`. Interruptible: cancelAnimationFrame stops it. */
  function run(to: number, cfg: { response: number; damping: number }, done?: () => void) {
    cancelAnimationFrame(raf.current);
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      pos.current = stepSpring(pos.current, to, cfg, dt);
      paint(pos.current.x);
      if (Math.abs(pos.current.x - to) < 0.4 && Math.abs(pos.current.v) < 8) {
        pos.current = { x: to, v: 0 };
        paint(to);
        done?.();
      } else raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }

  const close = () => {
    if (wide() || reduced() || !el.current) { onClose(); return; }
    run(el.current.offsetHeight + 20, CLOSE, onClose);
  };

  useEffect(() => {
    const node = el.current!;
    node.focus({ preventScroll: true });
    if (wide() || reduced()) { paint(0); return; }
    pos.current = { x: node.offsetHeight, v: 0 }; // start fully below the screen
    paint(pos.current.x);
    run(0, OPEN);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /* ---- dragging (on the handle and header only, so the content can scroll) ---- */
  function down(e: PointerEvent) {
    if (wide() || (e.target as HTMLElement).closest('button, input, select, a')) return;
    cancelAnimationFrame(raf.current); // grab it wherever it is
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startX: pos.current.x, trail: [{ t: e.timeStamp, y: e.clientY }] };
  }
  function move(e: PointerEvent) {
    const d = drag.current;
    if (!d || !el.current) return;
    const raw = d.startX + (e.clientY - d.startY);      // 1:1 with the finger, keeping the grab offset
    const y = raw < 0 ? rubberband(raw, el.current.offsetHeight) : raw;
    pos.current = { x: y, v: 0 };
    paint(y);
    d.trail.push({ t: e.timeStamp, y: e.clientY });
    while (d.trail.length > 2 && e.timeStamp - d.trail[0].t > 100) d.trail.shift();
  }
  function up(e: PointerEvent) {
    const d = drag.current;
    drag.current = null;
    if (!d || !el.current) return;
    const first = d.trail[0], last = d.trail[d.trail.length - 1];
    const v = last.t > first.t ? ((last.y - first.y) / (last.t - first.t)) * 1000 : 0; // px/s at release
    const h = el.current.offsetHeight;
    const lands = pos.current.x + project(v);            // where the flick would coast to
    pos.current = { x: pos.current.x, v };
    if (lands > h * 0.5) run(h + 20, CLOSE, onClose);
    else run(0, SETTLE);
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  }

  return (
    <div class="sheet" ref={el} role="dialog" aria-label={label} tabIndex={-1}>
      <div class="sheet-grab" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <div class="sheet-handle" aria-hidden="true" />
        <div class="sheet-header">
          <div class="sheet-title">{header}</div>
          <button class="icon-btn" onClick={close} aria-label="Close"><Icon name="close" /></button>
        </div>
      </div>
      <div class="sheet-body">{children}</div>
    </div>
  );
}
