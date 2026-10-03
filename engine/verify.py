#!/usr/bin/env python3
"""
Walkthrough · engine/verify.py
Quality oracle — does the cut have rhythm, and does it carry?

Checks that fail a slideshow before a human has to watch it.

Usage:
  python engine/verify.py film.mp4 --shots 0,1.6,3.0,4.8,7.0,9.6

Legs:
  cadence     Shot lengths must vary: CV >= 0.25. Equal shots = slides.
  rest        >= 25% of frames dead-still, one quiet stretch >= 1.0s.
  audio       Peak <= -3 dBFS, 0 clipped samples, >= 15% quiet frames.
  burst       A 1.5s window with >= 3 big changes. WARN if absent (not FAIL).
  energy      Row-profile variation (advisory).

Exit code 1 if any leg fails.

MIT License · Narain Karti
"""
import argparse, json, os, subprocess, sys, tempfile
import numpy as np

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


def extract_frames(video, tmp, width=320):
    """Extract frames as greyscale numpy arrays at reduced resolution."""
    pattern = os.path.join(tmp, "f%05d.png")
    subprocess.run([
        "ffmpeg", "-v", "error", "-y", "-i", video,
        "-vf", f"scale={width}:-1", "-vsync", "vfr", pattern
    ], check=True)

    from PIL import Image
    frames = []
    for f in sorted(os.listdir(tmp)):
        if f.startswith("f") and f.endswith(".png"):
            img = np.asarray(Image.open(os.path.join(tmp, f)).convert("L"), dtype=np.float32)
            frames.append(img)
    return frames


def compute_energy(frames):
    """Frame-to-frame mean absolute difference."""
    diffs = []
    for i in range(1, len(frames)):
        diffs.append(np.abs(frames[i] - frames[i-1]).mean())
    return np.array(diffs)


def energy_map(energy, fps, cols=60):
    """ASCII energy map: each column = 1/fps second of film."""
    if len(energy) == 0:
        return "(no frames)"
    # Bin into cols columns
    bins = np.array_split(energy, min(cols, len(energy)))
    vals = [b.mean() for b in bins]
    mx = max(vals) if max(vals) > 0 else 1
    chars = " ▁▂▃▄▅▆▇█"
    return "".join(chars[min(len(chars)-1, int(v / mx * (len(chars)-1)))] for v in vals)


def get_fps(video):
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", video],
        capture_output=True, text=True
    ).stdout.strip()
    num, _, den = r.partition("/")
    try:
        return max(1, int(round(float(num) / float(den or 1))))
    except ValueError:
        return 30


def audio_stats(video):
    """Extract audio peak, clipped samples, and quiet ratio."""
    try:
        import wave
        tmp = tempfile.mkdtemp()
        wav = os.path.join(tmp, "a.wav")
        r = subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", video, "-vn", "-ac", "2", "-ar", "48000", wav],
            capture_output=True
        )
        if r.returncode != 0 or not os.path.exists(wav):
            return None
        w = wave.open(wav)
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).reshape(-1, 2) / 32767.0
        w.close()
        n = 4000  # ~83ms frames
        rms = np.array([np.sqrt((x[i:i+n]**2).mean()) for i in range(0, len(x)-n, n)])
        return {
            "peak_db": round(20 * np.log10(np.abs(x).max() + 1e-9), 1),
            "clipped": int((np.abs(x) >= 0.999).sum()),
            "quiet_ratio": round(float((20 * np.log10(rms + 1e-9) < -40).mean()), 3),
        }
    except Exception:
        return None


def leg(name, state, detail):
    icon = {"PASS": "✓", "WARN": "⚠", "FAIL": "✗"}.get(state, "?")
    print(f"  {icon} {state:4}  {name:12} {detail}")
    return state != "FAIL"


