# stitch_flagship.py
# Production-ready Flagship Compositor with mathematically synchronized xfade dissolves and burned subtitles.
import os
import json
import subprocess

def run_cmd(cmd):
    print(f"[Walkthrough Compositor] {' '.join(cmd)}")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"[Walkthrough Compositor] Error:\n{res.stderr}")
        raise RuntimeError(f"FFmpeg failed with code {res.returncode}")
    return res

def main():
    flagship_dir = os.path.abspath("./flagship-output")
    raw_dir = os.path.join(flagship_dir, "raw")
    os.makedirs(raw_dir, exist_ok=True)

    timing_file = os.path.join(flagship_dir, "timing.json")
    if not os.path.exists(timing_file):
        raise FileNotFoundError(f"Missing timing manifest: {timing_file}")

    with open(timing_file, "r", encoding="utf-8") as f:
        timing = json.load(f)

    offset_1 = timing["offset_1"]
    offset_2 = timing["offset_2"]
    fade_dur = timing["fade_dur"]
    total_audio_dur = timing["total_audio_dur"]

    # Compute exact clip lengths required to feed the xfade transitions
    c1_len = round(offset_1 + fade_dur + 0.10, 2)
    c2_len = round((offset_2 + fade_dur) - offset_1 + 0.20, 2)
    c3_len = round(total_audio_dur - offset_2 + 0.40, 2)

    print(f"[Walkthrough Compositor] Timing: Offset1={offset_1:.3f}s, Offset2={offset_2:.3f}s, Fade={fade_dur}s")
    print(f"[Walkthrough Compositor] Clip Budgets: C1={c1_len}s, C2={c2_len}s, C3={c3_len}s")

    act1_webm = os.path.join(raw_dir, "act1_intro.webm")
    act2_candidates = [
        os.path.abspath("./walkthrough-output/raw_walkthrough.mp4"),
        os.path.abspath("./walkthrough-output/raw_walkthrough.webm"),
        os.path.abspath("./walkthrough-output/walkthrough.mp4"),
    ]
    act2_webm = next((p for p in act2_candidates if os.path.exists(p)), act2_candidates[0])
    act3_webm = os.path.join(raw_dir, "act3_outro.webm")

    c1 = os.path.join(raw_dir, "c1.mp4")
    c2 = os.path.join(raw_dir, "c2.mp4")
    c3 = os.path.join(raw_dir, "c3.mp4")

    # 1. Normalize clips to 1080p 30fps H.264
    run_cmd(["ffmpeg", "-y", "-i", act1_webm, "-t", str(c1_len), "-vf", "fps=30,scale=1920:1080", "-c:v", "libx264", "-crf", "18", "-preset", "fast", c1])
    run_cmd(["ffmpeg", "-y", "-ss", "00:00:06.000", "-i", act2_webm, "-t", str(c2_len), "-vf", "fps=30,scale=1920:1080", "-c:v", "libx264", "-crf", "18", "-preset", "fast", c2])
    run_cmd(["ffmpeg", "-y", "-i", act3_webm, "-t", str(c3_len), "-vf", "fps=30,scale=1920:1080", "-c:v", "libx264", "-crf", "18", "-preset", "fast", c3])

    # 2. Mathematically centered xfade dissolves inside inter-act pauses
    joined_video = os.path.join(raw_dir, "joined_video.mp4")
    filter_expr = (
        f"[0:v][1:v]xfade=transition=fade:duration={fade_dur}:offset={offset_1:.3f}[v01]; "
        f"[v01][2:v]xfade=transition=fade:duration={fade_dur}:offset={offset_2:.3f}[vout]"
    )
    xfade_cmd = [
        "ffmpeg", "-y",
        "-i", c1,
        "-i", c2,
        "-i", c3,
        "-filter_complex", filter_expr,
        "-map", "[vout]",
        "-c:v", "libx264",
        "-crf", "18",
        "-preset", "fast",
        "-pix_fmt", "yuv420p",
        joined_video
    ]
    run_cmd(xfade_cmd)

    # 3. Master Compositing with Subtitles & Synchronized Audio
    srt_file = os.path.join(flagship_dir, "flagship_subtitles.srt")
    audio_file = os.path.join(flagship_dir, "flagship_voiceover.mp3")
    final_output = os.path.join(flagship_dir, "flagship_showcase.mp4")
    poster_output = os.path.join(flagship_dir, "flagship_showcase.jpg")

    escaped_srt = srt_file.replace('\\', '/').replace(':', '\\:')
    # Reserve an external caption rail instead of painting captions on top of
    # the product.  Product video retains its 16:9 geometry inside a restrained
    # matte; captions only occupy the lower rail.
    caption_canvas = "scale=1778:1000:flags=lanczos,pad=1920:1080:71:0:color=black"
    subtitle_filter = (
        f"{caption_canvas},subtitles='{escaped_srt}':"
        f"force_style='FontName=Arial,FontSize=13,PrimaryColour=&H00FFFFFF,"
        f"OutlineColour=&H00101014,BackColour=&H00000000,BorderStyle=1,Outline=1.2,"
        f"Shadow=0,Alignment=2,MarginV=20'"
    )

    sfx_file = os.path.join(flagship_dir, "flagship_sfx.wav")
    has_sfx = os.path.exists(sfx_file)

    if has_sfx:
        print(f"[Walkthrough Compositor] Layering acoustic sound effects: {sfx_file}")
        filter_complex = f"[0:v]{subtitle_filter}[vout];[1:a][2:a]amix=inputs=2:duration=first:weights=1.0 0.85[aout]"
        run_cmd([
            "ffmpeg", "-y",
            "-i", joined_video,
            "-i", audio_file,
            "-i", sfx_file,
            "-filter_complex", filter_complex,
            "-map", "[vout]",
            "-map", "[aout]",
            "-c:v", "libx264",
            "-crf", "18",
            "-preset", "fast",
            "-c:a", "aac",
            "-b:a", "192k",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            final_output
        ])
    else:
        run_cmd([
            "ffmpeg", "-y",
            "-i", joined_video,
            "-i", audio_file,
            "-vf", subtitle_filter,
            "-map", "0:v",
            "-map", "1:a",
            "-c:v", "libx264",
            "-crf", "18",
            "-preset", "fast",
            "-c:a", "aac",
            "-b:a", "192k",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            final_output
        ])

    # 4. Extract iconic hero poster from Act 1 at 3.0s
    run_cmd([
        "ffmpeg", "-y",
        "-ss", "00:00:03.000",
        "-i", final_output,
        "-frames:v", "1",
        "-q:v", "2",
        poster_output
    ])

    print(f"\n[Walkthrough Compositor] Production Master Ready: {final_output}")
    print(f"[Walkthrough Compositor] Hero Poster: {poster_output}")

if __name__ == "__main__":
    main()
