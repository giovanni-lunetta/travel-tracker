/**
 * Spring physics and gesture maths for fluid motion (used by the bottom sheet).
 *
 * A spring has no fixed duration: it is described by
 *   response — roughly how many seconds it takes to move (smaller = snappier)
 *   damping  — 1 settles smoothly with no bounce; below 1 overshoots a little
 * Because it always starts from the CURRENT position and velocity, you can
 * grab it mid-motion and it carries on without a jump.
 *
 * This is the exact (closed-form) solution of a damped spring, so it stays
 * stable even if a frame takes unusually long.
 */
export interface SpringState { x: number; v: number }
export interface SpringConfig { response: number; damping: number }

export function stepSpring(s: SpringState, to: number, cfg: SpringConfig, dt: number): SpringState {
  const w0 = (2 * Math.PI) / cfg.response; // natural frequency
  const z = cfg.damping;
  const d = s.x - to;
  if (z < 1) { // under-damped: overshoots, then settles
    const wd = w0 * Math.sqrt(1 - z * z);
    const a = d;
    const b = (s.v + z * w0 * d) / wd;
    const e = Math.exp(-z * w0 * dt);
    const cos = Math.cos(wd * dt), sin = Math.sin(wd * dt);
    return {
      x: to + e * (a * cos + b * sin),
      v: e * ((b * wd - z * w0 * a) * cos + (-a * wd - z * w0 * b) * sin),
    };
  }
  if (z === 1) { // critically damped: fastest approach with no overshoot
    const b = s.v + w0 * d;
    const e = Math.exp(-w0 * dt);
    return { x: to + (d + b * dt) * e, v: (b - w0 * (d + b * dt)) * e };
  }
  // over-damped: slow, no overshoot
  const root = Math.sqrt(z * z - 1);
  const r1 = -w0 * (z - root), r2 = -w0 * (z + root);
  const c1 = (s.v - r2 * d) / (r1 - r2);
  const c2 = d - c1;
  const e1 = Math.exp(r1 * dt), e2 = Math.exp(r2 * dt);
  return { x: to + c1 * e1 + c2 * e2, v: c1 * r1 * e1 + c2 * r2 * e2 };
}

/**
 * Where a flick will come to rest if it simply coasts (same formula scroll
 * views use). `velocity` is in px/s. Snap to the target nearest to
 * `position + project(velocity)` so a quick flick throws the sheet.
 */
export function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Soft edge: the further you drag past a limit, the less the content follows. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  const o = Math.abs(overshoot);
  return Math.sign(overshoot) * ((o * dimension * constant) / (dimension + constant * o));
}
