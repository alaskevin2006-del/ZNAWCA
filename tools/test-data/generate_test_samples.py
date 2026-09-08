"""
Znawca 完整测试样例生成器
生成 6 门课程，覆盖所有题型、媒体类型和边缘情况
"""
import os, struct, wave, math, shutil, io
from pathlib import Path

# ========== CONFIG ==========
OUTPUT_DIR = Path.home() / "Desktop" / "ZNAWCA - Test Samples"
PYTHON = Path.home() / ".workbuddy/binaries/python/envs/default/Scripts/python.exe"

# ========== HELPERS ==========

def create_xlsx(filepath: Path, sheet_name: str, headers: list, rows: list):
    """Create xlsx file using openpyxl with styling matching the original samples"""
    from openpyxl import Workbook
    from openpyxl.styles import PatternFill, Font, Border, Side, Alignment

    wb = Workbook()
    ws = wb.active
    ws.title = sheet_name

    dark_green = PatternFill(start_color="315C46", end_color="315C46", fill_type="solid")
    gold = PatternFill(start_color="A67C2E", end_color="A67C2E", fill_type="solid")
    white_font = Font(color="FFFFFF", bold=True, size=11)
    thin_border = Border(
        left=Side(style='thin'), right=Side(style='thin'),
        top=Side(style='thin'), bottom=Side(style='thin')
    )
    normal_font = Font(size=11)
    wrap_align = Alignment(wrap_text=True, vertical='top')

    # Write headers
    for c, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=c, value=h)
        fill = gold if h.strip().startswith('#') else dark_green
        cell.fill = fill
        cell.font = white_font
        cell.border = thin_border
        cell.alignment = Alignment(wrap_text=True, vertical='center', horizontal='center')

    # Write data
    for r, row in enumerate(rows, 2):
        for c, val in enumerate(row, 1):
            cell = ws.cell(row=r, column=c, value=val)
            cell.font = normal_font
            cell.border = thin_border
            cell.alignment = wrap_align

    # Column widths
    col_widths = [max(len(str(row[i])) if i < len(row) else 10 for row in [headers] + rows) + 4 for i in range(len(headers))]
    for i, w in enumerate(col_widths, 1):
        ws.column_dimensions[ws.cell(row=1, column=i).column_letter].width = min(w, 60)

    wb.save(str(filepath))
    print(f"  Created: {filepath.name}")


