# composite.py
# Post-production video assembly: mixes audio, burns synchronized subtitles, and bakes poster frame.
import sys
import os
import subprocess

def run_cmd(cmd):
    print(f"[Walkthrough Composite] Running: {' '.join(cmd)}")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"[Walkthrough Composite] Error:\n{res.stderr}")
        raise RuntimeError(f"Command failed with exit code {res.returncode}")
    return res

def main():
    if len(sys.argv) < 2:
        print("Usage: python composite.py <output_directory> [bgm_file]")
        sys.exit(1)

    output_dir = os.path.abspath(sys.argv[1])
    bgm_path = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else None

    raw_video = os.path.join(output_dir, "raw_walkthrough.webm")
    vo_audio = os.path.join(output_dir, "voiceover.mp3")
    srt_file = os.path.join(output_dir, "subtitles.srt")
    final_video = os.path.join(output_dir, "walkthrough.mp4")
    poster_img = os.path.join(output_dir, "walkthrough.jpg")

    if not os.path.exists(raw_video):
        print(f"Error: Raw video not found at {raw_video}")
        sys.exit(1)

    has_vo = os.path.exists(vo_audio)
    has_srt = os.path.exists(srt_file)
    has_bgm = bgm_path and os.path.exists(bgm_path)

    # Prepare escaped subtitle path for FFmpeg filter
    # e.g. C\:/path/to/subtitles.srt
    escaped_srt = srt_file.replace('\\', '/').replace(':', '\\:')
    subtitle_filter = (
        f"subtitles='{escaped_srt}':"
        f"force_style='FontName=Arial,FontSize=20,PrimaryColour=&H00FFFFFF,"
        f"OutlineColour=&H0009090B,BackColour=&H90101014,BorderStyle=3,Outline=2,"
        f"Shadow=0,Alignment=2,MarginV=38'"
    )

    cmd = ["ffmpeg", "-y", "-i", raw_video]

    if has_vo and has_bgm:
        cmd += [
            "-i", vo_audio,
            "-i", bgm_path,
            "-filter_complex", (
                f"[0:v]{subtitle_filter}[vsub]; "
                f"[2:a]volume=0.12[bgm_ducked]; "
                f"[1:a][bgm_ducked]amix=inputs=2:duration=first[aout]"
            ),
            "-map", "[vsub]",
            "-map", "[aout]"
        ]
    elif has_vo and has_srt:
        cmd += [
            "-i", vo_audio,
            "-vf", subtitle_filter,
            "-map", "0:v",
            "-map", "1:a",
            "-c:a", "aac",
            "-b:a", "192k"
        ]
    elif has_vo:
        cmd += [
            "-i", vo_audio,
            "-map", "0:v",
            "-map", "1:a",
            "-c:a", "aac",
            "-b:a", "192k"
        ]

    cmd += [
        "-c:v", "libx264",
        "-crf", "18",
        "-preset", "fast",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        final_video
    ]

    run_cmd(cmd)
    print(f"[Walkthrough Composite] Successfully rendered with subtitles: {final_video}")

    # Extract high-res thumbnail poster image at 2.5s
    extract_poster_cmd = [
        "ffmpeg", "-y",
        "-ss", "00:00:02.500",
        "-i", final_video,
        "-frames:v", "1",
        "-q:v", "2",
        poster_img
    ]
    try:
        run_cmd(extract_poster_cmd)
        print(f"[Walkthrough Composite] Extracted poster: {poster_img}")
    except Exception as e:
        print(f"[Walkthrough Composite] Warning during poster extraction: {e}")

if __name__ == "__main__":
    main()
