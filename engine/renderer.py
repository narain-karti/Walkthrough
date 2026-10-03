#!/usr/bin/env python3
"""
Walkthrough · engine/renderer.py
Frame-by-frame composition renderer with real shutter motion blur.

Seeks a composition at each frame time via window.__seek(t), captures screenshots,
and averages multiple sub-frame captures in linear light to produce real motion blur
(not a CSS filter — the actual integral a film camera computes).

Usage:
  python engine/renderer.py comp.html --out draft.mp4                        # 1080p30 draft
  python engine/renderer.py comp.html --out film.mp4 --final                 # 4K60 final
  python engine/renderer.py comp.html --out raw.mp4 --shutter 0             # no motion blur

MIT License · Narain Karti
"""
import argparse, asyncio, io, json, math, multiprocessing, os, shutil, subprocess, time, sys
from concurrent.futures import ProcessPoolExecutor, wait
from pathlib import Path
import numpy as np
from PIL import Image
from playwright.async_api import async_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# ── sRGB ↔ linear light LUTs ──────────────────────────────────────
_u = np.arange(256) / 255.0
SRGB_TO_LIN = np.where(_u <= 0.04045, _u / 12.92, ((_u + 0.055) / 1.055) ** 2.4).astype(np.float32)
_l = np.arange(65536) / 65535.0
LIN_TO_SRGB = np.clip(np.rint(np.where(_l <= 0.0031308, _l * 12.92, 1.055 * np.power(_l, 1/2.4) - 0.055) * 255), 0, 255).astype(np.uint8)


def decode(png):
    return np.asarray(Image.open(io.BytesIO(png)).convert("RGB"))


def cut_side(small):
    """Find which side of a discontinuity to keep when integrating.
    If one step between neighbours carries >= 3x the change of any other,
    it's a hard cut — only average the captures on the frame-time's side."""
    n = len(small)
    if n < 4:
        return list(range(n))
    d = np.array([np.abs(small[k+1] - small[k]).mean() for k in range(n-1)])
    j = int(d.argmax())
    if d[j] <= 0 or d[j] < 3 * np.delete(d, j).max():
        return list(range(n))
    return list(range(j+1, n)) if j < n // 2 else list(range(j+1))


def integrate_png(pngs):
    """Average captures in linear light, respecting cut boundaries.
    Returns (RGB array, was_cut)."""
    keep = cut_side([
        np.asarray(Image.open(io.BytesIO(p)).convert("L").reduce(8), np.int16)
        for p in pngs
    ]) if len(pngs) >= 4 else list(range(len(pngs)))

    acc = None
    for k in keep:
        lin = SRGB_TO_LIN[decode(pngs[k])]
        acc = lin if acc is None else acc + lin

    idx = np.clip(np.rint(acc * (65535.0 / len(keep))), 0, 65535).astype(np.uint16)
    return LIN_TO_SRGB[idx], len(keep) < len(pngs)


def work(job):
    """Worker process: one browser rendering every n-th frame."""
    return asyncio.run(_work(job))


async def _work(j):
    fps, dur, fr, sh = j["fps"], j["dur"], j["fr"], j["shutter"]
    st = {"captures": 0, "still": 0, "cuts": 0, "errors": [], "hist": {}}

    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await (await br.new_context(
            viewport={"width": j["width"], "height": j["height"]},
            device_scale_factor=j["scale"]
        )).new_page()
        pg.on("pageerror", lambda e: st["errors"].append(str(e)))
        await pg.goto(Path(j["comp"]).resolve().as_uri())
        await pg.evaluate("window.__ready")

        adaptive = sh > 0 and await pg.evaluate("typeof window.__motion === 'function'")
        open_s = (sh / 360.0) / fps

        async def grab(t):
            await pg.evaluate(f"window.__seek({t})")
            st["captures"] += 1
            return await pg.screenshot(type="png")

        for f in range(j["k"], j["N"], j["n"]):
            t = f / fps
            path = f"{fr}/{f:05d}.png"
            if j.get("resume") and os.path.exists(path):
                continue

            if sh <= 0:
                # No motion blur — single capture
                open(path, "wb").write(await grab(t))
                continue

            # Adaptive sample count based on __motion travel distance
            S = j["samples"]
            if adaptive:
                try:
                    far = await pg.evaluate(
                        f"window.__motion({max(t - open_s/2, 0.0)}, {min(t + open_s/2, dur - 1e-6)})"
                    )
                    S = min(j["smax"], max(j["smin"], math.ceil(far * j["scale"] / j["gap"])))
                except Exception:
                    S = j["samples"]

            # Capture at evenly-spaced times across the open shutter
            times = [min(max(t + open_s * ((k + 0.5) / S - 0.5), 0.0), dur - 1e-6) for k in range(S)]

            first = await grab(times[0])
            last = await grab(times[-1])

            if first == last:
                # Nothing moved — skip shutter integration
                open(path, "wb").write(first)
                st["still"] += 1
                continue

            pngs = [first] + [await grab(tk) for tk in times[1:-1]] + [last]
            img, cut = integrate_png(pngs)
            st["cuts"] += cut
            Image.fromarray(img).save(path, compress_level=1)
            st["hist"][S] = st["hist"].get(S, 0) + 1

        await br.close()
    return st


