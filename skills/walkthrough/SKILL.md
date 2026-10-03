---
name: walkthrough
description: >
  Autonomously inspects any local web repository, starts its development server,
  scripts an interactive product journey, records native 1080p 60fps screen video
  with a physics-modeled macOS cursor and clamped cinematic camera zooms via Playwright,
  synthesizes neural voiceover via edge-tts, generates tactile acoustic sound effects
  in an impulse reverb room, burns broadcast subtitles, and delivers a polished
  product walkthrough demo video.
  Trigger: /walkthrough, "make a walkthrough video", "record product demo",
  "walkthrough this project", or "screen record this app".
---

# Walkthrough

Autonomous, high-production product demo videos from live web applications. Walkthrough fuses
**real browser automation** (Playwright with physics-driven macOS cursor and camera), **onetake physics
and acoustic sound synthesis** (39 motion primitives, frame-by-frame shutter blur, tactile SFX in an
impulse room, quality oracle), and **brag editorial polish** (3-Act storytelling, Swiss typography,
pause-centered camera dissolves).

```
   ┌───────────────────┐     ┌─────────────────────┐     ┌───────────────────────┐
   │   ACT 1: HOOK     │ ──► │  ACT 2: WALKTHROUGH │ ──► │     ACT 3: OUTRO      │
   │ Editorial 3D Card │     │ Live App + Cursor   │     │ Receipt + Call to Act │
   └───────────────────┘     └─────────────────────┘     └───────────────────────┘
             │                          │                            │
             └─────────────────── Math xfade ────────────────────────┘
```

---

## When to use this skill

- Record a product walkthrough of a web app — **yes**.
- Create a demo video showing an interactive feature — **yes**.
- Generate an intro + walkthrough + outro video with voiceover, SFX, and subtitles — **yes**.
- Audit demo pacing, rhythm, stillness, and audio with the quality oracle — **yes**.
- Record native desktop apps, Electron, terminal-only CLIs — **no** (browser web apps only).
- Edit existing third-party footage — **no** (generates from live code and DOM).

---

## Prerequisites

The agent verifies these before running:

```bash
node --version    # >= 18
python --version  # >= 3.9
ffmpeg -version   # with libass/subtitles filter
```

Dependencies in repository:
- `npm install` (Playwright)
- `pip install -r requirements.txt` (edge-tts, numpy, scipy, Pillow)

---

## Autonomous Pipeline

### 1 · Inspect the codebase
Read `package.json`, `vite.config.*`, or `next.config.*` to locate:
- Dev server command (`npm run dev`, `npm start`, etc.)
- Target local URL (`http://localhost:5173`, `http://localhost:3000`)
- Key interactive selectors (`button#cta`, `input#search`, etc.)

### 2 · Write the Storyboard (`storyboard.json`)
```json
{
  "title": "Nexus Pulse — Observability Walkthrough",
  "baseUrl": "http://localhost:5173",
  "outputDir": "./walkthrough-output",
  "steps": [
    { "desc": "Wide overview of cluster metrics", "holdMs": 5000 },
    { "desc": "Select thirty-day window", "selector": "button#range-30d", "action": "click", "zoomOnClick": true, "holdMs": 4000 },
    { "desc": "Filter analytics workers", "selector": "input#query", "action": "type", "text": "analytics-worker", "holdMs": 3500 },
    { "desc": "Trigger canary deployment", "selector": "button#deploy", "action": "click", "zoomOnClick": true, "holdMs": 5000 }
  ]
}
```

**Rhythm rules**: Vary step hold durations by ≥ 3× (e.g. 2.5s quick actions next to 6.0s holds). Never cut on a metronome.

### 3 · Synthesize Neural Narration
```bash
python engine/audio_synthesizer.py
```
- Selects persona (`AvaMultilingualNeural` for SaaS, `AndrewMultilingualNeural` for technical infrastructure)
- Automatically inserts 500ms breathing pauses between acts
- Exports `flagship-output/timing.json` with exact millisecond timestamps and `flagship_subtitles.srt`

