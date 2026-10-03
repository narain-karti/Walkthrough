#!/usr/bin/env python3
"""
Walkthrough · engine/sfx_palette.py
Physical acoustic sound effects engine sharing a single impulse reverb room.

Synthesizes tactile audio for browser UI interactions and video transitions:
- air: camera zooms, card sweeps, whooshes
- wood: mouse clicks, keystrokes, trackpad taps
- glass: feature reveals, badges, chimes
- sub: scene transitions, hero drops, impact landings
- bubble: toggle switches, filter pills, popups
- wobble: elastic bounces and jelly springs

Usage:
    # Generate demo palette
    python engine/sfx_palette.py --demo sfx_demo.wav

    # Score from recorded events
    python engine/sfx_palette.py --events events.json --dur 30 --out sfx.wav
"""
import os
import sys
import json
import wave
import argparse
import numpy as np
from scipy import signal

SR = 48000
_rng = np.random.default_rng(42)

def _t(n):
    return np.arange(n) / SR

def bp(x, f, q=1.0):
    f = float(np.clip(f, 30, SR / 2 - 100))
    b, a = signal.iirpeak(f / (SR / 2), q)
    return signal.lfilter(b, a, x)

def lp(x, f, order=2):
    b, a = signal.butter(order, float(np.clip(f, 30, SR / 2 - 100)) / (SR / 2))
    return signal.lfilter(b, a, x)

def hp(x, f, order=2):
    b, a = signal.butter(order, float(np.clip(f, 20, SR / 2 - 100)) / (SR / 2), "high")
    return signal.lfilter(b, a, x)

def sweep_bp(x, f0, f1, q=1.0, blocks=24):
    n = len(x)
    out = np.zeros(n)
    L = n // blocks + 1
    for i in range(blocks):
        a = i * L
        b = min(n, a + L)
        f = f0 * (f1 / f0) ** (i / max(1, blocks - 1))
        out[a:b] = bp(x[max(0, a - 400):b], f, q)[-(b - a):]
    return out

def sat(x, k=1.6):
    return np.tanh(x * k) / np.tanh(k)

# ── Physical Sound Materials ──────────────────────────────────────────────────

def air(dur=0.45, f0=250, f1=2600, q=1.4, shape=0.45):
    """Soft directional whoosh: filtered air whose center frequency sweeps f0->f1."""
    n = int(SR * dur)
    x = sweep_bp(_rng.standard_normal(n), f0, f1, q)
    x = lp(x, 5500)
    t = _t(n) / dur
    e = np.sin(np.pi * np.clip(t, 0, 1)) ** 1.4 * np.where(t < shape, t / max(1e-4, shape), 1)
    return x * e / (np.abs(x * e).max() + 1e-9)

def glass(f=659, dur=0.9, bright=1.0):
    """Small struck tone: pure fundamental + inharmonic partials + crisp transient."""
    n = int(SR * dur)
    t = _t(n)
    s = (
        np.sin(2 * np.pi * f * t) * np.exp(-t * 6)
        + 0.35 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 14) * bright
        + 0.18 * np.sin(2 * np.pi * f * 5.40 * t) * np.exp(-t * 24) * bright
    )
    tr = lp(hp(_rng.standard_normal(n), 2000), 9000) * np.exp(-t * 220) * 0.5
    return (s * 0.7 + tr) / 1.2

def wood(f=180, dur=0.10):
    """Muted tactile click: body with pitch drop + ultra-short snap (mouse click / keydown)."""
    n = int(SR * dur)
    t = _t(n)
    body = np.sin(2 * np.pi * f * t * (1 + 0.35 * np.exp(-t * 90))) * np.exp(-t * 65)
    snap = bp(_rng.standard_normal(n), 3400, 2.2) * np.exp(-t * 420)
    return body * 0.85 + snap * 0.55

def sub(f=60, dur=0.75):
    """Deep felt bass impact: sub-sine with rapid pitch drop, gently saturated."""
    n = int(SR * dur)
    t = _t(n)
    ph = np.cumsum(2 * np.pi * (f + f * 2.2 * np.exp(-t * 28)) / SR)
    s = np.sin(ph) * np.exp(-t * 5.5)
    tr = lp(_rng.standard_normal(n), 450) * np.exp(-t * 85) * 0.8
    return sat(s * 1.1 + tr * 0.5, 1.8)

