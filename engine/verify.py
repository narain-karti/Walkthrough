#!/usr/bin/env python3
"""Walkthrough delivery gate.

It combines measurable media checks with capture evidence.  It deliberately
returns NEEDS_REVIEW until an operator has inspected the generated contact
sheet; visual taste and whether a caption obscures meaning cannot be inferred
reliably from pixels alone.
"""
import argparse, json, math, os, re, shutil, subprocess, sys, tempfile
import numpy as np
from PIL import Image, ImageDraw, ImageFont

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def run(cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True)


def probe(video):
    data = json.loads(run([
        "ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
        "stream=width,height,r_frame_rate:format=duration", "-of", "json", video
    ]).stdout)
    stream = data["streams"][0]
    n, _, d = stream["r_frame_rate"].partition("/")
    fps = float(n) / float(d or 1)
    return int(stream["width"]), int(stream["height"]), max(1, round(fps)), float(data["format"]["duration"])


def extract_frames(video, tmp, width=320):
    pattern = os.path.join(tmp, "frame_%05d.png")
    run(["ffmpeg", "-v", "error", "-y", "-i", video, "-vf", f"scale={width}:-1", "-vsync", "vfr", pattern])
    return [np.asarray(Image.open(os.path.join(tmp, name)).convert("L"), dtype=np.float32)
            for name in sorted(os.listdir(tmp)) if name.startswith("frame_")]


def parse_srt(path):
    if not path or not os.path.exists(path): return []
    text = open(path, encoding="utf-8").read().replace("\r", "")
    def stamp(value):
        h, m, rest = value.replace(",", ".").split(":")
        return int(h) * 3600 + int(m) * 60 + float(rest)
    items = []
    for block in re.split(r"\n\s*\n", text.strip()):
        lines = block.split("\n")
        if len(lines) < 3 or "-->" not in lines[1]: continue
        start, end = [stamp(v.strip()) for v in lines[1].split("-->")]
        items.append({"start": start, "end": end, "text": " ".join(lines[2:]).strip()})
    return items


