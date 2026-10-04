<p align="center">
  <a href="showcase/walkthrough_demo.mp4"><img src="showcase/preview.gif" alt="Walkthrough demo preview" width="760"></a>
</p>

<h1 align="center">Walkthrough</h1>

<p align="center"><strong>Direct a real web product into a clear, cursor-led video — then review the frames before you ship it.</strong></p>

Walkthrough is an agent skill and local toolkit for producing browser-product films. It is built around a simple premise: viewers should see the cause of every reaction. A real UI journey supplies the evidence; cursor choreography, camera focus, narration, captions, sound, and interstitial design make that evidence easy to follow.

> This is not a text-to-video generator. It does not use invented screens as product proof, and it does not claim a delivery frame rate is native capture quality.

## What it creates

| Mode | Best for | Shape |
| --- | --- | --- |
| `walkthrough` | Training, onboarding, release demos | Real browser journey: orient → act → observe. |
| `explainer` | Explaining a workflow or product concept | Short designed context beats connected to real product proof. |
| `pitch` | Launches and concise sales/product narratives | Claim → evidence → verified outcome/CTA. |

Every mode starts with the same live-app foundation. The last two may add motion-graphics beats, but those beats are designed from the actual brand and product rather than a generic AI aesthetic.

For an explainer or pitch, the director first writes one visual idea and one piece of continuity that survives each boundary. For example, a real selected filter can become a title treatment, then resolve into the verified result. That small rule prevents a sequence of unrelated cards from becoming a slideshow.

## Quality standard

Walkthrough treats a polished demo as more than a smooth cursor:

- **Truthful capture:** interactions run against a local, safe, observable product state.
- **Clear direction:** one user task per beat; target, label, and outcome remain legible together.
- **Purposeful motion:** cursor arrives before the action; a camera move exists only when it improves readability.
- **Product-native design:** type, colors, spacing, and language come from the product. No fake browser chrome, arbitrary glass cards, stock “AI” imagery, or decorative motion without a story job.
- **Human review:** a contact sheet and key-frame review catches flashes, timing, obscure captions, failed outcomes, and poor framing that automated metrics cannot judge.
- **Reproducibility:** the storyboard, interaction-event manifest, source recording, and verification result travel with the master.

## Quickstart

```bash
npm install
npx playwright install chromium
pip install -r requirements.txt

# Inspect a production contract before it can touch the app.
node bin/walkthrough.js plan showcase/storyboard.json

# Capture the real browser journey. This also writes events.json.
node bin/walkthrough.js run showcase/storyboard.json

# Score physical SFX from the events actually recorded.
python engine/sfx_palette.py --events walkthrough-output/events.json --dur 30 --out walkthrough-output/sfx.wav
```

The included `showcase` is a self-contained design example. It is not a source of copy, product claims, or brand style for another project.

## A storyboard is a production contract

Use stable, semantic selectors and wait for a user-visible outcome. This makes the capture resilient to timing differences and gives the viewer proof that the action worked.

```json
{
  "title": "Create a filtered saved view",
  "mode": "walkthrough",
  "baseUrl": "http://localhost:5173",
  "outputDir": "./walkthrough-output",
  "steps": [
    { "id": "orient", "title": "Show saved views", "holdMs": 1800 },
    {
      "id": "open-create",
      "title": "Open the create flow",
      "selector": "[data-testid='create-view']",
      "action": "click",
      "zoomOnClick": true,
      "waitFor": { "selector": "[role='dialog']", "state": "visible" },
      "holdMs": 2300
    },
    {
      "id": "name",
      "title": "Name the saved view",
      "selector": "[name='view-name']",
      "action": "type",
      "text": "Design review",
      "waitFor": { "selector": "[data-testid='save-view']:not([disabled])" }
    }
  ]
}
```

Supported actions are `click`, `type`, `press`, `hover`, and `select`. `holdMs` is 400–20,000ms (default: 2400). Read the full [storyboard reference](skills/walkthrough/references/storyboard.md) before creating a new plan.

## How the pipeline works

```text
inspect product → storyboard + safety check → validate → real browser capture
      → events.json → narration / event-scored SFX / designed editorial beats
      → master → contact-sheet review + automated baseline checks → deliver
```

The browser recorder injects a visible macOS-style pointer and a restrained focus camera, then records a Playwright session. Events are timestamped from the raw capture clock and saved to `events.json` for synchronized SFX. The quality oracle checks cadence, rest, audio safety, and frame-energy variation; it is a floor, not an artistic approval.

## Capture and delivery truth

Playwright’s built-in WebM recording in this implementation is **25fps**. The included flagship is a **30fps master** created from that source. Re-encoding at 60fps may satisfy a delivery specification but cannot add captured temporal information, so the project intentionally does not market it as “native 60fps.”

For lossless/true 60fps capture, use a capture backend that produces 60fps source frames, preserve its interaction metadata, then let Walkthrough handle direction, editorial assembly, and review. That is a future backend integration, not a claim this implementation makes today.

## Review before delivery

```bash
python engine/verify.py walkthrough-output/master.mp4 --shots 0,4.2,9.8,15.1
```

Review these frames yourself in addition to the oracle:

1. First frame (no browser/navigation flash)
2. Each cursor arrival and click
3. Each zoom apex and reset
4. Each visible UI result and scene boundary
5. Every caption (it must not cover the target or result)
6. Final CTA/outcome frame

Fix failed outcomes, cursor/UI mismatch, flashes, dropped/duplicated frames, target-obscuring captions, unmotivated zooms, clipped audio, and brand inconsistency before export.

## CLI

```bash
walkthrough plan <storyboard.json>              # validate a v3 plan
walkthrough run <storyboard.json>               # run capture and write events.json
walkthrough audio                               # legacy flagship narration example
walkthrough sfx [out.wav]                       # legacy sound-palette example
walkthrough scenes                              # render flagship intro/outro example
walkthrough composite                           # assemble flagship example
walkthrough verify <video.mp4> [--shots ...]    # baseline quality oracle
walkthrough demo                                # internal showcase pipeline
```

## Current boundaries and roadmap

Today the reusable, production-safe core is browser capture: storyboard validation, semantic actions, visible cursor choreography, bounded camera focus, outcome waits, interaction event export, physical SFX scoring, and automated baseline checks.

The existing flagship compositor and narration templates are still **showcase-specific**. The next high-value work is a project-configured assembly layer: narration generated from storyboard beats, caption safe zones derived from target bounds, product-derived interstitial templates, a 60fps-capable capture backend, privacy masks, and a visual QA report that flags flashes, text/caption overlap, focus/target mismatch, and stale frames. Those are real gaps, not features this README pretends are complete.

## Repository layout

```text
engine/storyboard.js          storyboard v3 validator and mode contract
engine/record.js              Playwright capture, clean H.264 take, cursor/camera, action outcomes, events.json
engine/cursor-overlay.js      visible pointer choreography
engine/camera-engine.js       bounded focus camera
engine/sfx_palette.py         event-scored sound palette
engine/verify.py              baseline cadence/rest/energy/audio checks
skills/walkthrough/           agent instructions and storyboard reference
showcase/                     contained example only
```

## License

MIT © Narain Karti
