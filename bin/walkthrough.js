#!/usr/bin/env node

/**
 * Walkthrough Engine CLI
 * Scriptable & AI-agent-ready product demo video generator.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const rawArgs = process.argv.slice(2);
const command = rawArgs[0] || 'help';

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i++;
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

function showHelp() {
  console.log(`
\x1b[1m\x1b[32mWalkthrough\x1b[0m — Scriptable Playwright Product Demo Engine

\x1b[1mUSAGE:\x1b[0m
  walkthrough <command> [storyboard.json] [options]

\x1b[1mCOMMANDS:\x1b[0m
  \x1b[36mbuild\x1b[0m [storyboard.json]   Full pipeline: audio -> record -> render
  \x1b[36maudio\x1b[0m [storyboard.json]   Synthesize narration + timing.json via edge-tts
  \x1b[36mrun\x1b[0m   [storyboard.json]   Record Playwright browser session with cursor & camera
  \x1b[36mrender\x1b[0m [storyboard.json]  Composite MP4 with dissolves, audio & subtitles
  \x1b[36mdemo\x1b[0m                      Run the Nexus Pulse 3-act showcase end-to-end
  \x1b[36mhelp\x1b[0m                      Display this reference manual

\x1b[1mOPTIONS:\x1b[0m
  --voice <name|male|female> Override TTS voice (e.g. en-US-AndrewMultilingualNeural)
  --output <dir>             Override output directory
  --url <baseUrl>            Override storyboard baseUrl
  --browser <name>           chromium (default), msedge, or chrome
  --headless <true|false>    Run browser headless (default: true)
  --sub-pos <bottom|top>     Subtitle vertical placement (default: bottom)
  --no-subtitles             Disable burned-in subtitles
  --fps <30|60>              Output frame rate (default: 30)
`);
}

function runStep(cmd, cmdArgs) {
  const res = spawnSync(cmd, cmdArgs, { stdio: 'inherit', cwd: process.cwd() });
  if (res.error) {
    console.error(`\x1b[31m[Walkthrough Error]\x1b[0m Failed to run ${cmd}: ${res.error.message}`);
    process.exit(1);
  }
  if (res.status !== 0) {
    process.exit(res.status || 1);
  }
}

function resolveStoryboard(positional) {
  const candidate = positional[1] || 'storyboard.json';
  const resolved = path.resolve(process.cwd(), candidate);
  if (!fs.existsSync(resolved)) {
    console.error(`\x1b[31m[Walkthrough Error]\x1b[0m Storyboard not found: ${resolved}`);
    process.exit(1);
  }
  return resolved;
}

function buildAudioArgs(storyboardPath, flags) {
  const out = [path.join(ROOT, 'engine/audio_synthesizer.py'), storyboardPath];
  if (flags.voice) out.push('--voice', String(flags.voice));
  if (flags.output) out.push('--output', String(flags.output));
  return out;
}

function buildRecordArgs(storyboardPath, flags) {
  const out = [path.join(ROOT, 'engine/record.js'), storyboardPath];
  if (flags.output) out.push('--output', String(flags.output));
  if (flags.url) out.push('--url', String(flags.url));
  if (flags.browser) out.push('--browser', String(flags.browser));
  if (flags.headless !== undefined) out.push('--headless', String(flags.headless));
  return out;
}

function buildRenderArgs(storyboardPath, flags) {
  const out = [path.join(ROOT, 'engine/compositor.py'), storyboardPath];
  if (flags.output) out.push('--output', String(flags.output));
  if (flags['no-subtitles']) out.push('--no-subtitles');
  if (flags['sub-pos']) out.push('--sub-pos', String(flags['sub-pos']));
  if (flags.fps) out.push('--fps', String(flags.fps));
  return out;
}

function runPipeline(storyboardPath, flags) {
  console.log(`\x1b[1m\x1b[32m[Walkthrough]\x1b[0m Building demo from: ${storyboardPath}`);
  runStep('python', buildAudioArgs(storyboardPath, flags));
  runStep('node', buildRecordArgs(storyboardPath, flags));
  runStep('python', buildRenderArgs(storyboardPath, flags));
}

const { positional, flags } = parseArgs(rawArgs);

switch (command) {
  case 'help':
  case '--help':
  case '-h':
    showHelp();
    break;

  case 'demo': {
    const demoStoryboard = path.join(ROOT, 'showcase/storyboard.json');
    runPipeline(demoStoryboard, flags);
    break;
  }

  case 'build':
    runPipeline(resolveStoryboard(positional), flags);
    break;

  case 'audio':
    runStep('python', buildAudioArgs(resolveStoryboard(positional), flags));
    break;

  case 'run':
    runStep('node', buildRecordArgs(resolveStoryboard(positional), flags));
    break;

  case 'render':
    runStep('python', buildRenderArgs(resolveStoryboard(positional), flags));
    break;

  default:
    console.error(`\x1b[31mUnknown command: ${command}\x1b[0m`);
    showHelp();
    process.exit(1);
}