def generate_image(filepath: Path, width: int, height: int, bg_color: tuple, label: str = ""):
    """Generate a simple colored placeholder image with text label"""
    from PIL import Image, ImageDraw, ImageFont

    img = Image.new('RGB', (width, height), bg_color)
    draw = ImageDraw.Draw(img)

    # Add a subtle border/frame effect
    for i in range(4):
        draw.rectangle([i, i, width-1-i, height-1-i], outline=(255,255,255,80), width=1)

    # Add label text
    if label:
        try:
            # Try to use a system font
            font_size = min(width, height) // 15
            font = ImageFont.truetype("arial.ttf", font_size)
        except:
            font = ImageFont.load_default()

        # Text shadow
        bbox = draw.textbbox((0, 0), label, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        tx, ty = (width - tw) // 2, (height - th) // 2
        draw.text((tx+2, ty+2), label, fill=(0, 0, 0, 100), font=font)
        draw.text((tx, ty), label, fill=(255, 255, 255), font=font)

    filepath.parent.mkdir(parents=True, exist_ok=True)
    img.save(str(filepath))
    print(f"    Image: {filepath.name}")


def generate_wav(filepath: Path, duration_sec: float = 2.0, freq: float = 440.0, sample_rate: int = 44100):
    """Generate a simple WAV file with a tone"""
    filepath.parent.mkdir(parents=True, exist_ok=True)
    n_samples = int(sample_rate * duration_sec)

    with wave.open(str(filepath), 'w') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(sample_rate)

        # Generate a simple tone with fade in/out
        samples = []
        fade_len = int(sample_rate * 0.1)
        for i in range(n_samples):
            t = i / sample_rate
            val = int(16000 * math.sin(2 * math.pi * freq * t))

            # Fade in/out
            if i < fade_len:
                val = int(val * i / fade_len)
            elif i > n_samples - fade_len:
                val = int(val * (n_samples - i) / fade_len)

            samples.append(val)

        wf.writeframes(struct.pack('<' + 'h' * n_samples, *samples))

    print(f"    Audio: {filepath.name}")


# ========== COURSE DATA ==========

# Course 1: Countries (images only - flags)
COUNTRIES_DATA = {
    "sheet": "Countries of the World",
    "headers": [
        "Country",
        "Capital",
        "Continent",
        "Official Language",
        "Currency",
        "Population (millions)",
        "#Region",
        "#Development Level"
    ],
    "rows": [
        ["Japan", "Tokyo", "Asia", "Japanese", "Yen (¥)", "125", "East Asia", "Developed"],
        ["Brazil", "Brasília", "South America", "Portuguese", "Real (R$)", "214", "Latin America", "Developing"],
        ["Egypt", "Cairo", "Africa", "Arabic", "Egyptian Pound (E£)", "109", "Middle East; North Africa", "Developing"],
        ["France", "Paris", "Europe", "French", "Euro (€)", "68", "Western Europe", "Developed"],
        ["India", "New Delhi", "Asia", "Hindi; English", "Indian Rupee (₹)", "1428", "South Asia", "Developing"],
        ["Australia", "Canberra", "Oceania", "English", "Australian Dollar (A$)", "26", "Oceania", "Developed"],
        ["Kenya", "Nairobi", "Africa", "Swahili; English", "Kenyan Shilling (KSh)", "54", "East Africa", "Developing"],
        ["Canada", "Ottawa", "North America", "English; French", "Canadian Dollar (C$)", "39", "North America", "Developed"],
        ["South Korea", "Seoul", "Asia", "Korean", "Won (₩)", "52", "East Asia", "Developed"],
        ["Peru", "Lima", "South America", "Spanish; Quechua", "Sol (S/.)", "34", "Latin America", "Developing"],
    ],
    "colors": {
        "Japan": (180, 50, 50),
        "Brazil": (0, 150, 50),
        "Egypt": (200, 50, 50),
        "France": (0, 80, 180),
        "India": (255, 150, 50),
        "Australia": (0, 50, 150),
        "Kenya": (50, 50, 50),
        "Canada": (200, 30, 30),
        "South Korea": (200, 200, 255),
        "Peru": (200, 40, 40),
    }
}

# Course 2: Musical Instruments (images + audio + video)
INSTRUMENTS_DATA = {
    "sheet": "Musical Instruments",
    "headers": [
        "Instrument",
        "Instrument Family",
        "Primary Material",
        "Playing Technique",
        "Origin Region",
        "Typical Pitch Range",
        "#Orchestra Section",
        "#Difficulty Level"
    ],
    "rows": [
        ["Violin", "Strings", "Wood (maple; spruce)", "Bowed", "Italy", "G3 to E6+", "Strings", "Advanced"],
        ["Trumpet", "Brass", "Brass (yellow brass)", "Blown (buzzed lips)", "Europe", "F#3 to C6", "Brass", "Intermediate"],
        ["Flute", "Woodwinds", "Metal (silver; nickel)", "Blown (edge tone)", "Europe; Asia", "C4 to C7", "Woodwinds", "Intermediate"],
        ["Piano", "Keyboard; Percussion", "Wood; metal strings; felt hammers", "Struck (hammer action)", "Italy", "A0 to C8", "Keyboard", "Advanced"],
        ["Djembe", "Percussion", "Wood; goatskin", "Struck (hands)", "West Africa", "Variable (bass; tone; slap)", "Percussion", "Beginner"],
        ["Electric Guitar", "Strings; Electronic", "Wood; metal strings; pickups", "Plucked; picked", "United States", "E2 to E6", "Guitar", "Intermediate"],
        ["Saxophone", "Woodwinds", "Brass (body); cane reed", "Blown (single reed)", "Belgium", "Bb3 to F#6", "Woodwinds; Jazz", "Intermediate"],
        ["Shamisen", "Strings", "Wood; silk or nylon strings", "Plucked (bachi plectrum)", "Japan", "D3 to D5+", "Traditional", "Advanced"],
    ],
    "colors": {
        "Violin": (139, 69, 19),
        "Trumpet": (218, 165, 32),
        "Flute": (192, 192, 192),
        "Piano": (30, 30, 30),
        "Djembe": (160, 82, 45),
        "Electric Guitar": (200, 50, 50),
        "Saxophone": (255, 215, 0),
        "Shamisen": (210, 180, 140),
    }
}

# Course 3: Fruits (images only - simple, for quick testing)
FRUITS_DATA = {
    "sheet": "Common Fruits",
    "headers": [
        "Fruit Name",
        "Botanical Family",
        "Typical Color",
        "Taste Profile",
        "Primary Vitamin",
        "Growing Season",
        "#Fruit Category",
        "#Climate Zone"
    ],
    "rows": [
        ["Apple", "Rosaceae", "Red; Green; Yellow", "Sweet; Tart", "Vitamin C", "Autumn", "Pome", "Temperate"],
        ["Banana", "Musaceae", "Yellow", "Sweet; Creamy", "Vitamin B6; Potassium", "Year-round", "Berry", "Tropical"],
        ["Orange", "Rutaceae", "Orange", "Sweet; Citrusy", "Vitamin C", "Winter to Spring", "Citrus", "Subtropical"],
        ["Strawberry", "Rosaceae", "Red", "Sweet; Tart; Aromatic", "Vitamin C", "Spring to Summer", "Aggregate fruit", "Temperate"],
        ["Mango", "Anacardiaceae", "Yellow; Orange", "Sweet; Tropical", "Vitamin A; C", "Summer", "Drupe", "Tropical"],
        ["Grapes", "Vitaceae", "Green; Red; Purple", "Sweet; Juicy", "Vitamin K; C", "Summer to Autumn", "Berry", "Temperate"],
    ],
    "colors": {
        "Apple": (200, 40, 40),
        "Banana": (240, 230, 50),
        "Orange": (255, 165, 0),
        "Strawberry": (220, 20, 60),
        "Mango": (255, 190, 60),
        "Grapes": (128, 0, 128),
    }
}

# Course 4: Planets (text-only - NO media at all)
PLANETS_DATA = {
    "sheet": "Solar System Planets",
    "headers": [
        "Planet",
        "Type",
        "Distance from Sun (AU)",
        "Diameter (km)",
        "Number of Moons",
        "Orbital Period (Earth days)",
        "#Planet Group",
        "#Atmosphere Type"
    ],
    "rows": [
        ["Mercury", "Terrestrial", "0.39", "4,879", "0", "88", "Inner planet", "Minimal"],
        ["Venus", "Terrestrial", "0.72", "12,104", "0", "225", "Inner planet", "Thick CO2"],
        ["Earth", "Terrestrial", "1.00", "12,742", "1", "365", "Inner planet", "N2; O2"],
        ["Mars", "Terrestrial", "1.52", "6,779", "2", "687", "Inner planet", "Thin CO2"],
        ["Jupiter", "Gas giant", "5.20", "139,820", "95", "4,333", "Outer planet", "H2; He"],
        ["Saturn", "Gas giant", "9.54", "116,460", "146", "10,759", "Outer planet", "H2; He"],
        ["Uranus", "Ice giant", "19.22", "50,724", "27", "30,687", "Outer planet", "H2; He; CH4"],
        ["Neptune", "Ice giant", "30.05", "49,244", "16", "60,190", "Outer planet", "H2; He; CH4"],
    ],
    "colors": {
        "Mercury": (169, 169, 169),
        "Venus": (230, 200, 150),
        "Earth": (70, 130, 180),
        "Mars": (200, 80, 60),
        "Jupiter": (210, 180, 140),
        "Saturn": (220, 200, 140),
        "Uranus": (170, 210, 230),
        "Neptune": (70, 100, 210),
    }
}

# Course 5: Dog Breeds (images only - partial audio)
DOGS_DATA = {
    "sheet": "Dog Breeds",
    "headers": [
        "Breed Name",
        "Size Category",
        "Coat Type",
        "Temperament",
        "Origin Country",
        "Average Lifespan (years)",
        "#Breed Group",
        "#Energy Level"
    ],
    "rows": [
        ["German Shepherd", "Large", "Double coat (medium)", "Intelligent; Loyal; Courageous", "Germany", "9-13", "Herding", "High"],
        ["Shiba Inu", "Medium", "Double coat (thick)", "Alert; Bold; Faithful", "Japan", "12-16", "Non-sporting", "Medium"],
        ["Golden Retriever", "Large", "Double coat (water-repellent)", "Friendly; Intelligent; Devoted", "United Kingdom", "10-12", "Sporting", "High"],
        ["Pomeranian", "Toy", "Double coat (fluffy)", "Playful; Bold; Intelligent", "Germany; Poland", "12-16", "Toy", "Medium"],
        ["Husky", "Medium", "Double coat (thick)", "Friendly; Mischievous; Outgoing", "Russia (Siberia)", "12-15", "Working", "Very High"],
        ["Bulldog", "Medium", "Short; smooth", "Docile; Willful; Friendly", "United Kingdom", "8-10", "Non-sporting", "Low"],
    ],
    "colors": {
        "German Shepherd": (139, 100, 45),
        "Shiba Inu": (210, 140, 80),
        "Golden Retriever": (210, 170, 100),
        "Pomeranian": (200, 150, 100),
        "Husky": (150, 150, 170),
        "Bulldog": (180, 150, 120),
    }
}

# Course 6: Special Characters Test (tests Unicode and edge cases)
SPECIAL_DATA = {
    "sheet": "Special Names Test",
    "headers": [
        "Item Name",
        "Description",
        "Origin",
        "Category",
        "Interesting Fact",
        "#Group",
        "#Difficulty"
    ],
    "rows": [
        ["Münchner Weißwurst (慕尼黑白香肠)", "Traditional Bavarian veal sausage", "德国 (Germany)", "Meat product", "Traditionally eaten before noon", "Food", "Easy"],
        ["Beyoğlu (贝伊奥卢)", "Historic district in Istanbul", "Türkiye (Turkey)", "Place", "Famous for Istiklal Avenue", "Geography", "Medium"],
        ["São Paulo (圣保罗)", "Largest city in Brazil and Southern Hemisphere", "Brasil (Brazil)", "City", "Population over 12 million", "Geography", "Easy"],
        ["Łódź (罗兹)", "Third-largest city in Poland", "Polska (Poland)", "City", "Known for Piotrkowska Street (4.2 km)", "Geography", "Hard"],
        ["Köln (科隆)", "Fourth-largest city in Germany", "Deutschland (Germany)", "City", "Home to the famous Kölner Dom cathedral", "Geography", "Medium"],
    ],
    "colors": {
        "Münchner Weißwurst (慕尼黑白香肠)": (240, 230, 210),
        "Beyoğlu (贝伊奥卢)": (180, 140, 100),
        "São Paulo (圣保罗)": (60, 140, 60),
        "Łódź (罗兹)": (200, 50, 50),
        "Köln (科隆)": (180, 180, 180),
    }
}

ALL_COURSES = [
    ("Countries", COUNTRIES_DATA),
    ("Instruments", INSTRUMENTS_DATA),
    ("Fruits", FRUITS_DATA),
    ("Planets", PLANETS_DATA),
    ("Dogs", DOGS_DATA),
    ("Special", SPECIAL_DATA),
]


def generate_course(category: str, data: dict):
    """Generate one complete course folder"""
    course_dir = OUTPUT_DIR / category
    course_dir.mkdir(parents=True, exist_ok=True)

    sheet = data["sheet"]
    headers = data["headers"]
    rows = data["rows"]
    colors = data.get("colors", {})

    # 1. Create xlsx
    xlsx_path = course_dir / f"{category}.xlsx"
    create_xlsx(xlsx_path, sheet, headers, rows)

    # 2. Create object folders with media
    for row in rows:
        obj_name = row[0]
        obj_color = colors.get(obj_name, (100, 100, 100))
        obj_dir = course_dir / obj_name
        audio_dir = obj_dir / "audio"
        images_dir = obj_dir / "images"
        videos_dir = obj_dir / "videos"

        # Ensure all three directories exist even if empty
        audio_dir.mkdir(parents=True, exist_ok=True)
        images_dir.mkdir(parents=True, exist_ok=True)
        videos_dir.mkdir(parents=True, exist_ok=True)

        # Generate images (all courses get images, except Planets which has no media)
        if category != "Planets":
            # Generate 3 images per object
            for i in range(3):
                img_path = images_dir / f"{obj_name} {i:02d}.jpg"
                generate_image(img_path, 400, 300, obj_color, obj_name)

        # Generate audio (only Instruments and Dogs)
        if category in ("Instruments", "Dogs"):
            import random
            freqs = [220, 294, 349, 392, 440, 523, 659, 784]
            freq = freqs[hash(obj_name) % len(freqs)]
            wav_path = audio_dir / f"{obj_name} 00.wav"
            generate_wav(wav_path, duration_sec=2.0, freq=freq)

        # Generate videos (only Instruments)
        if category == "Instruments":
            try:
                _generate_simple_mp4(videos_dir, obj_name, obj_color)
            except Exception as e:
                print(f"    Video skipped for {obj_name}: {e} (non-critical)")

    print(f"Course '{category}' complete: {len(rows)} objects\n")


def _find_ffmpeg() -> Path | None:
    """Locate ffmpeg executable on Windows / PATH."""
    import shutil
    import os

    exe = shutil.which("ffmpeg")
    if exe:
        return Path(exe)

    # Common Windows install locations
    candidates = [
        Path(os.environ.get("LOCALAPPDATA", ""))
        / "Microsoft"
        / "WinGet"
        / "Packages"
        / "Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe"
        / "ffmpeg-8.1.1-full_build"
        / "bin"
        / "ffmpeg.exe",
    ]
    for c in candidates:
        if c.exists():
            return c
    return None


def _generate_simple_mp4(videos_dir: Path, obj_name: str, color: tuple):
    """Generate a simple 2-second valid H.264 MP4 video using ffmpeg."""
    import subprocess

    videos_dir.mkdir(parents=True, exist_ok=True)
    video_path = videos_dir / f"{obj_name} 00.mp4"

    if video_path.exists():
        return

    ffmpeg = _find_ffmpeg()
    if ffmpeg is None:
        print(f"    Video: ffmpeg not found, skipping video for {obj_name}")
        print(f"           (install ffmpeg or add it to PATH to generate playable videos)")
        return

    r, g, b = color
    hex_color = f"{r:02x}{g:02x}{b:02x}"

    cmd = [
        str(ffmpeg), "-y",
        "-f", "lavfi",
        "-i", f"color=c=0x{hex_color}:s=640x480:r=24:d=2",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-pix_fmt", "yuv420p",
        "-an",
        str(video_path),
    ]

    try:
        subprocess.run(cmd, capture_output=True, check=True, timeout=60)
        print(f"    Video: {video_path.name}")
    except subprocess.CalledProcessError as e:
        print(f"    Video: ffmpeg failed for {obj_name}: {e.stderr.decode('utf-8', errors='ignore')[:200]}")
    except (FileNotFoundError, subprocess.TimeoutExpired):
        print(f"    Video: ffmpeg unavailable, skipping video for {obj_name}")


# ========== MAIN ==========
def main():
    print("=" * 60)
    print("  Znawca Test Sample Generator")
    print("=" * 60)

    # Clean output directory
    if OUTPUT_DIR.exists():
        print(f"\nRemoving existing: {OUTPUT_DIR.name}")
        shutil.rmtree(OUTPUT_DIR)

    OUTPUT_DIR.mkdir(parents=True)

    print(f"\nGenerating 6 test courses in: {OUTPUT_DIR}\n")

    for category, data in ALL_COURSES:
        print(f"[{category}]")
        generate_course(category, data)

    # Summary
    print("=" * 60)
    print("  GENERATION COMPLETE")
    print("=" * 60)
    print(f"\nOutput: {OUTPUT_DIR}")
    print(f"\nCourses generated:")
    for cat, data in ALL_COURSES:
        print(f"  • {cat} — {len(data['rows'])} objects, sheet: '{data['sheet']}'")


if __name__ == "__main__":
    main()