### 4 · Synthesize Acoustic Sound Effects (SFX)
```bash
python engine/sfx_palette.py --events flagship-output/events.json --dur 32 --out flagship-output/flagship_sfx.wav
# Or generate standalone demonstration palette:
python engine/sfx_palette.py --demo flagship-output/flagship_sfx.wav
```
- Physical materials: `wood` (clicks/keys), `air` (zooms/whooshes), `glass` (chimes/reveals), `sub` (impacts)
- Shared acoustic impulse room: 0.85s T60 stereo reverb tail keeps all sounds tactile and grounded

### 5 · Record Browser Session
```bash
node engine/record.js storyboard.json
```
- Injects `engine/cursor-overlay.js`: macOS pointer with SmootherStep glide kinematics and spring-damped tracking
- Injects `engine/camera-engine.js`: 1.14× zoom with viewport pan clamping
- Captures 1080p 60fps video via Playwright

### 6 · Render Editorial Scenes
```bash
node engine/render_scenes.js
```
- Records `templates/act1_intro.html` (Hook) and `templates/act3_outro.html` (Receipt) at native 1080p

### 7 · Master Compositing
```bash
python engine/compositor.py
```
- Mathematically centers xfade camera dissolves inside the 500ms voiceover breathing pauses
- Mixes voiceover + synthetic SFX room track
- Burns crisp subtitles with `BorderStyle=3` semi-transparent backing
- Writes web-optimized faststart MP4 and extracts hero poster at 3.0s

### 8 · Verify with Quality Oracle
```bash
python engine/verify.py flagship-output/flagship_showcase.mp4 --shots 0,8.2,14.0,18.4,24.5
```
- **cadence**: Verifies coefficient of variation across shot lengths (CV >= 0.20)
- **rest**: Confirms frame stillness (>= 25% dead-still, >= 1.0s quiet rest)
- **audio**: Confirms peak <= -3 dBFS, zero clipped samples, >= 15% quiet frames
- **energy**: Generates ASCII frame energy map

---

## CLI Reference

```bash
# Complete 3-Act showcase demo end-to-end
walkthrough demo

# Record live browser from storyboard
walkthrough run storyboard.json

# Synthesize neural voiceover
walkthrough audio

# Generate acoustic sound effects
walkthrough sfx [out.wav]

# Render Act 1 and Act 3 templates
walkthrough scenes

# Stitch final video with xfade dissolves & subtitles
walkthrough composite

# Audit video quality with oracle
walkthrough verify <video.mp4> [--shots t0,t1,...]

# Render HTML composition with 180° shutter motion blur
walkthrough shutter <comp.html> [--fps 30] [--out film.mp4]
```

---

## Motion Physics Library (`lib/motion.js` v2.0.0)

Pure functions of time available under `window.WM` (browser) and `require('./lib/motion')` (Node):

| Category | Primitives |
|----------|------------|
| **Curves** | `ease.*`, `bezier`, `tween`, `t80`, `spring`, `springVel`, `ring`, `settle`, `spline`, `rng` |
| **Entrances** | `wordRise`, `letterDrop`, `popIn`, `liftOut`, `maskRise`, `typeOn`, `tick`, `flyThrough` |
| **Carries** | `morphRect`, `iris`, `zoomThrough`, `hop`, `gather`, `ribbon`, `seal`, `staccato` |
| **Contact** | `impact`, `impactSplit`, `press`, `cursor`, `squash`, `sim.{magnet, follow, jelly, verlet}` |
| **Camera** | `camera`, `view`, `dof`, `whip`, `shake`, `drift`, `lattice`, `project`, `unproject`, `projectBox`, `screenTravel` |
| **Fluid** | `swiftSpring`, `lightField`, `ripple`, `silk`, `carouselLoop` |

---

## Hard Rules

1. **The cause must be visible**: The cursor or interaction trigger must lead every reaction on screen.
2. **Never cut on a metronome**: Vary shot durations by at least 3× so the video has natural breathing cadence.
3. **Never let the frame always be in motion**: Stillness makes the bursts land.
4. **Pause-centered dissolves**: Video cuts occur inside the 500ms voiceover breathing pauses; never cut across active speech.
5. **Shared acoustic room**: Sound effects share a unified impulse reverb environment; never use disconnected dry sine beeps.
6. **Deterministic execution**: `seek(t)` called twice always produces the identical frame.
