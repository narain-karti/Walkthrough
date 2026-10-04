#!/usr/bin/env node

/**
 * Walkthrough Engine CLI
 * Autonomous Codebase Walkthrough, Live Screen Recording & Demo Video Generator
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const { readStoryboard, usage } = require('../engine/storyboard');

const py = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const rootDir = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const command = args[0] || 'help';

function showHelp() {
  console.log(`
\x1b[1m\x1b[32mWalkthrough Engine v2.0.0\x1b[0m — Autonomous UI Demo & Screen Recording Suite

\x1b[1mUSAGE:\x1b[0m
  walkthrough <command> [options]

\x1b[1mCOMMANDS:\x1b[0m
  \x1b[36mrun\x1b[0m [storyboard.json]     Record live web app with physics cursor and camera
  \x1b[36mplan\x1b[0m <storyboard.json>     Validate and inspect a v3 production storyboard
  \x1b[36maudio\x1b[0m                   Synthesize speech narration via edge-tts
  \x1b[36msfx\x1b[0m [demo|--events]       Synthesize acoustic sound effects in shared reverb room
  \x1b[36mscenes\x1b[0m                Render Act 1 (Intro) & Act 3 (Outro) motion templates
  \x1b[36mcomposite\x1b[0m             Stitch final 1080p MP4 with camera dissolves, SFX & subtitles
  \x1b[36mverify\x1b[0m <film.mp4>         Run quality oracle (cadence rhythm, rest, audio, energy)
  \x1b[36mshutter\x1b[0m <comp.html>       Frame-by-frame renderer with real shutter motion blur
  \x1b[36mdemo\x1b[0m                  Run the complete flagship 3-Act showcase demo end-to-end
  \x1b[36mhelp\x1b[0m                  Display this reference manual

\x1b[1mOPTIONS:\x1b[0m
  --voice <gender/voice>   Override neural voice (e.g. AvaMultilingualNeural, AndrewMultilingualNeural)
  --output <dir>           Custom destination directory (default: ./walkthrough-output)
  --headless <bool>        Toggle headless browser execution (default: true)
  --shots <t0,t1,...>      Shot boundary times for oracle cadence verification

\x1b[1mDOCUMENTATION:\x1b[0m
  https://github.com/narain-karti/Walkthrough
`);
}

switch (command) {
  case 'help':
  case '--help':
  case '-h':
    showHelp();
    break;

  case 'demo':
    console.log('\x1b[1m\x1b[32m[Walkthrough]\x1b[0m Launching Flagship 3-Act Showcase Demo Pipeline...');
    try {
      console.log('\x1b[36m[1/5] Synthesizing Neural Voiceover...\x1b[0m');
      execSync(`${py} "${path.join(rootDir, 'engine/audio_synthesizer.py')}"`, { stdio: 'inherit', cwd: rootDir });

      console.log('\x1b[36m[2/5] Synthesizing Acoustic SFX Palette...\x1b[0m');
      execSync(`${py} "${path.join(rootDir, 'engine/sfx_palette.py')}" --demo "${path.join(rootDir, 'flagship-output/flagship_sfx.wav')}"`, { stdio: 'inherit', cwd: rootDir });

      console.log('\x1b[36m[3/5] Rendering Editorial Motion Scenes...\x1b[0m');
      execSync(`node "${path.join(rootDir, 'engine/render_scenes.js')}"`, { stdio: 'inherit', cwd: rootDir });

      console.log('\x1b[36m[4/5] Executing Browser Walkthrough...\x1b[0m');
      execSync(`node "${path.join(rootDir, 'engine/record.js')}" "${path.join(rootDir, 'showcase/storyboard.json')}"`, { stdio: 'inherit', cwd: rootDir });

      console.log('\x1b[36m[5/5] Compositing Master Video...\x1b[0m');
      execSync(`${py} "${path.join(rootDir, 'engine/compositor.py')}"`, { stdio: 'inherit', cwd: rootDir });

      console.log('\x1b[36m[Quality Oracle] Verifying output quality...\x1b[0m');
      execSync(`${py} "${path.join(rootDir, 'engine/verify.py')}" "${path.join(rootDir, 'flagship-output/flagship_showcase.mp4')}" --shots 0,8.2,14.0,18.4,24.5 --approve-visual`, { stdio: 'inherit', cwd: rootDir });

      console.log('\n\x1b[1m\x1b[32m[Walkthrough Masterpiece Ready]\x1b[0m -> ./flagship-output/flagship_showcase.mp4');
    } catch (e) {
      console.error('\x1b[31m[Walkthrough Error]\x1b[0m Pipeline failed:', e.message);
      process.exit(1);
    }
    break;

  case 'run':
  case 'record': {
    const config = args[1] || 'storyboard.json';
    console.log(`\x1b[1m\x1b[32m[Walkthrough]\x1b[0m Executing browser recording for: ${config}`);
    const proc = spawn('node', [path.resolve(__dirname, '../engine/record.js'), config], { stdio: 'inherit' });
    proc.on('exit', (code) => process.exit(code || 0));
    break;
  }

  case 'plan': {
    const config = args[1] || 'storyboard.json';
    try {
      const plan = readStoryboard(config);
      console.log(`\n[Walkthrough] ${plan.title}\n  mode: ${plan.mode}\n  steps: ${plan.steps.length}\n  output: ${plan.outputDir}`);
      for (const step of plan.steps) console.log(`  - ${step.id}: ${step.title}${step.action ? ` (${step.action})` : ''}`);
      console.log(usage());
    } catch (error) {
      console.error(`[Walkthrough] ${error.message}`);
      process.exitCode = 1;
    }
    break;
  }

  case 'audio': {
    console.log('\x1b[1m\x1b[32m[Walkthrough]\x1b[0m Synthesizing speech narration...');
    const audioProc = spawn(py, [path.resolve(__dirname, '../engine/audio_synthesizer.py')], { stdio: 'inherit' });
    audioProc.on('exit', (code) => process.exit(code || 0));
    break;
  }

  case 'sfx': {
    const extra = args.slice(1);
    const sfxArgs = extra.length ? extra : ['--demo', 'sfx.wav'];
    console.log(`\x1b[1m\x1b[32m[Walkthrough]\x1b[0m Generating synthetic sound effects...`);
    const sfxProc = spawn(py, [path.resolve(__dirname, '../engine/sfx_palette.py'), ...sfxArgs], { stdio: 'inherit' });
    sfxProc.on('exit', (code) => process.exit(code || 0));
    break;
  }

  case 'scenes': {
    console.log('\x1b[1m\x1b[32m[Walkthrough]\x1b[0m Rendering Act 1 & Act 3 editorial scenes...');
    const scenesProc = spawn('node', [path.resolve(__dirname, '../engine/render_scenes.js')], { stdio: 'inherit' });
    scenesProc.on('exit', (code) => process.exit(code || 0));
    break;
  }

  case 'composite':
  case 'render': {
    console.log('\x1b[1m\x1b[32m[Walkthrough]\x1b[0m Running master FFmpeg compositor...');
    const compProc = spawn(py, [path.resolve(__dirname, '../engine/compositor.py')], { stdio: 'inherit' });
    compProc.on('exit', (code) => process.exit(code || 0));
    break;
  }

  case 'verify': {
    const videoPath = args[1] || 'flagship-output/flagship_showcase.mp4';
    const extraArgs = args.slice(2);
    console.log(`\x1b[1m\x1b[32m[Walkthrough]\x1b[0m Running Quality Oracle on: ${videoPath}`);
    const verifyProc = spawn(py, [path.resolve(__dirname, '../engine/verify.py'), videoPath, ...extraArgs], { stdio: 'inherit' });
    verifyProc.on('exit', (code) => process.exit(code || 0));
    break;
  }

  case 'shutter': {
    const compHtml = args[1];
    if (!compHtml) {
      console.error('\x1b[31mUsage:\x1b[0m walkthrough shutter <comp.html> [options]');
      process.exit(1);
    }
    const extra = args.slice(2);
    console.log(`\x1b[1m\x1b[32m[Walkthrough]\x1b[0m Rendering with real shutter motion blur: ${compHtml}`);
    const shutProc = spawn(py, [path.resolve(__dirname, '../engine/renderer.py'), compHtml, ...extra], { stdio: 'inherit' });
    shutProc.on('exit', (code) => process.exit(code || 0));
    break;
  }

  default:
    console.log(`\x1b[31mUnknown command: ${command}\x1b[0m`);
    showHelp();
    process.exit(1);
}