async def page_info(comp, width, height):
    """Read composition metadata: duration and whether __motion is defined."""
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await (await br.new_context(viewport={"width": width, "height": height})).new_page()
        await pg.goto(Path(comp).resolve().as_uri())
        await pg.evaluate("window.__ready")
        info = await pg.evaluate(
            "({dur: (window.__meta && window.__meta.dur) || null, motion: typeof window.__motion === 'function'})"
        )
        await br.close()
    return info


def main():
    ap = argparse.ArgumentParser(description="Frame-by-frame composition renderer with motion blur")
    ap.add_argument("comp", help="Path to composition HTML file")
    ap.add_argument("--out", default="draft.mp4")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--scale", type=int, default=1)
    ap.add_argument("--final", action="store_true", help="4K60: sets --fps 60 --scale 2")
    ap.add_argument("--shutter", type=float, default=180.0, help="Shutter angle in degrees (0 = no blur)")
    ap.add_argument("--samples", type=int, default=8, help="Captures per moving frame (no __motion)")
    ap.add_argument("--gap", type=float, default=24.0, help="px between captures (with __motion)")
    ap.add_argument("--samples-min", type=int, default=4)
    ap.add_argument("--samples-max", type=int, default=12)
    ap.add_argument("--workers", type=int, default=max(1, min(8, (os.cpu_count() or 3) - 2)))
    ap.add_argument("--width", type=int, default=1920)
    ap.add_argument("--height", type=int, default=1080)
    ap.add_argument("--dur", type=float, default=None)
    ap.add_argument("--sfx", default=None, help="Sound file to mux into output")
    ap.add_argument("--vo", default=None, help="Voiceover file to mux into output")
    ap.add_argument("--crf", type=int, default=16)
    ap.add_argument("--keep-frames", action="store_true")
    ap.add_argument("--resume", action="store_true")
    a = ap.parse_args()

    if a.final:
        a.fps, a.scale = 60, 2

    comp = os.path.abspath(a.comp)
    out = os.path.abspath(a.out)
    fr = os.path.join(os.path.dirname(out), "_frames")

    if not a.resume:
        shutil.rmtree(fr, ignore_errors=True)
    os.makedirs(fr, exist_ok=True)

    info = asyncio.run(page_info(comp, a.width, a.height))
    dur = a.dur or info["dur"] or 15
    N = int(round(dur * a.fps))
    nw = max(1, min(a.workers, N))

    adaptive = a.shutter > 0 and info["motion"]
    how = "no shutter" if a.shutter <= 0 else (
        f"shutter {a.shutter:g}°, captures sized by __motion (gap {a.gap:g}px, {a.samples_min}–{a.samples_max})"
        if adaptive else f"shutter {a.shutter:g}°, {a.samples} captures per moving frame"
    )

    est_s = N * 0.15 / nw  # ~150ms per capture
    print(f"[Walkthrough Renderer] {N} frames on {nw} workers · {how}")
    print(f"[Walkthrough Renderer] Estimated: ~{est_s:.0f}s ({est_s/60:.1f} min)")

    job = dict(
        comp=comp, fr=fr, fps=a.fps, dur=dur, N=N, n=nw,
        width=a.width, height=a.height, scale=a.scale, shutter=a.shutter,
        samples=max(2, a.samples), gap=a.gap,
        smin=max(2, a.samples_min), smax=max(2, a.samples_max),
        resume=a.resume,
    )

    t0 = time.time()
    with ProcessPoolExecutor(max_workers=nw, mp_context=multiprocessing.get_context("spawn")) as ex:
        futs = [ex.submit(work, dict(job, k=k)) for k in range(nw)]
        while wait(futs, timeout=15).not_done:
            done = len([f for f in os.listdir(fr) if f.endswith('.png')])
            print(f"  {done}/{N}  {time.time()-t0:.0f}s", flush=True)
        res = [f.result() for f in futs]

    secs = time.time() - t0
    captures, still, cuts = (sum(r[k] for r in res) for k in ("captures", "still", "cuts"))
    errs = [e for r in res for e in r["errors"]]
    print(f"[Walkthrough Renderer] {N} frames, {captures} captures "
          f"({still} still, {cuts} cuts) in {secs:.0f}s · errors: {errs[:3] or 'none'}")

    # Encode to H.264
    cmd = ["ffmpeg", "-v", "error", "-y", "-framerate", str(a.fps), "-i", f"{fr}/%05d.png"]
    audio = a.sfx or a.vo
    if audio:
        cmd += ["-i", os.path.abspath(audio)]
    cmd += ["-c:v", "libx264", "-preset", "medium", "-crf", str(a.crf),
            "-pix_fmt", "yuv420p", "-profile:v", "high", "-movflags", "+faststart"]
    if audio:
        cmd += ["-c:a", "aac", "-b:a", "192k", "-shortest"]
    subprocess.run(cmd + [out], check=True)

    if not a.keep_frames:
        shutil.rmtree(fr, ignore_errors=True)

    # Write render metadata
    meta = {
        "comp": comp, "fps": a.fps, "scale": a.scale,
        "size": [a.width * a.scale, a.height * a.scale],
        "shutter": a.shutter if a.shutter > 0 else 0,
        "samples": ("adaptive" if adaptive else max(2, a.samples)) if a.shutter > 0 else 1,
        "workers": nw, "frames": N, "still_frames": still,
        "cut_frames": cuts, "captures": captures,
        "seconds": round(secs, 1), "final": a.final,
    }
    json.dump(meta, open(os.path.splitext(out)[0] + ".render.json", "w"), indent=1)
    print(f"[Walkthrough Renderer] Output: {out}")


if __name__ == "__main__":
    main()