def contact_sheet(video, output, duration, count=12):
    tmp = tempfile.mkdtemp(prefix="walkthrough-sheet-")
    try:
        frames = []
        for index, t in enumerate(np.linspace(0, max(0, duration - 0.05), count)):
            path = os.path.join(tmp, f"{index:02d}.jpg")
            run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.3f}", "-i", video,
                 "-frames:v", "1", "-vf", "scale=400:-1", path])
            image = Image.open(path).convert("RGB")
            draw = ImageDraw.Draw(image)
            draw.rectangle((0, 0, 92, 24), fill=(0, 0, 0))
            draw.text((8, 5), f"{t:05.2f}s", fill=(255, 255, 255))
            frames.append(image)
        cell_w, cell_h = 400, max(image.height for image in frames)
        sheet = Image.new("RGB", (cell_w * 4, cell_h * math.ceil(len(frames) / 4)), "black")
        for i, image in enumerate(frames): sheet.paste(image, ((i % 4) * cell_w, (i // 4) * cell_h))
        os.makedirs(os.path.dirname(os.path.abspath(output)), exist_ok=True)
        sheet.save(output, quality=92)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def state(name, value, detail, results, fatal=False):
    results["legs"][name] = {"state": value, "detail": detail, "fatal": fatal}
    icon = {"PASS": "✓", "WARN": "⚠", "FAIL": "✗", "REVIEW": "◌"}[value]
    print(f"  {icon} {value:6} {name:16} {detail}")


def main():
    ap = argparse.ArgumentParser(description="Walkthrough delivery gate")
    ap.add_argument("video")
    ap.add_argument("--shots", help="Comma-separated shot starts in seconds")
    ap.add_argument("--events", help="Recorder events.json")
    ap.add_argument("--captions", help="SRT used in the master")
    ap.add_argument("--manifest", help="recording-manifest.json")
    ap.add_argument("--contact-sheet", help="Output JPG; defaults beside the video")
    ap.add_argument("--approve-visual", action="store_true", help="Confirm a human inspected the contact sheet and key frames")
    ap.add_argument("--json", help="Write the report to this path")
    ap.add_argument("--max-still-ratio", type=float, default=0.72)
    args = ap.parse_args()

    width, height, fps, duration = probe(args.video)
    report = {"video": args.video, "size": [width, height], "fps": fps, "duration_s": duration, "legs": {}}
    print(f"\n  {os.path.basename(args.video)} — {width}×{height}, {fps}fps, {duration:.2f}s\n")
    temp = tempfile.mkdtemp(prefix="walkthrough-review-")
    try:
        frames = extract_frames(args.video, temp)
    finally:
        shutil.rmtree(temp, ignore_errors=True)
    if len(frames) < 3: raise RuntimeError("Video has too few frames to review")
    energy = np.array([np.abs(frames[i] - frames[i - 1]).mean() for i in range(1, len(frames))])

    # A uniform near-white opening frame is a characteristic browser/new-page flash.
    opening = frames[:min(fps, len(frames))]
    white_count = sum(frame.mean() > 245 and frame.std() < 6 for frame in opening)
    state("opening_flash", "FAIL" if white_count else "PASS",
          f"{white_count}/{len(opening)} uniform white frames in first second", report, fatal=bool(white_count))

    still = energy < 0.5
    still_ratio = float(still.mean())
    longest, current = 0, 0
    for item in still:
        current = current + 1 if item else 0
        longest = max(longest, current)
    rest_state = "FAIL" if still_ratio > args.max_still_ratio else ("WARN" if still_ratio > 0.62 else "PASS")
    state("pacing", rest_state, f"still {still_ratio:.2f}; longest hold {longest / fps:.2f}s; limit {args.max_still_ratio:.2f}", report, fatal=rest_state == "FAIL")

    rows = [energy[i:i + fps * 3].mean() for i in range(0, len(energy), fps * 3) if len(energy[i:i + fps * 3])]
    variation = float(np.std(rows) / (np.mean(rows) + 1e-9))
    energy_state = "WARN" if variation < 0.22 else "PASS"
    state("energy_shape", energy_state, f"three-second variation {variation:.2f}", report)

    if args.shots:
        starts = sorted(float(item) for item in args.shots.split(","))
        lengths = np.diff(starts + [duration])
        cv = float(lengths.std() / (lengths.mean() + 1e-9))
        cadence_state = "FAIL" if cv < 0.20 else "PASS"
        state("cadence", cadence_state, f"CV {cv:.2f}; lengths {np.round(lengths, 2).tolist()}", report, fatal=cadence_state == "FAIL")

    events = json.load(open(args.events, encoding="utf-8")) if args.events and os.path.exists(args.events) else []
    by_step = {}
    for event in events: by_step.setdefault(event.get("step"), []).append(event)
    action_types = {"click", "type", "press", "select"}
    actions = [event for event in events if event.get("type") in action_types]
    cursor_failures, outcome_failures = [], []
    for action in actions:
        sequence = by_step.get(action.get("step"), [])
        arrivals = [event for event in sequence if event.get("type") == "cursor_arrive" and 0.08 <= action["time"] - event["time"] <= 2.5]
        if not arrivals: cursor_failures.append(action.get("step"))
        if not any(event.get("type") == "outcome" and event.get("passed") for event in sequence): outcome_failures.append(action.get("step"))
    if events:
        state("cursor_cause", "FAIL" if cursor_failures else "PASS", f"missing lead-in for {cursor_failures or 'none'}", report, fatal=bool(cursor_failures))
        state("ui_outcomes", "FAIL" if outcome_failures else "PASS", f"unverified actions: {outcome_failures or 'none'}", report, fatal=bool(outcome_failures))
    else:
        state("cursor_cause", "WARN", "no events file supplied", report)
        state("ui_outcomes", "WARN", "no events file supplied", report)

    captions = parse_srt(args.captions)
    caption_overlap = []
    caption_top = height * 0.925
    for action in actions:
        if not any(item["start"] <= action["time"] <= item["end"] for item in captions): continue
        box = action.get("box") or {}
        if box and box.get("y", 0) + box.get("height", box.get("h", 0)) >= caption_top:
            caption_overlap.append(action.get("step"))
    caption_state = "FAIL" if caption_overlap else "PASS"
    state("caption_safe_zone", caption_state, f"caption rail begins at y={caption_top:.0f}; overlaps {caption_overlap or 'none'}", report, fatal=bool(caption_overlap))

    if args.manifest and os.path.exists(args.manifest):
        manifest = json.load(open(args.manifest, encoding="utf-8"))
        source_fps = manifest.get("captureFps")
        state("capture_metadata", "WARN" if source_fps and source_fps < 30 else "PASS", f"source capture {source_fps or 'unknown'}fps", report)

    sheet = args.contact_sheet or os.path.splitext(args.video)[0] + ".contact.jpg"
    contact_sheet(args.video, sheet, duration)
    report["contact_sheet"] = sheet
    visual_state = "PASS" if args.approve_visual else "REVIEW"
    state("visual_review", visual_state, f"inspect {sheet}" + (" (approved)" if args.approve_visual else " then rerun with --approve-visual"), report)

    fatal = any(leg["state"] == "FAIL" and leg["fatal"] for leg in report["legs"].values())
    review = any(leg["state"] == "REVIEW" for leg in report["legs"].values())
    report["verdict"] = "FAIL" if fatal else ("NEEDS_REVIEW" if review else "PASS")
    print(f"\n  {'✗' if fatal else '◌' if review else '✓'} Verdict: {report['verdict']}\n")
    if args.json:
        with open(args.json, "w", encoding="utf-8") as output: json.dump(report, output, indent=2)
    sys.exit(1 if fatal else 2 if review else 0)


if __name__ == "__main__": main()
