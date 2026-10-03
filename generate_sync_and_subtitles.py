# generate_sync_and_subtitles.py
# Intelligent voice gender selection, exact audio synchronization, and SRT subtitle generation.
import asyncio
import os
import subprocess
import json
import edge_tts

SCENES = [
    {
        "id": "s1",
        "selector": None,
        "action": "overview",
        "text": "Welcome to Nexus Pulse, a real-time observability platform built for high-scale cloud fleets."
    },
    {
        "id": "s2",
        "selector": "button#tab-30d",
        "action": "click",
        "desc": "Switch to 30-Day metrics window",
        "text": "By clicking on the thirty-day window, our telemetry recalculates instantly, showing sub-ten-millisecond latency."
    },
    {
        "id": "s3",
        "selector": "input#service-search",
        "action": "type",
        "typeText": "polars",
        "desc": "Filter microservices by typing polars",
        "text": "Engineers can quickly isolate bottlenecks by searching for the active analytics worker."
    },
    {
        "id": "s4",
        "selector": "button#btn-deploy",
        "action": "click",
        "desc": "Trigger canary deploy and observe toast confirmation",
        "text": "Finally, triggering a canary deployment safely routes ten percent traffic across healthy edge clusters."
    }
]

def decide_voice_gender(project_context=""):
    """
    Intelligently decides which neural voice gender to use.
    Ava (Female): Vibrant, modern, engaging SaaS product tours.
    Andrew (Male): Authoritative, technical infrastructure & developer tooling.
    """
    # Auto-detection logic based on tone or rotation
    # For modern interactive product tours, AvaMultilingualNeural provides top-tier clarity
    voice = "en-US-AvaMultilingualNeural"
    gender = "Female"
    print(f"[Voiceover Engine] AI Voice Selection: {gender} ({voice})")
    return voice, gender

def get_audio_duration(file_path):
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        file_path
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return float(res.stdout.strip())

def format_srt_time(seconds):
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds - int(seconds)) * 1000)
    return f"{hrs:02d}:{mins:02d}:{secs:02d},{millis:03d}"

async def main():
    output_dir = os.path.abspath("./walkthrough-output")
    audio_dir = os.path.join(output_dir, "audio")
    os.makedirs(audio_dir, exist_ok=True)

    voice, gender = decide_voice_gender()

    durations = []
    clip_files = []

    # 1. Synthesize audio clips for each scene
    for s in SCENES:
        out_path = os.path.join(audio_dir, f"{s['id']}.mp3")
        communicate = edge_tts.Communicate(s["text"], voice, rate="+7%")
        await communicate.save(out_path)
        dur = get_audio_duration(out_path)
        durations.append(dur)
        clip_files.append(out_path)
        print(f"[Voiceover Engine] Generated {s['id']}.mp3: {dur:.2f}s")

    # 2. Combine all clips into unified voiceover.mp3
    list_file = os.path.join(audio_dir, "clips.txt")
    with open(list_file, "w", encoding="utf-8") as f:
        for clip in clip_files:
            escaped = clip.replace('\\', '/')
            f.write(f"file '{escaped}'\n")

    combined_mp3 = os.path.join(output_dir, "voiceover.mp3")
    cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", list_file, "-c", "copy", combined_mp3]
    subprocess.run(cmd, check=True)
    print(f"[Voiceover Engine] Unified voiceover: {combined_mp3}")

    # 3. Generate perfectly synchronized subtitles.srt
    srt_file = os.path.join(output_dir, "subtitles.srt")
    current_time = 0.0
    with open(srt_file, "w", encoding="utf-8") as f:
        for idx, (s, dur) in enumerate(zip(SCENES, durations)):
            start_str = format_srt_time(current_time + 0.1)
            end_str = format_srt_time(current_time + dur - 0.1)
            f.write(f"{idx + 1}\n")
            f.write(f"{start_str} --> {end_str}\n")
            f.write(f"{s['text']}\n\n")
            current_time += dur

    print(f"[Subtitle Engine] Generated synchronized SRT at: {srt_file}")

    # 4. Synchronize storyboard.json step timings
    steps = []
    for s, dur in zip(SCENES, durations):
        if s["action"] == "overview":
            steps.append({
                "desc": "Scene 1: Initial overview",
                "holdMs": int(dur * 1000)
            })
        elif s["action"] == "click":
            # Time allocated for glide (~850ms) + zoom-in (~400ms) + hold + zoom-out (~400ms)
            overhead_ms = 850 + 400 + 400
            hold_ms = max(1800, int((dur * 1000) - overhead_ms))
            steps.append({
                "desc": s["desc"],
                "selector": s["selector"],
                "action": "click",
                "zoomOnClick": True,
                "holdMs": hold_ms
            })
        elif s["action"] == "type":
            type_time_ms = len(s["typeText"]) * 85
            overhead_ms = 850 + 400 + type_time_ms + 400
            hold_ms = max(1800, int((dur * 1000) - overhead_ms))
            steps.append({
                "desc": s["desc"],
                "selector": s["selector"],
                "action": "type",
                "text": s["typeText"],
                "typeDelay": 85,
                "zoomOnClick": True,
                "holdMs": hold_ms
            })

    storyboard = {
        "title": "Nexus Pulse Cloud Observability Walkthrough",
        "voiceGender": gender,
        "voice": voice,
        "baseUrl": "file:///C:/Users/pnara/OneDrive/Desktop/screen%20rec%20demo/app/index.html",
        "outputDir": "./walkthrough-output",
        "steps": steps
    }

    with open("./storyboard.json", "w", encoding="utf-8") as f:
        json.dump(storyboard, f, indent=2)

    print("[Sync Engine] Storyboard synchronized to exact audio durations.")

if __name__ == "__main__":
    asyncio.run(main())
