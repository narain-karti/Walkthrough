# generate_audio.py
import asyncio
import os
import subprocess
import edge_tts

SCENES = [
    {
        "id": "s1",
        "text": "Welcome to Nexus Pulse, a high-performance observability dashboard built for real-time cloud fleets."
    },
    {
        "id": "s2",
        "text": "With a single click on the thirty-day window, our metrics recalculate instantly, revealing sub-ten-millisecond latency."
    },
    {
        "id": "s3",
        "text": "Engineers can rapidly isolate services by typing into the real-time microservice filter."
    },
    {
        "id": "s4",
        "text": "Finally, triggering a canary deployment safely routes ten percent traffic across healthy edge clusters."
    }
]

VOICE = "en-US-AndrewMultilingualNeural"

async def generate():
    audio_dir = os.path.abspath("./walkthrough-output/audio")
    os.makedirs(audio_dir, exist_ok=True)
    
    clip_files = []
    for s in SCENES:
        out_path = os.path.join(audio_dir, f"{s['id']}.mp3")
        communicate = edge_tts.Communicate(s["text"], VOICE, rate="+8%")
        await communicate.save(out_path)
        print(f"[Voiceover] Generated {out_path}")
        clip_files.append(out_path)

    # Combine with ffmpeg
    list_file = os.path.join(audio_dir, "clips.txt")
    with open(list_file, "w", encoding="utf-8") as f:
        for clip in clip_files:
            # write file 'path' with forward slashes
            escaped = clip.replace('\\', '/')
            f.write(f"file '{escaped}'\n")

    combined_mp3 = os.path.abspath("./walkthrough-output/voiceover.mp3")
    cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", list_file, "-c", "copy", combined_mp3]
    subprocess.run(cmd, check=True)
    print(f"[Voiceover] Combined track ready: {combined_mp3}")

if __name__ == "__main__":
    asyncio.run(generate())