def bubble(f=520, dur=0.20):
    """Rounded interactive pop: closing resonance with rising pitch."""
    n = int(SR * dur)
    t = _t(n)
    ph = np.cumsum(2 * np.pi * (f * (1 + 0.85 * (1 - np.exp(-t * 32)))) / SR)
    return np.sin(ph) * np.exp(-t * 28) * 0.9 + bp(_rng.standard_normal(n), f * 3, 3) * np.exp(-t * 220) * 0.4

def wobble(f=150, dur=0.60):
    """Jelly vibrato: FM tone with decaying oscillation."""
    n = int(SR * dur)
    t = _t(n)
    ph = np.cumsum(2 * np.pi * f * (1 + 0.10 * np.sin(2 * np.pi * 8.5 * t) * np.exp(-t * 3.5)) / SR)
    return lp(np.sin(ph) + 0.25 * np.sin(2 * ph), 1400) * np.exp(-t * 5.5)

def pan_of(x, width=1920):
    """Map horizontal screen coordinate to stereo pan [-0.6, +0.6]."""
    if x is None:
        return 0.0
    return float(np.clip((float(x) - width / 2) / (width / 2) * 0.6, -0.65, 0.65))

# ── Shared Room Reverb & Score Assembly ───────────────────────────────────────

def impulse(T60=0.9):
    """Shared stereo room impulse response (early reflections + dense diffuse tail)."""
    n = int(SR * T60 * 1.25)
    t = _t(n)
    ir = _rng.standard_normal((n, 2)) * np.exp(-6.9 * t / T60)[:, None]
    ir = np.stack([lp(ir[:, 0], 4000), lp(ir[:, 1], 3600)], axis=1)
    ir[:int(SR * 0.010)] *= 0
    # Discrete early reflection taps
    for d, g in ((0.016, 0.45), (0.028, 0.32), (0.042, 0.22)):
        idx = int(d * SR)
        if idx + 2 <= n:
            ir[idx:idx + 2] += g * _rng.uniform(0.5, 1.0, (2, 2))
    return ir / (np.abs(ir).sum(axis=0).max() + 1e-9) * 3.6

class Score:
    """Multi-track sound effect score sharing a unified acoustic environment."""

    def __init__(self, dur=15.0, T60=0.85):
        self.dur = float(dur)
        self.T60 = float(T60)
        n = int(SR * (self.dur + 2.5))
        self.dry = np.zeros((n, 2))
        self.wet = np.zeros((n, 2))
        self.events = []

    def place(self, sig, t, gain=1.0, pan=0.0, send=0.25, pan_to=None):
        sig = np.asarray(sig, dtype=float)
        i0 = max(0, int(t * SR))
        n = len(sig)
        if i0 + n > len(self.dry):
            ext = (i0 + n) - len(self.dry) + int(SR * 2)
            self.dry = np.pad(self.dry, ((0, ext), (0, 0)))
            self.wet = np.pad(self.wet, ((0, ext), (0, 0)))

        p = np.linspace(pan, pan if pan_to is None else pan_to, n)
        L = np.sqrt(0.5 * (1 - p))
        R = np.sqrt(0.5 * (1 + p))

        self.dry[i0:i0 + n, 0] += sig * gain * L
        self.dry[i0:i0 + n, 1] += sig * gain * R
        self.wet[i0:i0 + n, 0] += sig * gain * send * L
        self.wet[i0:i0 + n, 1] += sig * gain * send * R

        self.events.append({"t": round(t, 3), "gain": gain, "pan": round(pan, 2)})

    def mix(self, peak_db=-8.0):
        ir = impulse(self.T60)
        rev_L = signal.fftconvolve(self.wet[:, 0], ir[:, 0])[:len(self.dry)]
        rev_R = signal.fftconvolve(self.wet[:, 1], ir[:, 1])[:len(self.dry)]
        rev = np.stack([rev_L, rev_R], axis=1)

        m = self.dry + rev * 0.85
        m = np.stack([hp(m[:, 0], 35), hp(m[:, 1], 35)], axis=1)
        peak = np.abs(m).max()
        if peak > 1e-9:
            m = sat(m / peak * 0.92, 1.3)
            m = m / np.abs(m).max() * (10 ** (peak_db / 20))
        return m[:int(SR * self.dur)]

    def write(self, path, peak_db=-8.0):
        m = self.mix(peak_db=peak_db)
        out_dir = os.path.dirname(os.path.abspath(path))
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)
        with wave.open(path, "wb") as w:
            w.setnchannels(2)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes((np.clip(m, -1.0, 1.0) * 32767).astype(np.int16).tobytes())
        print(f"[Walkthrough SFX] Exported {path}: {len(self.events)} events, peak {peak_db} dBFS")

