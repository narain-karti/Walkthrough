---
name: walkthrough
description: >
  Create a polished walkthrough, explainer, or pitch video from a live local web app.
  Use for browser-product demos that need deliberate cursor-led interaction,
  editorial pacing, and frame-reviewed output; do not use for native-desktop capture
  or generic AI-video generation. Trigger: /walkthrough, "make a walkthrough video",
  "record product demo", "walkthrough this project", or "screen record this app".
argument-hint: "[optional: mode, duration, or target URL]"
license: MIT
---

# Walkthrough

Produce a product film in which every on-screen reaction has a visible cause. The live product is the proof; design, sound, captions, and camera work must clarify that proof rather than decorate it.

## Choose the right mode

- **`walkthrough`** — a faithful product tutorial or feature demo. Most of the running time is a real browser session.
- **`explainer`** — explains a product idea or workflow. Uses the real product as proof, with short designed interstitials only where they add context.
- **`pitch`** — a concise claim → evidence → outcome/CTA film. It is not a generic slideshow or a full app tutorial.

Honor a mode named by the user. If none is named, use `walkthrough` for “show me how” requests and ask only when the choice materially changes the result. Do not use this skill for native desktop applications, third-party footage editing, or synthetic footage that pretends to be a real product capture.

## Preflight

1. Inspect the repository and find the normal local start command, target URL, brand tokens, and the smallest complete user journey. Run the app locally and check the journey in the browser before recording.
2. Record only safe, disposable data. Never autonomously trigger billing, email/SMS, deletion, production deploys, or an irreversible external side effect. Use a demo account, fixtures, or a local environment.
3. Create a v3 storyboard. Read [the storyboard reference](references/storyboard.md) before authoring or changing one. Validate it with `walkthrough plan <storyboard.json>` before recording.
4. Prefer stable semantic selectors (`data-testid`, accessible role/name, or a stable ID). A CSS class is a last resort. Each consequential action needs an observable `waitFor` outcome.

## Direct the capture

- Give the viewer one task at a time: orient → act → observe the outcome. Begin and end wide; focus only when it improves legibility.
- Move the cursor to the exact target before it reacts. Use a modest, destination-aware glide; do not let a decorative cursor wander or lag behind an interaction.
- Make zoom intentional. Keep the target, its label, and the result visible; avoid zooming every click. Return to a wide frame when context matters.
- Keep the capture truthful. Do not fake live interactions with a static UI, an AI-generated screen, or a hard-coded reaction.
- Use short, plain narration that says why the action matters. Captions must not cover the target or a visible result.

The recorder writes `events.json` alongside the raw recording. Score interaction SFX from that event stream, not from a generic demo palette. Playwright WebM capture is currently 25fps in this engine; never describe it as native 60fps. A 30/60fps delivery encode does not create temporal detail that was not captured.

## Design the non-capture scenes

For `explainer` and `pitch`, first write a one-sentence visual idea and name what carries across every scene boundary (for example: a selected filter becomes the title treatment, then resolves into the verified result). Derive design from the product: inspect its actual type scale, palette, UI shapes, terminology, and logo. Use one visual system and one primary focal point per beat. A designed scene should earn its place by establishing a problem, preserving continuity into the product, or landing a verified outcome.

Avoid fake browser chrome, stock “AI future” imagery, arbitrary glass cards, decorative gradients, random icon showers, and motion that has no semantic cause. Use a restrained transition that carries an object, color, crop, or phrase from one beat to the next. Search an existing motion treatment before hand-building a named effect. For a full rendered motion composition, follow the installed HyperFrames workflow rather than pretending browser capture is a general motion-graphics renderer.

## Review and acceptance

Inspect a contact sheet and key frames: first frame, every interaction target, every zoom apex, every scene boundary, every caption, and the final frame. Then run `walkthrough verify <film> --shots …` as a baseline check. The oracle measures only cadence, stillness, energy, and audio safety; it cannot certify story clarity, UI legibility, cursor timing, false claims, or visual taste.

Fix observable problems before delivery: flashes, dropped/duplicated source frames, cursor/UI mismatch, target-obscuring subtitles, unmotivated zooms, failed UI outcomes, clipped audio, or mismatched brand/design treatment. Deliver the master plus its storyboard, event manifest, and verification result so the video is reproducible.

## Commands

```bash
walkthrough plan walkthrough.json
walkthrough run walkthrough.json
python engine/sfx_palette.py --events walkthrough-output/events.json --dur 30 --out walkthrough-output/sfx.wav
walkthrough verify walkthrough-output/master.mp4 --shots 0,4.2,9.8,15.1
```

The flagship `demo` command is an internal example, not a template for product copy or a quality claim for another project.
