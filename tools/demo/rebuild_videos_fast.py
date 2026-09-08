"""
Fast instrument video rebuild:
- Use existing JPG images with ffmpeg zoompan animation
- Synthesize instrument-specific audio melodies
- Output 10s H.264 + AAC MP4s
"""
import math
import struct
import wave
import subprocess
import os
from pathlib import Path

DEMO = Path("C:/Users/Kevin/Desktop/Instruments Demo")
FFMPEG = "C:/Users/Kevin/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.1-full_build/bin/ffmpeg.exe"
DURATION = 10
FPS = 24

INSTRUMENTS = {
    "Piano":        {"base": 261.63, "wave": "sine",    "attack": 0.02, "decay": 0.3, "sustain": 0.6, "release": 0.5},
    "Violin":       {"base": 440.00, "wave": "saw",     "attack": 0.05, "decay": 0.2, "sustain": 0.8, "release": 0.3},
    "Trumpet":      {"base": 493.88, "wave": "square",  "attack": 0.03, "decay": 0.15,"sustain": 0.7, "release": 0.2},
    "Flute":        {"base": 523.25, "wave": "sine",    "attack": 0.08, "decay": 0.1, "sustain": 0.9, "release": 0.4},
    "Electric Guitar": {"base": 329.63, "wave": "saw",  "attack": 0.01, "decay": 0.4, "sustain": 0.5, "release": 0.3},
    "Saxophone":    {"base": 392.00, "wave": "square",  "attack": 0.04, "decay": 0.25,"sustain": 0.7, "release": 0.35},
    "Djembe":       {"base": 130.81, "wave": "triangle","attack": 0.001,"decay": 0.5, "sustain": 0.1, "release": 0.3},
    "Shamisen":     {"base": 293.66, "wave": "triangle","attack": 0.01, "decay": 0.6, "sustain": 0.3, "release": 0.2},
}


def generate_wave(wave_type, freq, t):
    phase = 2 * math.pi * freq * t
    if wave_type == "sine":
        return math.sin(phase)
    elif wave_type == "saw":
        return 2 * ((freq * t) % 1) - 1
    elif wave_type == "square":
        return 1.0 if math.sin(phase) >= 0 else -1.0
    elif wave_type == "triangle":
        return 2 * abs(2 * ((freq * t) % 1) - 1) - 1
    return 0.0


def apply_envelope(val, t, attack, decay, sustain_level, release, note_duration):
    if t < attack:
        env = t / attack
    elif t < attack + decay:
        env = 1.0 - (1.0 - sustain_level) * ((t - attack) / decay)
    elif t < note_duration - release:
        env = sustain_level
    elif t < note_duration:
        env = sustain_level * (1.0 - (t - (note_duration - release)) / release)
    else:
        env = 0.0
    return val * env


def synthesize_audio(name: str, output_wav: Path):
    cfg = INSTRUMENTS[name]
    base = cfg["base"]
    sample_rate = 48000

    # Melodic pattern for each instrument
    intervals = [1.0, 1.5, 1.0, 2.0, 1.5, 1.0, 0.75, 1.0]
    note_durations = [1.2, 1.0, 1.2, 1.5, 1.0, 1.2, 0.8, 1.5]
    note_durations[-1] = DURATION - sum(note_durations[:-1])

    samples = []
    current_time = 0.0

    for interval, dur in zip(intervals, note_durations):
        if current_time >= DURATION:
            break
        note_dur = min(dur, DURATION - current_time)

        for s in range(int(note_dur * sample_rate)):
            t = s / sample_rate
            raw = generate_wave(cfg["wave"], base * interval, t)
            for h in range(2, 4):
                raw += 0.3 / h * generate_wave(cfg["wave"], base * interval * h, t)
            if cfg["sustain"] > 0.3 and t > cfg["attack"] + cfg["decay"]:
                raw *= 1.0 + 0.005 * math.sin(2 * math.pi * 5.5 * t)
            env = apply_envelope(raw, t, cfg["attack"], cfg["decay"], cfg["sustain"], cfg["release"], note_dur)
            samples.append(max(-0.9, min(0.9, env * 0.7)))

        current_time += note_dur

    total_samples = sample_rate * DURATION
    while len(samples) < total_samples:
        samples.append(0.0)

    with wave.open(str(output_wav), 'w') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.setnframes(len(samples))
        for s in samples:
            wf.writeframes(struct.pack('<h', int(s * 32767)))


def build_video(name: str):
    image_paths = list((DEMO / name / "images").glob(f"{name} 00.*"))
    if not image_paths:
        print(f"  [SKIP {name}] No image found")
        return False

    image_path = image_paths[0]
    video_dir = DEMO / name / "videos"
    video_dir.mkdir(parents=True, exist_ok=True)
    output_video = video_dir / f"{name} 00.mp4"

    # Temporary audio file
    audio_wav = DEMO / name / "audio" / f"{name} 00_synth_temp.wav"
    audio_wav.parent.mkdir(parents=True, exist_ok=True)

    print(f"  {name}: synthesizing audio...")
    synthesize_audio(name, audio_wav)

    print(f"  {name}: encoding image animation + audio...")
    zoom_expr = "min(zoom+0.0015,1.25)"
    x_expr = "iw/2-(iw/zoom/2)+30*sin(on*2*PI/240)"
    y_expr = "ih/2-(ih/zoom/2)"
    vf = f"zoompan=z='{zoom_expr}':x='{x_expr}':y='{y_expr}':d={FPS * DURATION}:s=640x480:fps={FPS}"

    cmd = [
        FFMPEG, "-y",
        "-loop", "1", "-i", str(image_path),
        "-i", str(audio_wav),
        "-vf", vf,
        "-c:v", "libx264", "-preset", "ultrafast",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k",
        "-shortest",
        "-movflags", "+faststart",
        str(output_video),
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        print(f"    FFMPEG ERROR:\n{result.stderr[-500:]}")
        return False

    # Remove temp audio
    try:
        audio_wav.unlink()
    except OSError:
        pass

    # Verify
    ffprobe = "C:/Users/Kevin/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.1-full_build/bin/ffprobe.exe"
    v = subprocess.run([ffprobe, "-v", "error", "-show_entries", "stream=codec_name,codec_type", "-of", "csv=p=0", str(output_video)],
                       capture_output=True, text=True, timeout=10)
    streams = [l.strip() for l in v.stdout.strip().split('\n') if l.strip()]
    size_mb = output_video.stat().st_size / (1024 * 1024)
    print(f"    OK: {size_mb:.1f}MB, streams: {', '.join(streams)}")
    return True


def main():
    print("=== Rebuilding Instrument Demo Videos (fast method) ===\n")
    names = sorted(INSTRUMENTS.keys())
    success = 0
    for name in names:
        if build_video(name):
            success += 1
    print(f"\n=== Done: {success}/{len(names)} videos rebuilt ===")


if __name__ == "__main__":
    main()