def auto_score_events(events, total_dur, out_path, peak_db=-9.0):
    """Automatically place sound materials based on recorded interaction events."""
    s = Score(dur=total_dur, T60=0.85)

    for ev in events:
        t = float(ev.get("time", 0.0))
        ev_type = ev.get("type", "click")
        x = ev.get("x", 960)
        pan = pan_of(x)

        if ev_type == "click":
            # Tactile mouse click: primary down-click + faint release
            s.place(wood(190, dur=0.08), t=t, gain=0.35, pan=pan, send=0.30)
            s.place(wood(280, dur=0.04), t=t + 0.06, gain=0.18, pan=pan, send=0.20)
        elif ev_type == "type":
            # Snappy keyboard strike
            pitch = int(_rng.integers(210, 260))
            s.place(wood(pitch, dur=0.05), t=t, gain=0.20, pan=pan, send=0.15)
        elif ev_type == "zoom":
            # Soft camera push whoosh
            f0 = 220 if ev.get("zoomIn", True) else 900
            f1 = 1600 if ev.get("zoomIn", True) else 260
            s.place(air(dur=0.42, f0=f0, f1=f1, q=1.2), t=t, gain=0.40, pan=pan, send=0.45)
        elif ev_type == "scene_cut" or ev_type == "transition":
            # Cinematic low hit + gentle glass chime
            s.place(sub(58, dur=0.8), t=t, gain=0.55, pan=0.0, send=0.50)
            s.place(glass(784, dur=0.7, bright=0.8), t=t + 0.05, gain=0.25, pan=0.1, send=0.55)
        elif ev_type == "reveal" or ev_type == "badge":
            # Crisp UI notification tone
            s.place(glass(880, dur=0.5, bright=1.2), t=t, gain=0.30, pan=pan, send=0.40)
        elif ev_type == "toggle":
            # Rounded interactive pop
            s.place(bubble(480, dur=0.18), t=t, gain=0.35, pan=pan, send=0.30)

    s.write(out_path, peak_db=peak_db)
    return out_path

def demo(path="sfx_demo.wav"):
    """Render a comprehensive demonstration of all synthetic materials in the room."""
    s = Score(dur=9.0, T60=0.95)
    s.place(glass(659, dur=0.85), t=0.3, gain=0.35, pan=-0.3, send=0.50)
    s.place(glass(1318, dur=1.1, bright=0.6), t=1.0, gain=0.28, pan=0.3, send=0.55)
    s.place(wood(180, dur=0.10), t=2.0, gain=0.40, pan=-0.2, send=0.25)
    s.place(wood(240, dur=0.07), t=2.5, gain=0.35, pan=0.0, send=0.20)
    s.place(wood(190, dur=0.06), t=2.58, gain=0.30, pan=0.1, send=0.20)
    s.place(air(dur=0.52, f0=220, f1=2800), t=3.3, gain=0.55, pan=0.5, pan_to=-0.4, send=0.45)
    s.place(bubble(520, dur=0.22), t=4.5, gain=0.38, pan=-0.1, send=0.30)
    s.place(wobble(150, dur=0.60), t=5.3, gain=0.45, pan=0.2, send=0.35)
    s.place(sub(65, dur=0.70), t=6.4, gain=0.55, pan=0.0, send=0.40)
    s.place(sub(45, dur=1.10), t=7.3, gain=0.60, pan=0.0, send=0.50)
    s.write(path)

def main():
    parser = argparse.ArgumentParser(description="Walkthrough SFX engine")
    parser.add_argument("--demo", default=None, help="Generate demo audio file")
    parser.add_argument("--events", default=None, help="JSON file with recorded events")
    parser.add_argument("--dur", type=float, default=15.0, help="Total duration in seconds")
    parser.add_argument("--out", default="sfx.wav", help="Output WAV path")
    args = parser.parse_args()

    if args.demo:
        demo(args.demo)
    elif args.events:
        with open(args.events, "r", encoding="utf-8") as f:
            events = json.load(f)
        auto_score_events(events, args.dur, args.out)
    else:
        demo("sfx_demo.wav")

if __name__ == "__main__":
    main()
