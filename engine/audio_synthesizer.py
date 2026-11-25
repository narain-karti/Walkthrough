#!/usr/bin/env python3
"""
Walkthrough · engine/audio_synthesizer.py
Synthesizes synchronized neural voiceover via edge-tts directly from storyboard.json,
writes timing.json with exact cut offsets, and emits subtitles.srt.
"""

import argparse
import asyncio
import json
import os
import subprocess
import edge_tts

DEFAULT_VOICES = {
    "female": "en-US-AvaMultilingualNeural",
    "ava": "en-US-AvaMultilingualNeural",
    "male": "en-US-AndrewMultilingualNeural",
    "andrew": "en-US-AndrewMultilingualNeural",
}


def resolve_voice(cli_voice, storyboard):
    raw = cli_voice or storyboard.get("voice") or storyboard.get("voiceGender") or "female"
    key = str(raw).strip().lower()
    voice = DEFAULT_VOICES.get(key, raw)
    print(f"[Walkthrough Voice] Selected: {voice}")
    return voice


def get_dur(path):
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        path,
    ]
    return float(subprocess.run(cmd, capture_output=True, text=True, check=True).stdout.strip())


def format_srt_time(seconds):
    seconds = max(0.0, seconds)
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int(round((seconds - int(seconds)) * 1000))
    if millis == 1000:
        secs += 1
        millis = 0
    return f"{hrs:02d}:{mins:02d}:{secs:02d},{millis:03d}"


