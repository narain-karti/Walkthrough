const assert = require('assert');
const { validateStoryboard } = require('../engine/storyboard');

const base = {
  title: 'A real product', baseUrl: 'http://localhost:3000', mode: 'walkthrough',
  steps: [
    { id: 'overview', title: 'Orient the viewer', holdMs: 1200 },
    { id: 'save', title: 'Save the change', selector: '[data-demo=save]', action: 'click', waitFor: { text: 'Saved' } },
  ],
};
const plan = validateStoryboard(base);
assert.equal(plan.version, 3);
assert.equal(plan.steps[1].holdMs, 2400);
assert.throws(() => validateStoryboard({ ...base, mode: 'movie' }), /mode must be/);
assert.throws(() => validateStoryboard({ ...base, steps: [{ title: 'Bad', action: 'click' }] }), /action requires selector/);
assert.throws(() => validateStoryboard({ ...base, steps: [{ title: 'Fast', holdMs: 100 }] }), /holdMs/);
console.log('✓ storyboard contract tests passed');
