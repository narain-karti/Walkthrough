---
name: walkthrough
description: >
  Autonomously inspects any local web repository, starts its development server,
  scripts an interactive product journey, records native 1080p 60fps screen video
  with an authentic MacBook cursor and clamped cinematic camera zooms via Playwright,
  synthesizes neural voiceover via edge-tts, burns broadcast subtitles, and delivers
  a polished product walkthrough demo video.
  Trigger: /walkthrough, "make a walkthrough video", "record product demo", "walkthrough this project", or "screen record this app".
argument-hint: "[optional: target route, focus feature, or duration]"
license: MIT
---

# Walkthrough: Autonomous Product Demo & Screen Recording Engine

> **Turn any local codebase into an elite, ScreenStudio-grade product walkthrough in one command.**

The **Walkthrough Engine** provides an autonomous end-to-end pipeline that inspects your application code, spins up the local dev server, drives a headless browser with a physics-modeled MacBook pointer, executes realistic user interactions (gliding clicks, typing, toggles), synthesizes synchronized neural voiceover, and composes an edited 1080p demo video with clamped camera zooms and broadcast-quality subtitles.

---

## Slash Command Usage

```text
/walkthrough
/walkthrough showcase real-time telemetry filters and canary deployment
/walkthrough [duration: 30s] [focus: settings and auth flow]
```

---

## Architectural Comparison: Skill vs. MCP Server

| Dimension | Agent Skill (Primary Engine) | MCP Server (OS Screen Extension) |
| :--- | :--- | :--- |
| **Execution Model** | Autonomous orchestration via CLI scripts | Long-running background daemon process |
| **Browser Control** | Native Playwright context (`recordVideo: 1080p`) | External screen grabber / desktop window capture |
| **Cursor Physics** | Injected SVG MacBook pointer with SmootherStep | OS hardware mouse capture (often coarse/fast) |
| **Camera Zooms** | In-DOM 3D transforms clamped to viewport | Post-crop digital scaling (loses vector sharpness) |
| **Portability** | Zero system daemon dependencies; pure Node + Python | Machine-dependent OS permissions & capture drivers |
| **Best Used For** | **95% of use cases**: Next.js, Vite, React, Vue, HTML, Streamlit | Desktop native apps (VSCode window, terminal GUI) |

---

## The 5-Step Autonomous Walkthrough Pipeline

```
1. Codebase Introspection
        ↓
2. Storyboard & Narration Contract (storyboard.json)
        ↓
3. Neural Voiceover & Dynamic Timing Calculation (edge-tts + ffprobe)
        ↓
4. Automated Browser Recording (Playwright + macOS Cursor + Camera Engine)
        ↓
5. Mathematical Compositing (FFmpeg Dissolves + Burned Subtitles + Hero Poster)
```

---

## Step 1: Codebase Introspection

When triggered with `/walkthrough`, the agent inspects the workspace before touching the browser:
1. **Detect Framework & Start Script**: Inspect `package.json`, `pyproject.toml`, or `Makefile`.
   - `npm run dev`, `pnpm dev`, `yarn dev`
   - `python -m uvicorn app:main --port 8000`
   - `streamlit run app.py`
2. **Identify Port & Entry URL**: Default ports: `5173` (Vite), `3000` (Next.js), `8000` (FastAPI), `8501` (Streamlit).
3. **Discover Key Interactive Elements**: Scan templates/components to identify:
   - Primary metric counters or dashboards
   - Tabs and filters (e.g. `button#tab-30d`)
   - Search inputs (e.g. `input#search`)
   - High-impact action buttons (e.g. `button#btn-deploy`)

---

## Step 2: Storyboard & Script Contract

The agent generates a structured `storyboard.json` defining the narrative:

```json
{
  "title": "Cloud Observability Platform",
  "voiceGender": "Female",
  "voice": "en-US-AvaMultilingualNeural",
  "baseUrl": "http://localhost:5173",
  "outputDir": "./walkthrough-output",
  "steps": [
    {
      "desc": "Wide shot application overview",
      "holdMs": 6000
    },
    {
      "desc": "Filter analytics by 30-day window",
      "selector": "button#tab-30d",
      "action": "click",
      "zoomOnClick": true,
      "holdMs": 5200
    },
    {
      "desc": "Search microservices",
      "selector": "input#service-search",
      "action": "type",
      "text": "analytics",
      "typeDelay": 85,
      "holdMs": 2800
    },
    {
      "desc": "Trigger deployment action",
      "selector": "button#btn-deploy",
      "action": "click",
      "holdMs": 4200
    }
  ]
}
```

---

## Step 3: Neural Voiceover & Inter-Act Timing

The agent synthesizes studio-grade neural voiceover clips using `edge-tts`:
- **Female Voice**: `en-US-AvaMultilingualNeural` (vibrant, modern, conversational)
- **Male Voice**: `en-US-AndrewMultilingualNeural` (authoritative, technical)

A clean `0.500s` silent breathing pause is placed between narrative acts. The exact audio duration of each clip is measured with `ffprobe` to compute millisecond-accurate visual transition points (`timing.json`) and synchronized `.srt` subtitles.

---

## Step 4: Playwright Screen Recording with macOS Cursor Physics

The agent launches Playwright with `cursor-overlay.js` and `camera-engine.js` injected:
- **MacBook Cursor**: Exact Apple geometry (`M5.5 3.2V...`), dual-layer drop shadows, 1.6px white stroke, and 0.88 depression factor on click.
- **SmootherStep Physics**: Ken Perlin's quintic polynomial ($6t^5 - 15t^4 + 10t^3$) with gentle quadratic Bezier arcs eliminates abrupt speed jumps.
- **Clamped Cinematic Camera**: In-DOM 3D stage transforms (`scale: 1.14x`) clamped to `[-80, 80]px` pan to ensure peripheral headers and logos are never clipped.
- **Fixed Overlay Isolation**: Floating toasts and modal dialogs are excluded from the transformed stage so they remain anchored to the true viewport.

---

## Step 5: Mathematical FFmpeg Compositing

The final video is assembled with:
1. **Inter-Act Crossfades**: `xfade=transition=fade:duration=0.35` centered precisely inside the 0.5s audio pause so visual dissolves never cut across active speech.
2. **Zero-Overlap Subtitles**: Burned-in `.srt` subtitles styled with `FontSize=16`, `MarginV=26`, and semi-transparent bounding boxes (`BorderStyle=3`) that never collide with action buttons or toast notifications.
3. **Hero Poster Frame**: Frame extracted at 3.0s as an uncompressed high-resolution JPEG poster (`walkthrough.jpg`).

---

## Deliverables Checklist

Every completed `/walkthrough` invocation produces:
1. `walkthrough_showcase.mp4`: Final 1080p 60fps MP4 (H.264, AAC 192k, faststart enabled).
2. `walkthrough_showcase.jpg`: Hero poster thumbnail.
3. `timing.json` & `flagship_subtitles.srt`: Millisecond timeline manifest and closed captions.
