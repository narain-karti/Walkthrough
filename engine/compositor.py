#!/usr/bin/env python3
"""
Walkthrough · engine/compositor.py
Generic FFmpeg compositor supporting single-clip and multi-act storyboards,
pause-centered xfade dissolves, 1080p-calibrated ASS subtitles, and poster extraction.
"""

import argparse
import json
import os
import subprocess


def run_cmd(cmd):
    print(f"[Walkthrough Compositor] {' '.join(cmd)}")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"[Walkthrough Compositor] Error:\n{res.stderr}")
        raise RuntimeError(f"FFmpeg failed with code {res.returncode}")
    return res


def get_dur(path):
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        path,
    ]
    return float(subprocess.run(cmd, capture_output=True, text=True, check=True).stdout.strip())


def format_ass_time(seconds):
    seconds = max(0.0, seconds)
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    cs = int(round((seconds - int(seconds)) * 100))
    if cs == 100:
        secs += 1
        cs = 0
    return f"{hrs}:{mins:02d}:{secs:02d}.{cs:02d}"


def write_ass_subtitles(subtitles, out_path, sub_pos="bottom"):
    alignment = 8 if sub_pos == "top" else 2
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,34,&H00FFFFFF,&H000000FF,&H9909090B,&H9909090B,0,0,0,0,100,100,0,0,3,10,0,{alignment},140,140,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(header)
        for item in subtitles:
            s = format_ass_time(item["start"])
            e = format_ass_time(item["end"])
            txt = item["text"].replace("\n", "\\N")
            f.write(f"Dialogue: 0,{s},{e},Default,,0,0,0,,{txt}\n")


def normalize_clip(src, dst, fps, limit_sec=None):
    cmd = ["ffmpeg", "-y", "-i", src]
    if limit_sec is not None:
        cmd.extend(["-t", f"{limit_sec:.2f}"])
    cmd.extend([
        "-vf", f"fps={fps},scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
        "-c:v", "libx264", "-crf", "18", "-preset", "fast", "-pix_fmt", "yuv420p",
        dst,
    ])
    run_cmd(cmd)


def main():
    parser = argparse.ArgumentParser(description="Composite recorded walkthrough video with audio and subtitles")
    parser.add_argument("storyboard", nargs="?", default="./showcase/storyboard.json")
    parser.add_argument("--output", default=None)
    parser.add_argument("--no-subtitles", action="store_true")
    parser.add_argument("--sub-pos", choices=["bottom", "top"], default="bottom")
    parser.add_argument("--fps", type=int, default=30)
    args = parser.parse_args()

    with open(args.storyboard, "r", encoding="utf-8") as f:
        storyboard = json.load(f)

    output_dir = os.path.abspath(args.output or storyboard.get("outputDir") or "./walkthrough-output")
    raw_dir = os.path.join(output_dir, "raw")
    os.makedirs(raw_dir, exist_ok=True)

    timing_file = os.path.join(output_dir, "timing.json")
    timing = {}
    if os.path.exists(timing_file):
        with open(timing_file, "r", encoding="utf-8") as f:
            timing = json.load(f)

    budgets = timing.get("clipBudgets", {})
    offsets = timing.get("offsets", [])
    fade_dur = timing.get("fadeDur", 0.35)

    intro_webm = os.path.join(raw_dir, "act_intro.webm")
    main_webm = os.path.join(output_dir, "raw_walkthrough.webm")
    outro_webm = os.path.join(raw_dir, "act_outro.webm")

    if not os.path.exists(main_webm):
        raise FileNotFoundError(f"Missing recorded video: {main_webm}. Run `walkthrough run` first.")

    clips = []
    if os.path.exists(intro_webm) and storyboard.get("intro"):
        c_intro = os.path.join(raw_dir, "c_intro.mp4")
        normalize_clip(intro_webm, c_intro, args.fps, budgets.get("intro"))
        clips.append(c_intro)

    c_main = os.path.join(raw_dir, "c_main.mp4")
    normalize_clip(main_webm, c_main, args.fps, budgets.get("main"))
    clips.append(c_main)

    if os.path.exists(outro_webm) and storyboard.get("outro"):
        c_outro = os.path.join(raw_dir, "c_outro.mp4")
        normalize_clip(outro_webm, c_outro, args.fps, budgets.get("outro"))
        clips.append(c_outro)

    joined_video = os.path.join(raw_dir, "joined_video.mp4")
    if len(clips) == 1:
        joined_video = clips[0]
    else:
        # Compute xfade offsets from timing manifest or clip durations
        computed_offsets = list(offsets)
        while len(computed_offsets) < len(clips) - 1:
            idx = len(computed_offsets)
            prev_end = sum(get_dur(c) for c in clips[: idx + 1]) - idx * fade_dur
            computed_offsets.append(round(max(0.5, prev_end - fade_dur), 3))

        cmd = ["ffmpeg", "-y"]
        for c in clips:
            cmd.extend(["-i", c])

        filters = []
        prev_label = "[0:v]"
        for i in range(1, len(clips)):
            out_label = "[vout]" if i == len(clips) - 1 else f"[v{i}]"
            off = computed_offsets[i - 1]
            filters.append(f"{prev_label}[{i}:v]xfade=transition=fade:duration={fade_dur}:offset={off:.3f}{out_label}")
            prev_label = out_label

        cmd.extend([
            "-filter_complex", "; ".join(filters),
            "-map", "[vout]",
            "-c:v", "libx264", "-crf", "18", "-preset", "fast", "-pix_fmt", "yuv420p",
            joined_video,
        ])
        run_cmd(cmd)

    slug = storyboard.get("outputName") or "walkthrough"
    final_output = os.path.join(output_dir, f"{slug}.mp4")
    poster_output = os.path.join(output_dir, f"{slug}.jpg")
    audio_file = os.path.join(output_dir, "voiceover.mp3")
    has_audio = timing.get("hasAudio") and os.path.exists(audio_file)

    vf_filters = []
    sub_entries = timing.get("subtitles", [])
    if not args.no_subtitles and sub_entries:
        ass_file = os.path.join(output_dir, "subtitles.ass")
        write_ass_subtitles(sub_entries, ass_file, args.sub_pos)
        escaped_ass = ass_file.replace("\\", "/").replace(":", "\\:")
        vf_filters.append(f"ass='{escaped_ass}'")

    cmd = ["ffmpeg", "-y", "-i", joined_video]
    if has_audio:
        cmd.extend(["-i", audio_file])
    if vf_filters:
        cmd.extend(["-vf", ",".join(vf_filters)])

    cmd.extend(["-map", "0:v"])
    if has_audio:
        cmd.extend(["-map", "1:a", "-c:a", "aac", "-b:a", "192k", "-shortest"])

    cmd.extend([
        "-c:v", "libx264", "-crf", "18", "-preset", "fast",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        final_output,
    ])
    run_cmd(cmd)

    poster_ts = min(3.0, max(0.5, get_dur(final_output) / 3.0))
    run_cmd([
        "ffmpeg", "-y",
        "-ss", f"{poster_ts:.2f}",
        "-i", final_output,
        "-frames:v", "1", "-q:v", "2",
        poster_output,
    ])

    print(f"\n[Walkthrough Compositor] Master video: {final_output}")
    print(f"[Walkthrough Compositor] Poster frame: {poster_output}")


if __name__ == "__main__":
    main()
