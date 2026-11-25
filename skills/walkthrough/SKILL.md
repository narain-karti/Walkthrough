---
name: walkthrough
description: >
  Create a polished, narrated 1080p product demo video from any live web app —
  one storyboard, one command. Physics cursor, clamped camera zoom, edge-tts
  voiceover, FFmpeg compositing. Works in any AI coding agent (Antigravity,
  Claude Code, Cursor, Codex) or standalone CLI.
argument-hint: "[storyboard.json | URL | description of what to demo]"
license: MIT
---

# Walkthrough — AI Agent Skill

Generate production-quality narrated product demo videos from any web application,
driven by a declarative JSON storyboard.

## When to Use This Skill

- User says: `/walkthrough`, `"make a walkthrough video"`, `"record product demo"`,
  `"demo this project"`, `"create a product video"`, or `"screen record this app"`.
- An AI coding agent just built or modified a web app and needs a launch demo.
- A PR needs a visual walkthrough of UI changes.

## Prerequisites

Before first use, verify these are installed (run once):

```bash
node --version    # >= 18 required
python --version  # >= 3.9 required
ffmpeg -version   # must include libass (ass filter)
```

Then install the Walkthrough engine:

```bash
git clone https://github.com/narain-karti/Walkthrough.git ~/.walkthrough
cd ~/.walkthrough && npm install && npx playwright install chromium && pip install -r requirements.txt
```

> **Tip:** If you already have the repo cloned elsewhere, just ensure `npm install`,
> `npx playwright install chromium`, and `pip install -r requirements.txt` have been run.

## Workflow

### 1. Inspect the Target App

Find the app's start command, URL, and key user journey. Launch it locally and
verify it loads in a browser before recording.

### 2. Write a Storyboard

Create a `storyboard.json` with stable selectors (`#id`, `[data-testid=...]`,
`button:has-text("...")`) and per-step `narration`:

```json
{
  "title": "My App Demo",
  "baseUrl": "http://localhost:5173",
  "outputDir": "./walkthrough-output",
  "voice": "female",
  "steps": [
    {
      "desc": "Show the dashboard",
      "narration": "Here is the live dashboard with real-time metrics.",
      "holdMs": 3000
    },
    {
      "desc": "Click the analytics tab",
      "selector": "button#analytics",
      "action": "click",
      "zoom": 1.14,
      "narration": "Switching to analytics reveals detailed performance breakdowns."
    },
    {
      "desc": "Search for a record",
      "selector": "input#search",
      "action": "type",
      "text": "revenue",
      "typeDelay": 80,
      "zoom": 1.14,
      "narration": "Search filters results instantly as you type."
    }
  ]
}
```

### 3. Build the Video

```bash
node ~/.walkthrough/bin/walkthrough.js build storyboard.json
```

This runs the full pipeline: `audio` → `run` → `render`. Output lands in `outputDir`:
- `walkthrough.mp4` — final 1080p narrated video
- `walkthrough.jpg` — poster frame for social sharing
- `voiceover.mp3` — synthesized narration track
- `subtitles.ass` — 1080p-calibrated captions

### 4. Review the Output

Extract and inspect key frames before delivering:

```bash
ffmpeg -ss 3.0 -i walkthrough-output/walkthrough.mp4 -frames:v 1 frame_check.jpg
```

Verify:
- Cursor lands on the correct target before each interaction
- Zoom frames show no black edge gaps and don't clip important header/nav UI
- Subtitles are readable and don't obscure the action
- Voiceover timing matches the visual actions

## Storyboard Reference

### Root Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `title` | string | `"Untitled"` | Video title (logged during recording) |
| `baseUrl` | string | — | Target URL (`http://...`) or relative HTML path |
| `outputDir` | string | `./walkthrough-output` | Where output files are written |
| `outputName` | string | `"walkthrough"` | Base name for `.mp4` and `.jpg` |
| `voice` | string | `"female"` | `edge-tts` voice: `"female"`, `"male"`, or a full voice name |
| `cursorStart` | `[x, y]` | `[960, 1120]` | Initial cursor position in pixels |
| `intro` | object | — | `{ "template": "path.html", "narration": "..." }` |
| `outro` | object | — | `{ "template": "path.html", "narration": "..." }` |

### Step Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `desc` | string | — | Human-readable step description (logged) |
| `selector` | CSS sel | — | Target element for cursor + action |
| `action` | string | — | `"click"`, `"type"`, or `"hover"` |
| `text` | string | — | Text to type (when `action: "type"`) |
| `typeDelay` | ms | `80` | Delay between keystrokes |
| `zoom` | number | — | Camera zoom scale (e.g. `1.14`) |
| `zoomOnClick` | bool | `false` | Shorthand for `zoom: 1.14` |
| `highlight` | bool | `true` | Show green glow ring on zoomed target |
| `narration` | string | — | Spoken line → voiceover + subtitle |
| `holdMs` | ms | auto | Hold time (auto-computed from narration length if omitted) |
| `cursorOffset` | `[dx,dy]` | `[0,0]` | Pixel offset from element center |
| `glideMs` | ms | `850` | Cursor glide animation duration |
| `waitFor` | CSS sel | — | Wait for this selector before proceeding |
| `scrollIntoView` | bool | `true` | Auto-scroll target into viewport |

## CLI Options

```
--voice <name|male|female>   Override TTS voice
--output <dir>               Override output directory
--url <baseUrl>              Override storyboard baseUrl
--browser <chromium|msedge|chrome>  Browser channel
--headless <true|false>      Headless mode (default: true)
--sub-pos <bottom|top>       Subtitle placement
--no-subtitles               Omit burned-in subtitles
--fps <30|60>                Output frame rate
```

## Safety

- Never trigger billing, email/SMS, deletion, or production deploys autonomously.
- Use demo accounts, test fixtures, or local environments.
- Record only safe, disposable data.

## Troubleshooting

| Issue | Fix |
|---|---|
| `Cannot find module 'playwright'` | Run `cd ~/.walkthrough && npm install` |
| `No usable Chromium/Edge/Chrome` | Run `npx playwright install chromium` |
| `edge_tts` not found | Run `pip install edge-tts` |
| `ass` filter not found in FFmpeg | Install FFmpeg build with `libass` support |
| Black edges during zoom | Reduce `zoom` value (e.g. `1.10` instead of `1.14`) |
| Subtitles cover UI | Use `--sub-pos top` or `--no-subtitles` |
