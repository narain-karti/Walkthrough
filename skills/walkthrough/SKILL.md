---
name: walkthrough
description: >
  Autonomously inspects any local web repository, starts its development server,
  scripts an interactive product journey, records native 1080p 60fps screen video
  with a physics-modeled macOS cursor and clamped cinematic camera zooms via Playwright,
  synthesizes neural voiceover via edge-tts, burns broadcast subtitles, and delivers
  a polished product walkthrough demo video.
  Trigger: /walkthrough, "make a walkthrough video", "record product demo",
  "walkthrough this project", or "screen record this app".
---

# walkthrough

Autonomous product demo videos from live web applications. Not a screen recorder, not a
slideshow generator: a **storyboard-driven pipeline** that inspects your codebase, launches
it, drives a browser with physics-based cursor and camera, narrates it, and composites a
ScreenStudio-grade demo.

## When this skill

- Record a product walkthrough of a web app — **yes**.
- Create a demo video showing an interactive feature — **yes**.
- Generate a polished intro + walkthrough + outro video from a storyboard — **yes**.
- Record native desktop apps, Electron, terminal-only CLIs — **no** (browser only).
- Edit existing video footage — **no** (this generates from scratch).

## Prerequisites

The agent must verify these are installed before running:

```bash
node --version    # >= 18
python --version  # >= 3.9
ffmpeg -version   # with libass/subtitles filter
```

If not installed, guide the user to install them.

## Pipeline — in order

### 1 · Inspect the codebase

Read `package.json`, `vite.config.*`, `next.config.*`, or equivalent to identify:
- The dev server command (`npm run dev`, `npx vite`, etc.)
- The local URL (`http://localhost:3000`, `http://localhost:5173`, etc.)
- Key interactive elements (forms, buttons, navigation)

### 2 · Write the storyboard

Create a `storyboard.json` with steps that tell the story of the product:

```json
{
  "title": "Product Name — Feature Demo",
  "baseUrl": "http://localhost:5173",
  "outputDir": "./walkthrough-output",
  "steps": [
    { "desc": "Wide overview of landing page", "holdMs": 5000 },
    { "desc": "Click primary CTA", "selector": "button#cta", "action": "click", "zoomOnClick": true, "holdMs": 4000 },
    { "desc": "Fill in the form", "selector": "input#email", "action": "type", "text": "demo@example.com", "holdMs": 3000 }
  ]
}
```

**Rhythm rules** (from onetake): vary hold durations by ≥ 3× (2s quick cuts next to 6s holds).
Never cut on a metronome — equal shot lengths read as slides.

### 3 · Write narration script

Create narration entries in `engine/audio_synthesizer.py` FLAGSHIP_SCENES, or use edge-tts
directly. The audio synthesizer:
- Selects voice gender automatically (Ava for SaaS, Andrew for technical)
- Inserts 500ms breathing pauses between acts
- Exports `timing.json` with exact cut offsets for the compositor

### 4 · Record

```bash
node engine/record.js storyboard.json
```

This launches Playwright with:
- **Cursor overlay**: macOS pointer with SmootherStep glides and spring tracking
- **Camera engine**: 1.14× zoom with clamped pan bounds
- **1080p 60fps** via Playwright's `recordVideo`

### 5 · Composite

```bash
python engine/compositor.py
```

- Reads `timing.json` for mathematically-centered xfade offsets
- Burns subtitles with `BorderStyle=3` semi-transparent boxes
- Extracts hero poster at 3.0s
- Outputs final MP4 with `faststart` for web streaming

### 6 · Full demo pipeline

```bash
node bin/walkthrough.js demo
```

Runs steps 3→4→5 end-to-end for the flagship showcase.

## Motion library

`lib/motion.js` provides physics primitives as pure functions of time (`window.WM`):

| Category | Functions |
|----------|-----------|
| Curves | `ease.*`, `tween`, `spring`, `springVel`, `ring`, `settle` |
| Entrances | `wordRise`, `popIn`, `maskRise`, `typeOn` |
| Carries | `morphRect`, `zoomThrough`, `iris` |
| Camera | `camera`, `shake`, `drift` |
| Util | `clamp`, `lerp`, `seg`, `spline`, `rng` |

Everything is deterministic: `seek(t)` twice gives the same frame.

## Hard rules

- **The cause must be visible.** The cursor shows what triggers every reaction.
- **Never let the frame always be in motion.** Rests make the bursts land.
- **Small elements, big ground.** 70% background is the norm; full-bleed is one calm hold.
- **Pause-centered dissolves.** Video cuts never interrupt active speech.
- **Moves from the library, curves chosen by t80.** No hand-rolled easing constants.
- **Drafts at 1080p30.** No 4K render before the cut is accepted.

## Files

| Path | Purpose |
|------|---------|
| `bin/walkthrough.js` | CLI entry point |
| `engine/record.js` | Playwright recorder with cursor + camera |
| `engine/cursor-overlay.js` | macOS cursor with spring physics |
| `engine/camera-engine.js` | Keyed camera with clamped zoom |
| `engine/audio_synthesizer.py` | edge-tts voiceover + timing manifest |
| `engine/compositor.py` | FFmpeg xfade compositor + subtitles |
| `lib/motion.js` | Physics motion primitives |
| `templates/act1_intro.html` | Intro composition template |
| `templates/act3_outro.html` | Outro composition template |

## Requires

- `playwright` (npm) — browser automation
- `edge-tts` (pip) — neural voiceover
- `ffmpeg` / `ffprobe` — video compositing
