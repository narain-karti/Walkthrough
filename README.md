<p align="center">
  <img src="showcase/poster.jpg" alt="Walkthrough — autonomous product demo videos" width="720">
</p>

<h1 align="center">Walkthrough</h1>

<p align="center">
  <strong>Turn any web codebase into a ScreenStudio-grade product demo — in one command.</strong><br>
  Autonomous codebase introspection · Live Playwright recording · Physics-based cursor & camera · Neural voiceover · Beat-synced subtitles
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/Node.js-≥18-green.svg" alt="Node.js ≥18">
  <img src="https://img.shields.io/badge/Python-≥3.9-blue.svg" alt="Python ≥3.9">
  <img src="https://img.shields.io/badge/1080p-60fps-red.svg" alt="1080p 60fps">
</p>

---

## What it does

**Walkthrough** inspects your web project, launches the dev server, drives an automated browser with a physics-modeled macOS cursor, records cinematic 1080p video with clamped camera zooms, synthesizes neural voiceover, and composites a polished demo with dissolves and subtitles — all autonomously.

> **Demo video**: [`showcase/walkthrough_demo.mp4`](showcase/walkthrough_demo.mp4)

---

## ✨ Key Features

### Physics-based macOS Cursor
- **Perlin SmootherStep** glide paths ($6t^5 - 15t^4 + 10t^3$) — zero jerk at start and arrival
- **Apple pointer geometry** — pixel-matched SVG with dual Gaussian shadows
- **Spring-damped tracking** (ζ=0.8, ω=18) — cursor follows elements during camera zoom
- **Click feedback** — 0.88× physical depress + expanding radial ripple

### Cinematic Camera Engine
- **Clamped pan** — `[-80, 80]px` X, `[-100, 100]px` Y — headers and logos never clipped
- **Keyed camera paths** — onetake-style per-leg curve interpolation for frame-by-frame rendering
- **Spotlight vignette** — 30% peripheral darkening to direct focus
- **Fixed overlay isolation** — toasts and modals stay viewport-anchored outside the transform