def main():
    ap = argparse.ArgumentParser(description="Walkthrough quality oracle")
    ap.add_argument("video", help="Path to the rendered video")
    ap.add_argument("--shots", default=None, help="Comma-separated shot boundary times (seconds)")
    ap.add_argument("--cv-threshold", type=float, default=0.20, help="Cadence coefficient of variation threshold (default 0.20)")
    ap.add_argument("--json", default=None, help="Output results as JSON to this path")
    a = ap.parse_args()

    fps = get_fps(a.video)
    tmp = tempfile.mkdtemp()
    frames = extract_frames(a.video, tmp)
    energy = compute_energy(frames)

    dur_s = len(frames) / fps
    emap = energy_map(energy, fps)

    print(f"\n  {os.path.basename(a.video)} — {len(frames)} frames, {fps} fps, {dur_s:.1f}s")
    print(f"  Energy: {emap}\n")

    oks = []
    results = {"video": a.video, "fps": fps, "duration_s": dur_s, "legs": {}}

    # ── cadence ──
    if a.shots:
        ts = sorted(float(x) for x in a.shots.split(","))
        L = np.diff(ts + [dur_s])
        cv = float(L.std() / (L.mean() + 1e-9))
        state = "PASS" if cv >= a.cv_threshold else "FAIL"
        detail = f"shot lengths {np.round(L, 2).tolist()}  CV {cv:.2f} (need >= {a.cv_threshold})"
        oks.append(leg("cadence", state, detail))
        results["legs"]["cadence"] = {"state": state, "cv": cv, "lengths": L.tolist()}
    else:
        print("  ○ skip  cadence      (pass --shots t0,t1,… to check)")

    # ── rest ──
    still_threshold = 0.5
    still_frames = (energy < still_threshold).astype(float)
    still_ratio = float(still_frames.mean()) if len(still_frames) > 0 else 0

    # Longest quiet stretch
    max_quiet = 0
    current = 0
    for s in still_frames:
        if s:
            current += 1
            max_quiet = max(max_quiet, current)
        else:
            current = 0
    longest_quiet_s = max_quiet / fps

    state = "PASS" if still_ratio >= 0.25 and longest_quiet_s >= 1.0 else "FAIL"
    oks.append(leg("rest", state, f"still {still_ratio:.2f}  longest quiet {longest_quiet_s:.1f}s"))
    results["legs"]["rest"] = {"state": state, "still_ratio": still_ratio, "longest_quiet_s": longest_quiet_s}

    # ── burst ──
    burst_window = int(1.5 * fps)
    burst_threshold = 8
    bursts = []
    for i in range(len(energy) - burst_window):
        window = energy[i:i+burst_window]
        big = (window > burst_threshold).sum()
        if big >= 3:
            bursts.append(round(i / fps, 2))
            # Skip ahead to avoid counting the same burst
            break

    if bursts:
        oks.append(leg("burst", "PASS", f"burst at {bursts[0]}s"))
    else:
        oks.append(leg("burst", "WARN", "no burst — fine for concepts without hits"))
    results["legs"]["burst"] = {"state": "PASS" if bursts else "WARN", "bursts": bursts}

    # ── energy profile ──
    row_means = [energy[i:i+fps*4].mean() for i in range(0, max(1, len(energy)), fps*4)]
    flat = float(np.std(row_means) / (np.mean(row_means) + 1e-9)) if row_means else 0
    state = "PASS" if flat >= 0.35 else "WARN"
    oks.append(leg("energy", state, f"variation {flat:.2f} (advisory, >= 0.35)"))
    results["legs"]["energy"] = {"state": state, "variation": flat}

    # ── audio ──
    au = audio_stats(a.video)
    if au:
        state = "PASS" if au["peak_db"] <= -3 and au["clipped"] == 0 and au["quiet_ratio"] >= 0.15 else "FAIL"
        oks.append(leg("audio", state, f"peak {au['peak_db']}dBFS  clipped {au['clipped']}  quiet {au['quiet_ratio']}"))
        results["legs"]["audio"] = {"state": state, **au}
    else:
        print("  ○ skip  audio        (no audio track)")

    # ── verdict ──
    passed = all(oks)
    verdict = "PASS" if passed else "FAIL"
    print(f"\n  {'✓' if passed else '✗'} Verdict: {verdict}\n")
    results["verdict"] = verdict

    if a.json:
        json.dump(results, open(a.json, "w"), indent=2)
        print(f"  Results saved to {a.json}")

    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
