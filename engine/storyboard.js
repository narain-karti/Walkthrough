/**
 * Storyboard contract shared by the recorder and the CLI.
 *
 * This intentionally contains no product copy.  A walkthrough is a plan for a
 * real product, not a variation of the Nexus Pulse demo.
 */
const fs = require('fs');
const path = require('path');

const MODES = new Set(['walkthrough', 'explainer', 'pitch']);
const ACTIONS = new Set(['click', 'type', 'press', 'hover', 'select']);

function fail(message) { throw new Error(`Invalid storyboard: ${message}`); }

function readStoryboard(file) {
  const absolute = path.resolve(file);
  if (!fs.existsSync(absolute)) fail(`file not found: ${absolute}`);
  let value;
  try { value = JSON.parse(fs.readFileSync(absolute, 'utf8')); }
  catch (error) { fail(`${absolute} is not valid JSON (${error.message})`); }
  return { ...validateStoryboard(value), __file: absolute };
}

function validateStoryboard(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('expected an object');
  if (!raw.title || typeof raw.title !== 'string') fail('title is required');
  if (!raw.baseUrl || typeof raw.baseUrl !== 'string') fail('baseUrl is required');
  if (!Array.isArray(raw.steps) || !raw.steps.length) fail('at least one step is required');
  const mode = raw.mode || 'walkthrough';
  if (!MODES.has(mode)) fail(`mode must be one of ${[...MODES].join(', ')}`);

  const ids = new Set();
  const steps = raw.steps.map((input, index) => {
    const step = { ...input };
    step.id ||= `step-${index + 1}`;
    if (ids.has(step.id)) fail(`duplicate step id: ${step.id}`);
    ids.add(step.id);
    if (!step.title && !step.desc) fail(`step ${step.id} needs title or desc`);
    step.title ||= step.desc;
    step.holdMs ??= 2400;
    if (!Number.isFinite(step.holdMs) || step.holdMs < 400 || step.holdMs > 20000) {
      fail(`step ${step.id} holdMs must be 400–20000`);
    }
    if (step.action && !ACTIONS.has(step.action)) fail(`step ${step.id} has unsupported action ${step.action}`);
    if (step.action && !step.selector) fail(`step ${step.id} action requires selector`);
    if (['type', 'press', 'select'].includes(step.action) && step.value == null && step.text == null && step.key == null) {
      fail(`step ${step.id} ${step.action} action needs value, text, or key`);
    }
    if (step.waitFor && typeof step.waitFor !== 'object') fail(`step ${step.id} waitFor must be an object`);
    return step;
  });

  return {
    version: 3,
    title: raw.title.trim(),
    mode,
    baseUrl: raw.baseUrl,
    outputDir: raw.outputDir || './walkthrough-output',
    brand: raw.brand || {},
    steps,
  };
}

function usage() {
  return `\nStoryboard v3 modes: walkthrough (real UI), explainer (UI proof + designed interstitials), pitch (claim/proof/CTA).\n` +
    `Every interaction uses selector + action. Optional waitFor: { selector, state, text, url }.\n`;
}

module.exports = { ACTIONS, MODES, readStoryboard, validateStoryboard, usage };