### Motion Library (`lib/motion.js`)
Pure functions of time — inspired by [onetake](https://github.com/feitangyuan/onetake)'s `f(t)` architecture:
- **Curves**: smoothstep, smootherstep, expo, spring, ring, settle
- **Entrances**: wordRise, popIn, maskRise, typeOn
- **Carries**: morphRect, zoomThrough, iris — section boundaries where something *survives*
- **Camera**: keyed camera, shake, drift
- Everything deterministic: `seek(t)` twice gives the same frame

### Neural Voiceover
- **Smart gender selection** — Ava (conversational SaaS) or Andrew (technical authority) via `edge-tts`
- **Inter-act breathing pauses** — calibrated 500ms silence between narrative sections
- **Pause-centered dissolves** — visual crossfades occur strictly inside audio pauses

### FFmpeg Compositor
- **Mathematically timed xfade** — dissolves centered in silence gaps, never interrupting speech
- **Broadcast subtitles** — `BorderStyle=3` with semi-transparent boxes, `MarginV=26`
- **Hero poster extraction** — uncompressed frame at 3.0s for social sharing

---

## 🚀 Quickstart

### Prerequisites
- **Node.js** ≥ 18
- **Python** ≥ 3.9
- **FFmpeg** with `libass` / `subtitles` filter

### Install

```bash
git clone https://github.com/narain-karti/Walkthrough.git
cd Walkthrough
npm install
npx playwright install chromium    # or: npx playwright install msedge
pip install -r requirements.txt
```

### Run the demo

```bash
npm run demo
```

This runs the full pipeline:
1. Synthesizes neural voiceover via `edge-tts`
2. Records the demo app with cursor physics and camera zooms
3. Composites the master video with dissolves and subtitles
4. Outputs `flagship-output/flagship_showcase.mp4`

---

## 📋 Storyboard Schema

Create a `storyboard.json` to drive any web app:

```json
{
  "title": "My Product Demo",
  "baseUrl": "http://localhost:5173",
  "outputDir": "./walkthrough-output",
  "steps": [
    {
      "desc": "Wide overview",
      "holdMs": 5000
    },
    {
      "desc": "Click the signup button",
      "selector": "button#signup",
      "action": "click",
      "zoomOnClick": true,
      "holdMs": 4000
    },
    {
      "desc": "Type email",
      "selector": "input#email",
      "action": "type",
      "text": "hello@example.com",
      "typeDelay": 80,
      "holdMs": 3000
    }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `selector` | CSS selector | Target element for cursor interaction |
| `action` | `click` \| `type` | Interaction type |
| `text` | string | Text to type (when `action: "type"`) |
| `typeDelay` | ms | Delay between keystrokes (default: 85) |
| `zoomOnClick` | boolean | Enable 1.14× camera zoom on interaction |
| `holdMs` | ms | How long to hold on this scene |

---

## 🛠 CLI

```bash
node bin/walkthrough.js demo             # Run flagship 3-act showcase
node bin/walkthrough.js run story.json   # Record custom storyboard
node bin/walkthrough.js audio            # Synthesize voiceover only
node bin/walkthrough.js render           # Composite final MP4 only
node bin/walkthrough.js help             # Show CLI reference
```

---

## 🤖 Agent Skill

Walkthrough ships as an autonomous [Antigravity](https://github.com/google-deepmind/antigravity) / Claude skill. Install it globally:

```bash
# Copy to your agent config
cp -r skills/walkthrough/ ~/.gemini/config/skills/walkthrough/
```

Then invoke in any web project:
```
/walkthrough
/walkthrough showcase the onboarding flow
/walkthrough [duration: 45s] [focus: checkout page]
```

---

## 📂 Structure

```
Walkthrough/
├── bin/walkthrough.js              # CLI entry point
├── engine/
│   ├── record.js                   # Playwright browser automation
│   ├── cursor-overlay.js           # macOS cursor with spring physics
│   ├── camera-engine.js            # Keyed camera with clamped zoom
│   ├── audio_synthesizer.py        # edge-tts voiceover + timing manifest
│   └── compositor.py               # FFmpeg xfade compositor + subtitles
├── lib/
│   └── motion.js                   # Physics motion primitives (f(t))
├── templates/
│   ├── act1_intro.html             # 3D browser card intro composition
│   └── act3_outro.html             # Terminal receipt outro composition
├── demo/
│   └── index.html                  # Nexus Pulse demo app
├── showcase/
│   ├── walkthrough_demo.mp4        # Output demo video
│   ├── poster.jpg                  # Hero poster frame
│   └── storyboard.json             # Showcase storyboard config
├── skills/walkthrough/SKILL.md     # Agent skill definition
├── package.json
├── requirements.txt
└── LICENSE
```

---

## How it works

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Storyboard  │───▶│   Playwright  │───▶│  edge-tts    │───▶│   FFmpeg     │
│  (JSON)      │    │  + Cursor     │    │  Voiceover   │    │  Compositor  │
│              │    │  + Camera     │    │  + Timing     │    │  + Subtitles │
└─────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                          │                    │                    │
                     raw .webm            .mp3 + .srt         final .mp4
                                          timing.json         + poster.jpg
```

The motion library (`lib/motion.js`) provides physics primitives used across the pipeline:
- **Cursor** uses `smootherstep` for glide paths and `spring` for element tracking
- **Camera** uses `cubicInOut` for smooth zoom transitions
- **Templates** use `wordRise`, `popIn`, `morphRect` for intro/outro compositions

---

## Credits

- Motion architecture inspired by [onetake](https://github.com/feitangyuan/onetake) by Patrick
- Neural voices via [edge-tts](https://github.com/rany2/edge-tts)
- Browser automation via [Playwright](https://playwright.dev)

## License

MIT — Narain Karti
