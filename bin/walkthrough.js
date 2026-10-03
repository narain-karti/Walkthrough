#!/usr/bin/env node

/**
 * Walkthrough Engine CLI
 * Autonomous Codebase Walkthrough, Live Screen Recording & Demo Video Generator
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const args = process.argv.slice(2);
const command = args[0] || 'help';

function showHelp() {
  console.log(`
\x1b[1m\x1b[32mWalkthrough Engine\x1b[0m — Autonomous UI Demo & Screen Recording Suite

\x1b[1mUSAGE:\x1b[0m
  walkthrough <command> [options]

\x1b[1mCOMMANDS:\x1b[0m
  \x1b[36mrun\x1b[0m [storyboard.json]     Execute automated Playwright browser session & screen recording
  \x1b[36maudio\x1b[0m [storyboard.json]   Synthesize synchronized neural voiceover via edge-tts
  \x1b[36mrender\x1b[0m                  Assemble final 1080p 60fps MP4 with camera dissolves & subtitles
  \x1b[36mdemo\x1b[0m                    Run the complete flagship 3-Act showcase demo end-to-end
  \x1b[36mhelp\x1b[0m                    Display this reference manual

\x1b[1mOPTIONS:\x1b[0m
  --voice <gender/voice>   Override neural voice (e.g. AvaMultilingualNeural, AndrewMultilingualNeural)
  --output <dir>           Custom destination directory (default: ./walkthrough-output)
  --headless <bool>        Toggle headless browser execution (default: true)

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
      execSync('python engine/audio_synthesizer.py', { stdio: 'inherit' });
      execSync('node render_flagship_scenes.js', { stdio: 'inherit' });
      execSync('node engine/record.js', { stdio: 'inherit' });
      execSync('python engine/compositor.py', { stdio: 'inherit' });
      console.log('\x1b[1m\x1b[32m[Walkthrough]\x1b[0m Demo video generated successfully at: ./flagship-output/flagship_showcase.mp4');
    } catch (e) {
      console.error('\x1b[31m[Walkthrough Error]\x1b[0m Pipeline failed:', e.message);
      process.exit(1);
    }
    break;

  case 'run':
    const config = args[1] || 'storyboard.json';
    console.log(`\x1b[1m\x1b[32m[Walkthrough]\x1b[0m Executing browser recording for: ${config}`);
    const proc = spawn('node', [path.resolve(__dirname, '../engine/record.js'), config], { stdio: 'inherit' });
    proc.on('exit', (code) => process.exit(code || 0));
    break;

  case 'audio':
    console.log('\x1b[1m\x1b[32m[Walkthrough]\x1b[0m Synthesizing speech narration...');
    const audioProc = spawn('python', [path.resolve(__dirname, '../engine/audio_synthesizer.py')], { stdio: 'inherit' });
    audioProc.on('exit', (code) => process.exit(code || 0));
    break;

  case 'render':
    console.log('\x1b[1m\x1b[32m[Walkthrough]\x1b[0m Running master FFmpeg compositor...');
    const compProc = spawn('python', [path.resolve(__dirname, '../engine/compositor.py')], { stdio: 'inherit' });
    compProc.on('exit', (code) => process.exit(code || 0));
    break;

  default:
    console.log(`\x1b[31mUnknown command: ${command}\x1b[0m`);
    showHelp();
    process.exit(1);
}
