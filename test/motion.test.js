/**
 * Walkthrough · test/motion.test.js
 * Verification suite for pure mathematical motion primitives.
 */
const assert = require('assert');
const WM = require('../lib/motion.js');

console.log('[Walkthrough Test] Running motion library test suite...');

// 1. Version & Exports
assert.strictEqual(WM.version, '2.0.0', 'Motion version must be 2.0.0');
assert.strictEqual(typeof WM.ease.smooth, 'function', 'ease.smooth must be a function');
assert.strictEqual(typeof WM.spring, 'function', 'spring must be a function');
assert.strictEqual(typeof WM.swiftSpring, 'function', 'swiftSpring must be a function');

// 2. Math Primitives
assert.strictEqual(WM.clamp(5, 0, 10), 5);
assert.strictEqual(WM.clamp(-2, 0, 10), 0);
assert.strictEqual(WM.clamp(15, 0, 10), 10);

assert.strictEqual(WM.lerp(10, 20, 0.5), 15);
assert.strictEqual(WM.lerp(0, 100, 0), 0);
assert.strictEqual(WM.lerp(0, 100, 1), 100);

assert.strictEqual(WM.seg(0.5, 0, 1), 0.5);
assert.strictEqual(WM.seg(2, 0, 1), 1);
assert.strictEqual(WM.seg(-1, 0, 1), 0);

// 3. Easing boundaries
for (const [name, rawFn] of Object.entries(WM.ease)) {
  const fn = typeof rawFn(1) === 'function' ? rawFn() : rawFn;
  const at0 = fn(0);
  const at1 = fn(1);
  assert(Math.abs(at0) < 1e-4, `ease.${name}(0) should be ~0, got ${at0}`);
  assert(Math.abs(at1 - 1) < 1e-4, `ease.${name}(1) should be ~1, got ${at1}`);
}

// 4. Spring physics
const spr0 = WM.spring(0, 0.7, 20);
const spr1 = WM.spring(1.0, 0.7, 20);
assert.strictEqual(spr0, 0, 'spring at tau=0 must be 0');
assert(Math.abs(spr1 - 1.0) < 0.05, `spring at tau=1.0 should settle near 1.0, got ${spr1}`);

// 5. SwiftUI spring profiles
const swift0 = WM.swiftSpring(0, 'smooth');
const swift1 = WM.swiftSpring(0.8, 'smooth');
assert.strictEqual(swift0, 0);
assert(Math.abs(swift1 - 1.0) < 0.05);

// 6. Camera keyframe interpolation
const camKeys = [
  { t: 0, x: 0, y: 0, zoom: 1.0 },
  { t: 2.0, x: 200, y: 100, zoom: 1.2 },
];
const camAt0 = WM.camera(0, camKeys);
const camAt1 = WM.camera(1.0, camKeys);
const camAt2 = WM.camera(2.0, camKeys);

assert.strictEqual(camAt0.x, 0);
assert.strictEqual(camAt0.zoom, 1.0);
assert(camAt1.x > 50 && camAt1.x < 150, `cam at t=1.0 x should be intermediate, got ${camAt1.x}`);
assert.strictEqual(camAt2.x, 200);
assert.strictEqual(camAt2.zoom, 1.2);

// 7. Kinetic wordRise
const wr = WM.wordRise(0.5, 0.0);
assert(wr.op > 0, 'wordRise opacity should be visible');
assert(wr.k > 0, 'wordRise progress k should be positive');
assert(wr.s >= 0.94, 'wordRise scale should start >= s0');

// 8. Determinism test
const rngA = WM.rng(42);
const rngB = WM.rng(42);
assert.strictEqual(rngA(), rngB(), 'RNG with same seed must produce identical outputs');

console.log('✓ All 8 motion physics verification suites passed successfully!');