def make_silence(out_path, duration_sec):
    subprocess.run(
        [
            "ffmpeg", "-y", "-f", "lavfi",
            "-i", "anullsrc=r=24000:cl=mono",
            "-t", f"{duration_sec:.3f}",
            "-q:a", "9", "-acodec", "libmp3lame",
            out_path,
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=True,
    )


def collect_segments(storyboard):
    segments = []
    intro = storyboard.get("intro") or {}
    if intro.get("narration"):
        segments.append({"id": "intro", "kind": "intro", "text": intro["narration"].strip()})

    for idx, step in enumerate(storyboard.get("steps", [])):
        text = (step.get("narration") or "").strip()
        if text:
            segments.append({
                "id": f"step_{idx}",
                "kind": "step",
                "stepIndex": idx,
                "text": text,
            })

    outro = storyboard.get("outro") or {}
    if outro.get("narration"):
        segments.append({"id": "outro", "kind": "outro", "text": outro["narration"].strip()})

    return segments


async def synthesize(storyboard_path, cli_voice=None, cli_output=None):
    with open(storyboard_path, "r", encoding="utf-8") as f:
        storyboard = json.load(f)

    output_dir = os.path.abspath(cli_output or storyboard.get("outputDir") or "./walkthrough-output")
    audio_dir = os.path.join(output_dir, "audio")
    os.makedirs(audio_dir, exist_ok=True)

    segments = collect_segments(storyboard)
    timing_file = os.path.join(output_dir, "timing.json")

    if not segments:
        print("[Walkthrough Audio] No narration fields found in storyboard; writing silent timing manifest.")
        with open(timing_file, "w", encoding="utf-8") as f:
            json.dump({"hasAudio": False, "stepTimings": {}, "offsets": []}, f, indent=2)
        return

    voice = resolve_voice(cli_voice, storyboard)
    rate = storyboard.get("voiceRate", "+7%")

    print(f"[Walkthrough Audio] Synthesizing {len(segments)} narration clip(s) via edge-tts...")
    for seg in segments:
        out_p = os.path.join(audio_dir, f"{seg['id']}.mp3")
        comm = edge_tts.Communicate(seg["text"], voice, rate=rate)
        await comm.save(out_p)
        seg["path"] = out_p
        seg["dur"] = get_dur(out_p)
        print(f"  - {seg['id']}: {seg['dur']:.3f}s")

    act_pause_dur = 0.500
    step_pause_dur = 0.180
    fade_dur = 0.350

    act_pause_mp3 = os.path.join(audio_dir, "pause_act.mp3")
    step_pause_mp3 = os.path.join(audio_dir, "pause_step.mp3")
    make_silence(act_pause_mp3, act_pause_dur)
    make_silence(step_pause_mp3, step_pause_dur)

    intro_segs = [s for s in segments if s["kind"] == "intro"]
    step_segs = [s for s in segments if s["kind"] == "step"]
    outro_segs = [s for s in segments if s["kind"] == "outro"]

    sequence = []
    srt_entries = []
    step_timings = {}
    cursor_t = 0.0

    # Act: Intro
    intro_dur = 0.0
    if intro_segs:
        seg = intro_segs[0]
        sequence.append(seg["path"])
        srt_entries.append((cursor_t + 0.08, cursor_t + seg["dur"] - 0.05, seg["text"]))
        cursor_t += seg["dur"]
        intro_dur = seg["dur"]

    offsets = []
    if intro_segs and (step_segs or outro_segs):
        sequence.append(act_pause_mp3)
        cut_t = cursor_t + (act_pause_dur / 2.0)
        offsets.append(round(cut_t - (fade_dur / 2.0), 3))
        cursor_t += act_pause_dur

    # Act: Main steps
    main_start = cursor_t
    for i, seg in enumerate(step_segs):
        if i > 0:
            sequence.append(step_pause_mp3)
            cursor_t += step_pause_dur
        start_t = cursor_t
        end_t = start_t + seg["dur"]
        sequence.append(seg["path"])
        srt_entries.append((start_t + 0.06, end_t - 0.06, seg["text"]))
        step_timings[str(seg["stepIndex"])] = {
            "start": round(start_t, 3),
            "end": round(end_t, 3),
            "duration": round(seg["dur"], 3),
        }
        cursor_t = end_t
    main_dur = cursor_t - main_start

    if outro_segs and (intro_segs or step_segs):
        sequence.append(act_pause_mp3)
        cut_t = cursor_t + (act_pause_dur / 2.0)
        offsets.append(round(cut_t - (fade_dur / 2.0), 3))
        cursor_t += act_pause_dur

    # Act: Outro
    outro_dur = 0.0
    if outro_segs:
        seg = outro_segs[0]
        sequence.append(seg["path"])
        srt_entries.append((cursor_t + 0.08, cursor_t + seg["dur"] - 0.05, seg["text"]))
        cursor_t += seg["dur"]
        outro_dur = seg["dur"]

    list_file = os.path.join(audio_dir, "clips.txt")
    with open(list_file, "w", encoding="utf-8") as f:
        for p in sequence:
            escaped = p.replace("\\", "/")
            f.write(f"file '{escaped}'\n")

    master_audio = os.path.join(output_dir, "voiceover.mp3")
    subprocess.run(
        ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", list_file, "-c", "copy", master_audio],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    total_audio_dur = get_dur(master_audio)

    # Exact clip length budgets so xfade joins never underflow
    clip_budgets = {}
    if intro_segs and offsets:
        clip_budgets["intro"] = round(offsets[0] + fade_dur + 0.10, 2)
    if step_segs:
        if intro_segs and outro_segs and len(offsets) == 2:
            clip_budgets["main"] = round((offsets[1] + fade_dur) - offsets[0] + 0.25, 2)
        elif intro_segs and len(offsets) == 1:
            clip_budgets["main"] = round(total_audio_dur - offsets[0] + 0.35, 2)
        elif outro_segs and len(offsets) == 1:
            clip_budgets["main"] = round(offsets[0] + fade_dur + 0.10, 2)
        else:
            clip_budgets["main"] = round(total_audio_dur + 0.35, 2)
    if outro_segs:
        last_offset = offsets[-1] if offsets else 0.0
        clip_budgets["outro"] = round(total_audio_dur - last_offset + 0.40, 2)

    timing_manifest = {
        "hasAudio": True,
        "voice": voice,
        "introDur": round(intro_dur, 3),
        "mainDur": round(main_dur, 3),
        "outroDur": round(outro_dur, 3),
        "pauseDur": act_pause_dur,
        "stepPauseDur": step_pause_dur,
        "fadeDur": fade_dur,
        "offsets": offsets,
        "clipBudgets": clip_budgets,
        "totalAudioDur": round(total_audio_dur, 3),
        "stepTimings": step_timings,
        "subtitles": [
            {"start": round(s, 3), "end": round(e, 3), "text": txt}
            for s, e, txt in srt_entries
        ],
    }

    with open(timing_file, "w", encoding="utf-8") as f:
        json.dump(timing_manifest, f, indent=2)

    srt_file = os.path.join(output_dir, "subtitles.srt")
    with open(srt_file, "w", encoding="utf-8") as f:
        for idx, (s_t, e_t, txt) in enumerate(srt_entries):
            f.write(f"{idx + 1}\n")
            f.write(f"{format_srt_time(s_t)} --> {format_srt_time(e_t)}\n")
            f.write(f"{txt}\n\n")

    print(f"[Walkthrough Audio] Voiceover ready: {master_audio} ({total_audio_dur:.2f}s)")
    print(f"[Walkthrough Audio] Timing manifest: {timing_file}")


def main():
    parser = argparse.ArgumentParser(description="Synthesize voiceover and timing manifest from storyboard.json")
    parser.add_argument("storyboard", nargs="?", default="./showcase/storyboard.json")
    parser.add_argument("--voice", default=None)
    parser.add_argument("--output", default=None)
    args = parser.parse_args()
    asyncio.run(synthesize(args.storyboard, args.voice, args.output))


if __name__ == "__main__":
    main()
