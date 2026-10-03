# generate_flagship_audio.py
# Production audio generator with smart voice selection, inter-act pauses, and mathematical timing export.
import asyncio
import os
import json
import subprocess
import edge_tts

FLAGSHIP_SCENES = [
    # ACT 1: HOOK
    {
        "id": "act1_hook",
        "act": 1,
        "text": "Cloud telemetry is fragmented. We built Nexus Pulse to deliver sub-millisecond observability across global fleets."
    },
    # ACT 2: WALKTHROUGH PROOF
    {
        "id": "act2_s1",
        "act": 2,
        "text": "By clicking on the thirty-day window, our telemetry recalculates instantly, revealing sub-ten-millisecond latency."
    },
    {
        "id": "act2_s2",
        "act": 2,
        "text": "Engineers can quickly isolate bottlenecks by searching for the active analytics worker."
    },
    {
        "id": "act2_s3",
        "act": 2,
        "text": "Triggering a canary deployment safely routes ten percent traffic across healthy edge clusters."
    },
    # ACT 3: RECEIPT & OUTRO
    {
        "id": "act3_receipt",
        "act": 3,
        "text": "Deployable in one command. Experience the future of real-time telemetry today."
    }
]

def decide_voice(title=""):
    # Autonomous voice gender & identity selection
    # Ava provides vibrant, natural cadence for SaaS; Andrew provides deep technical authority
    voice = "en-US-AvaMultilingualNeural"
    gender = "Female"
    print(f"[Walkthrough Voice] Selected AI Voice: {voice} ({gender})")
    return voice

def get_dur(path):
    cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path]
    return float(subprocess.run(cmd, capture_output=True, text=True, check=True).stdout.strip())

def format_srt_time(seconds):
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds - int(seconds)) * 1000)
    return f"{hrs:02d}:{mins:02d}:{secs:02d},{millis:03d}"

async def main():
    flagship_dir = os.path.abspath("./flagship-output")
    audio_dir = os.path.join(flagship_dir, "audio")
    os.makedirs(audio_dir, exist_ok=True)

    voice = decide_voice()

    # 1. Synthesize individual scene clips
    print("[Walkthrough Audio] Synthesizing speech clips via edge-tts...")
    durations = {}
    for s in FLAGSHIP_SCENES:
        out_p = os.path.join(audio_dir, f"{s['id']}.mp3")
        comm = edge_tts.Communicate(s["text"], voice, rate="+7%")
        await comm.save(out_p)
        dur = get_dur(out_p)
        durations[s["id"]] = dur
        print(f"  - {s['id']}: {dur:.3f}s")

    # 2. Generate a 0.500s silent pause clip
    pause_mp3 = os.path.join(audio_dir, "pause_0.5s.mp3")
    subprocess.run([
        "ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono",
        "-t", "0.500", "-q:a", "9", "-acodec", "libmp3lame", pause_mp3
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    pause_dur = 0.500

    # 3. Concatenate master audio track with clean inter-act breathing pauses
    # Structure: [Act 1] -> (0.5s pause) -> [Act 2 s1 + s2 + s3] -> (0.5s pause) -> [Act 3]
    audio_sequence = [
        os.path.join(audio_dir, "act1_hook.mp3"),
        pause_mp3,
        os.path.join(audio_dir, "act2_s1.mp3"),
        os.path.join(audio_dir, "act2_s2.mp3"),
        os.path.join(audio_dir, "act2_s3.mp3"),
        pause_mp3,
        os.path.join(audio_dir, "act3_receipt.mp3"),
    ]

    list_file = os.path.join(audio_dir, "clips.txt")
    with open(list_file, "w", encoding="utf-8") as f:
        for p in audio_sequence:
            escaped = p.replace('\\', '/')
            f.write(f"file '{escaped}'\n")

    master_audio = os.path.join(flagship_dir, "flagship_voiceover.mp3")
    cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", list_file, "-c", "copy", master_audio]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL)
    total_audio_dur = get_dur(master_audio)
    print(f"[Walkthrough Audio] Master voiceover assembled: {master_audio} ({total_audio_dur:.3f}s)")

    # 4. Compute exact mathematical cut offsets & export timing manifest
    dur_act1 = durations["act1_hook"]
    dur_act2 = durations["act2_s1"] + durations["act2_s2"] + durations["act2_s3"]
    dur_act3 = durations["act3_receipt"]

    fade_dur = 0.35
    # Cut 1 is centered inside the first pause:
    # Act 1 audio ends at dur_act1. Pause lasts from dur_act1 to dur_act1 + pause_dur.
    # Dissolve runs from dur_act1 + 0.075 to dur_act1 + 0.425.
    cut1_time = dur_act1 + (pause_dur / 2.0)
    offset_1 = cut1_time - (fade_dur / 2.0)

    # Cut 2 is centered inside the second pause:
    # Act 2 audio ends at dur_act1 + pause_dur + dur_act2.
    act2_audio_end = dur_act1 + pause_dur + dur_act2
    cut2_time = act2_audio_end + (pause_dur / 2.0)
    offset_2 = cut2_time - (fade_dur / 2.0)

    timing_manifest = {
        "dur_act1": dur_act1,
        "dur_act2": dur_act2,
        "dur_act3": dur_act3,
        "pause_dur": pause_dur,
        "fade_dur": fade_dur,
        "cut1_time": cut1_time,
        "offset_1": offset_1,
        "cut2_time": cut2_time,
        "offset_2": offset_2,
        "total_audio_dur": total_audio_dur,
        "scenes": durations
    }

    timing_file = os.path.join(flagship_dir, "timing.json")
    with open(timing_file, "w", encoding="utf-8") as f:
        json.dump(timing_manifest, f, indent=2)
    print(f"[Walkthrough Timing] Saved timing manifest to {timing_file}")

    # 5. Generate synchronized SRT subtitles (never overlapping silence or scene cuts)
    srt_file = os.path.join(flagship_dir, "flagship_subtitles.srt")
    srt_entries = []
    
    # Act 1
    t_start = 0.1
    t_end = dur_act1 - 0.05
    srt_entries.append((t_start, t_end, FLAGSHIP_SCENES[0]["text"]))

    # Act 2 (Starts after pause 1)
    act2_start = dur_act1 + pause_dur
    curr = act2_start
    for s_id in ["act2_s1", "act2_s2", "act2_s3"]:
        text = [s["text"] for s in FLAGSHIP_SCENES if s["id"] == s_id][0]
        d = durations[s_id]
        srt_entries.append((curr + 0.08, curr + d - 0.08, text))
        curr += d

    # Act 3 (Starts after pause 2)
    act3_start = act2_audio_end + pause_dur
    srt_entries.append((act3_start + 0.08, act3_start + dur_act3 - 0.05, FLAGSHIP_SCENES[4]["text"]))

    with open(srt_file, "w", encoding="utf-8") as f:
        for idx, (s_t, e_t, text) in enumerate(srt_entries):
            f.write(f"{idx + 1}\n")
            f.write(f"{format_srt_time(s_t)} --> {format_srt_time(e_t)}\n")
            f.write(f"{text}\n\n")

    print(f"[Walkthrough Subtitles] Synchronized subtitles generated at: {srt_file}")

if __name__ == "__main__":
    asyncio.run(main())
