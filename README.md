# Walkthrough 🎬

> **Autonomous Codebase Walkthrough, Live Screen Recording & Demo Video Generator**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-%3E%3D3.9-blue.svg)](https://python.org/)
[![Playwright](https://img.shields.io/badge/Playwright-Automated%20Browser-45ba4b.svg)](https://playwright.dev/)
[![FFmpeg](https://img.shields.io/badge/FFmpeg-60fps%201080p-red.svg)](https://ffmpeg.org/)

Turn any local web codebase into a ScreenStudio-grade product walkthrough in one command. **Walkthrough** inspects your application code, spins up your local development server, drives an automated browser with an authentic Apple macOS mouse pointer, records 1080p 60fps screen video, synthesizes studio-grade neural voiceover, and composes an edited showcase video with clamped camera zooms and broadcast subtitles.

---

## 🌟 Key Innovations

### 1. Authentic MacBook Cursor Physics
Generic automated cursors move in rigid straight lines with sudden speed jumps. **Walkthrough** implements:
* **Ken Perlin's SmootherStep ($6t^5 - 15t^4 + 10t^3$)**: Guarantees zero initial and zero final acceleration/velocity for natural hand motion.
* **Apple macOS Cursor Geometry**: Pixel-matched vector SVG (`M5.5 3.2V...`), 1.6px stroke, and dual-layer Gaussian drop shadows.
* **Depressed Click & Lime Ripple Feedback**: Cursor physically depresses to scale `0.88` upon clicking while emitting an expanding radial ripple.
* **Live Camera Tracking**: Automatically tracks and anchors to moving UI elements even while the camera is actively zooming.

### 2. Clamped Cinematic Camera Engine
* **In-DOM 3D Viewport Transform**: Scales the live DOM to `1.14x` so vectors, fonts, and charts remain pin-sharp at native 1080p.
* **Clamped Pan Bounds**: Restricts translation to `[-80, 80]px` on X and `[-100, 100]px` on Y so global navigation bars, headers, and logos are never cut off.
* **Spotlight Vignette**: Automatically darkens background peripheral elements by 30% to direct focus toward the active form, table, or button.
* **Fixed Overlay Isolation**: Floating toast notifications, modal dialogs, and alerts remain anchored to the viewport rather than trapped inside transformed containers.

### 3. Neural Voiceover with Smart Gender Selection
* **Autonomous Gender Selection**: Selects between `en-US-AvaMultilingualNeural` (vibrant, conversational SaaS cadence) and `en-US-AndrewMultilingualNeural` (deep technical authority).
* **Inter-Act Breathing Pauses**: Automatically inserts calibrated `0.500s` pauses between narrative acts.
* **Millisecond ffprobe Measurement**: Analyzes audio durations dynamically to schedule video crossfade transitions.

### 4. Mathematical FFmpeg Compositor & Subtitles
* **Pause-Centered Crossfades**: Visual dissolves (`xfade=duration=0.35`) occur *strictly* inside audio pauses so video cuts never interrupt active speech.
* **Zero-Overlap Broadcast Subtitles**: Subtitles are formatted with `MarginV=26` and semi-transparent bounding boxes (`BorderStyle=3`), ensuring text never collides with UI buttons or toast notifications.
* **Hero Poster Frame**: Automatically extracts an uncompressed poster image at 3.0s for social sharing and launch posts.

---

## 🏗️ Architecture: Agent Skill vs. MCP Server

| Dimension | Agent Skill (Primary Engine) | MCP Server (OS Extension) |
| :--- | :--- | :--- |
| **Execution Model** | Autonomous orchestration via CLI scripts | Long-running background daemon process |
| **Browser Control** | Native Playwright context (`recordVideo: 1080p`) | External OS screen grabber |
| **Cursor Physics** | Injected SVG MacBook pointer with SmootherStep | OS hardware mouse capture (often coarse/fast) |
| **Camera Zooms** | In-DOM 3D transforms clamped to viewport | Post-crop digital scaling (loses vector sharpness) |
| **Portability** | Zero system daemon dependencies; pure Node + Python | Machine-dependent OS permissions & capture drivers |
| **Recommended For** | **95% of use cases**: Next.js, Vite, React, Vue, HTML, Streamlit | Desktop native apps (VSCode window, terminal GUI) |

---

## 🚀 Quickstart & Setup

### 1. Prerequisites
Ensure you have the following installed on your machine:
* **Node.js** >= 18 ([nodejs.org](https://nodejs.org/))
* **Python** >= 3.9 ([python.org](https://python.org/))
* **FFmpeg** with `libass` and `subtitles` filter ([ffmpeg.org](https://ffmpeg.org/))

### 2. Installation Commands

```bash
# Clone repository
git clone https://github.com/narain-karti/Walkthrough.git
cd Walkthrough

# Install Node dependencies (Playwright)
npm install

# Install Playwright browser binaries
npx playwright install msedge
# or: npx playwright install chromium

# Install Python dependencies (edge-tts)
pip install -r requirements.txt
```

### 3. Run the Flagship Showcase Demo

Run the complete 3-Act end-to-end showcase:
```bash
npm run demo
# or
node bin/walkthrough.js demo
```

This will:
1. Synthesize neural narration clips using `edge-tts`
2. Render Act 1 (3D browser card dive) and Act 3 (macOS terminal receipt)
3. Launch Playwright and record Act 2 (interactive live dashboard) with the macOS cursor and camera engine
4. Composite the master video with seamless dissolves and subtitles
5. Output `flagship-output/flagship_showcase.mp4` and `flagship_showcase.jpg`

---

## 🛠️ CLI Reference

```bash
# Display CLI reference manual
node bin/walkthrough.js help

# Record a custom storyboard
node bin/walkthrough.js run path/to/storyboard.json

# Synthesize speech narration
node bin/walkthrough.js audio

# Render final composited MP4
node bin/walkthrough.js render
```

---

## 📋 Storyboard Schema (`storyboard.json`)

```json
{
  "title": "Cloud Observability Platform",
  "voiceGender": "Female",
  "voice": "en-US-AvaMultilingualNeural",
  "baseUrl": "http://localhost:5173",
  "outputDir": "./walkthrough-output",
  "steps": [
    {
      "desc": "Scene 1: Initial wide overview",
      "holdMs": 6000
    },
    {
      "desc": "Scene 2: Switch to 30-Day metrics window",
      "selector": "button#tab-30d",
      "action": "click",
      "zoomOnClick": true,
      "holdMs": 5200
    },
    {
      "desc": "Scene 3: Search microservices",
      "selector": "input#service-search",
      "action": "type",
      "text": "analytics",
      "typeDelay": 85,
      "zoomOnClick": true,
      "holdMs": 2800
    },
    {
      "desc": "Scene 4: Trigger canary deploy and observe toast",
      "selector": "button#btn-deploy",
      "action": "click",
      "zoomOnClick": true,
      "holdMs": 4200
    }
  ]
}
```

---

## 🤖 Antigravity / Claude Skill Integration

**Walkthrough** is packaged as an autonomous agent skill. To use it with Google Antigravity or Claude:
1. Copy `skills/walkthrough/` to your agent config directory (e.g. `~/.gemini/config/skills/walkthrough/`).
2. Invoke with `/walkthrough` in any web repository:
   ```text
   /walkthrough
   /walkthrough showcase telemetry filters and canary deployment
   /walkthrough [duration: 45s] [focus: user onboarding]
   ```

---

## 📂 Project Structure

```
Walkthrough/
├── bin/
│   └── walkthrough.js          # CLI executable
├── engine/
│   ├── cursor-overlay.js       # ScreenStudio-grade macOS cursor & physics
│   ├── camera-engine.js        # Clamped cinematic camera with 1.14x zoom
│   ├── record.js               # Playwright automation harness
│   ├── audio_synthesizer.py    # Edge-TTS speech generator & timing manifest
│   └── compositor.py           # FFmpeg master xfade compositor & subtitle burn-in
├── templates/
│   ├── act1_intro.html         # 3D tilted browser dive template
│   └── act3_outro.html         # macOS terminal install receipt template
├── demo/
│   └── index.html              # Nexus Pulse Cloud Observability App
├── showcase/
│   ├── hero_poster.jpg         # 1080p flagship poster frame
│   └── storyboard.json         # Showcase storyboard configuration
├── skills/
│   └── walkthrough/
│       └── SKILL.md            # Agent skill definition
├── package.json
├── requirements.txt
├── LICENSE
└── README.md
```

---

## 📄 License

MIT License. Designed and developed by Narain Karti.
