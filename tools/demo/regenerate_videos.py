"""Regenerate valid MP4 videos for the Instruments test course."""
import subprocess
from pathlib import Path

OUTPUT_DIR = Path("C:/Users/Kevin/Desktop/ZNAWCA - Test Samples")
FFMPEG = Path("C:/Users/Kevin/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.1-full_build/bin/ffmpeg.exe")

INSTRUMENTS = {
    "Violin": (139, 69, 19),
    "Trumpet": (218, 165, 32),
    "Flute": (192, 192, 192),
    "Piano": (30, 30, 30),
    "Djembe": (160, 82, 45),
    "Electric Guitar": (200, 50, 50),
    "Saxophone": (255, 215, 0),
    "Shamisen": (210, 180, 140),
}


def generate_video(obj_name: str, color: tuple):
    video_dir = OUTPUT_DIR / "Instruments" / obj_name / "videos"
    video_dir.mkdir(parents=True, exist_ok=True)
    video_path = video_dir / f"{obj_name} 00.mp4"

    r, g, b = color
    hex_color = f"{r:02x}{g:02x}{b:02x}"

    # Drawtext may fail if font/libfreetype missing; fallback to color only
    drawtext_filter = (
        f"drawtext=text='{obj_name}':fontcolor=white:fontsize=36:"
        f"x=(w-text_w)/2:y=(h-text_h)/2:box=1:boxcolor=black@0.3:boxborderw=10"
    )

    cmd = [
        str(FFMPEG), "-y",
        "-f", "lavfi",
        "-i", f"color=c=0x{hex_color}:s=640x480:r=24:d=2",
        "-vf", drawtext_filter,
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-pix_fmt", "yuv420p",
        "-an",
        str(video_path),
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60, check=True)
        print(f"OK: {video_path.name}")
        return
    except subprocess.CalledProcessError as e:
        err = (e.stderr or "").lower()
        if "drawtext" in err or "no such filter" in err:
            print(f"  drawtext unavailable for {obj_name}, using color-only fallback")
        else:
            print(f"  ffmpeg failed for {obj_name}: {e.stderr[:200]}")
            print(f"  trying color-only fallback")

    # Fallback: no text overlay
    cmd_fallback = [
        str(FFMPEG), "-y",
        "-f", "lavfi",
        "-i", f"color=c=0x{hex_color}:s=640x480:r=24:d=2",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-pix_fmt", "yuv420p",
        "-an",
        str(video_path),
    ]
    subprocess.run(cmd_fallback, capture_output=True, text=True, timeout=60, check=True)
    print(f"OK (color only): {video_path.name}")


def main():
    if not FFMPEG.exists():
        raise FileNotFoundError(f"ffmpeg not found at {FFMPEG}")

    print("Regenerating instrument videos...\n")
    for name, color in INSTRUMENTS.items():
        generate_video(name, color)

    print("\nDone.")


if __name__ == "__main__":
    main()
