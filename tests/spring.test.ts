import { describe, expect, test } from 'vitest';
import { project, rubberband, stepSpring, type SpringState } from '../src/lib/spring';

/** Runs the spring at 60 fps for `seconds` and returns every position. */
function run(from: number, to: number, o: { velocity?: number; response?: number; damping?: number }, seconds = 3) {
  let s: SpringState = { x: from, v: o.velocity ?? 0 };
  const xs = [s.x];
  for (let i = 0; i < seconds * 60; i++) {
    s = stepSpring(s, to, { response: o.response ?? 0.35, damping: o.damping ?? 1 }, 1 / 60);
    xs.push(s.x);
  }
  return { xs, end: s };
}

describe('stepSpring (Apple-style response/damping spring)', () => {
  test('settles on the target', () => {
    const { end } = run(0, 100, {});
    expect(end.x).toBeCloseTo(100, 1);
    expect(Math.abs(end.v)).toBeLessThan(0.5);
  });
  test('critically damped (damping 1) never overshoots', () => {
    expect(Math.max(...run(0, 100, { damping: 1 }).xs)).toBeLessThanOrEqual(100.001);
  });
  test('damping 0.8 overshoots a little, then settles', () => {
    const { xs, end } = run(0, 100, { damping: 0.8 });
    expect(Math.max(...xs)).toBeGreaterThan(100.5);
    expect(end.x).toBeCloseTo(100, 1);
  });
  test('a smaller response is faster', () => {
    const at = (response: number) => run(0, 100, { response }).xs[15];
    expect(at(0.2)).toBeGreaterThan(at(0.5));
  });
  test('starting velocity carries through: a spring thrown toward the target gets there sooner', () => {
    expect(run(0, 100, { velocity: 800 }).xs[8]).toBeGreaterThan(run(0, 100, { velocity: 0 }).xs[8]);
  });
  test('stable at long frame times (a dropped frame does not explode)', () => {
    let s: SpringState = { x: 0, v: 0 };
    for (let i = 0; i < 20; i++) s = stepSpring(s, 100, { response: 0.35, damping: 1 }, 0.1);
    expect(s.x).toBeGreaterThan(0);
    expect(s.x).toBeLessThan(120);
  });
});

describe('project (where a flick will come to rest)', () => {
  test('1000 px/s with scroll-like deceleration lands ~499 px further', () => {
    expect(project(1000)).toBeCloseTo(499, 0);
  });
  test('no velocity, no projection; direction is preserved', () => {
    expect(project(0)).toBe(0);
    expect(project(-1000)).toBeCloseTo(-499, 0);
  });
});

describe('rubberband (soft edge)', () => {
  test('follows the finger a little, never beyond the dimension', () => {
    expect(rubberband(0, 600)).toBe(0);
    expect(rubberband(100, 600)).toBeGreaterThan(0);
    expect(rubberband(100, 600)).toBeLessThan(100);
    expect(rubberband(100000, 600)).toBeLessThan(600);
  });
  test('resistance grows with distance', () => {
    expect(rubberband(200, 600) / 200).toBeLessThan(rubberband(50, 600) / 50);
  });
});
