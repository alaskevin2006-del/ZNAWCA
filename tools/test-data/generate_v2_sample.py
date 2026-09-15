# -*- coding: utf-8 -*-
"""
ZNAWCA V2 完整测试样例生成器（对应 优化方案.md 2026-09-07 定稿 / ZNAWCA-15 D-15~D-26）

输出 samples/V2-Sample/：
  Countries/  双语言（Countries_Eng.xlsx + Countries_Ru.xlsx），覆盖全部 V2 语法
  Minerals/   单语言（Minerals_Eng.xlsx），覆盖化学式下标

覆盖点：
  D-15 A1 课程显示名 / A2+ 主媒体 / B1 名称双向题干 / B2+ 名称
  D-16 多语言工作簿 + 共享 media/ + speech/<lang>/ 分语言朗读
  D-17 单元格级属性媒体（地标图 / 国歌音频 / 首都视频）
  D-18 同格多媒体变体 `/`（波兰双旗图）；列内类别统一
  D-19 双向题干（所有非 # 列标题均含 ` / `）
  D-20 显式别名（中国货币 Renminbi/Yuan）+ `;` 必答组（国旗颜色）
  D-21 列角色标记（`*` 仅作答案＝电话区号；`$` 仅作问题＝国鸟）
  D-01 歧义反向题（波兰/日本国旗颜色相同；法德货币同为 Euro → 反向跳过）
  4.2 化学式下标（Minerals：SiO₂、CaMg(CO₃)₂、Fe₂O₃、FeS₂）
  5.1 `#` 筛选列（#Continent、#Eurozone → OR/AND 组合）
  D-22/D-23 speech 坐标朗读（B1-F/B1-R/C4…；Eng/Ru 同坐标不同录音）
      → edge-tts 朗读单元格真实文本（En: en-US-AriaNeural / Ru: ru-RU-SvetlanaNeural），
        一听即可验证坐标→音频的调用对应关系；网络不可用时回退合成音
  D-12 correct/incorrect NN.mp3 正误提示音（各 2 个，验随机不连播）
      → 下载 Google Actions 音效库（https://actions.google.com/sounds/v1/，免费使用）
        转 mp3；下载失败回退 ffmpeg 合成。Minerals 同样配备。

用法：venv（含 Pillow + openpyxl + edge-tts）执行：
  C:/Users/Kevin/.workbuddy/binaries/python/envs/default/Scripts/python.exe tools/test-data/generate_v2_sample.py
"""

import math
import shutil
import struct
import subprocess
import wave
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "samples" / "V2-Sample"

# ============================================================ helpers


def find_ffmpeg() -> Path:
    exe = shutil.which("ffmpeg")
    if exe:
        return Path(exe)
    candidate = (
        Path.home() / "AppData" / "Local" / "Microsoft" / "WinGet" / "Packages"
        / "Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe"
        / "ffmpeg-8.1.1-full_build" / "bin" / "ffmpeg.exe"
    )
    if candidate.exists():
        return candidate
    raise SystemExit("ffmpeg not found (needed for mp3/mp4)")


def create_xlsx(path: Path, sheet: str, header_row: list, rows: list, col_widths=None):
    """header_row: 第 1 行完整内容（A1 是课程显示名，B1+ 是标题）。"""
    wb = Workbook()
    ws = wb.active
    ws.title = sheet
    green = PatternFill(start_color="315C46", end_color="315C46", fill_type="solid")
    gold = PatternFill(start_color="A67C2E", end_color="A67C2E", fill_type="solid")
    grey = PatternFill(start_color="5A5A5A", end_color="5A5A5A", fill_type="solid")
    white_bold = Font(color="FFFFFF", bold=True, size=11)
    thin = Border(left=Side("thin"), right=Side("thin"), top=Side("thin"), bottom=Side("thin"))

    for c, value in enumerate(header_row, 1):
        cell = ws.cell(row=1, column=c, value=value)
        if c == 1:
            cell.fill = gold
        elif str(value).startswith("#"):
            cell.fill = grey
        else:
            cell.fill = green
        cell.font = white_bold
        cell.border = thin
        cell.alignment = Alignment(wrap_text=True, vertical="center", horizontal="center")

    for r, row in enumerate(rows, 2):
        for c, value in enumerate(row, 1):
            cell = ws.cell(row=r, column=c, value=value)
            cell.border = thin
            cell.alignment = Alignment(wrap_text=True, vertical="top")

    for c in range(1, len(header_row) + 1):
        letter = ws.cell(row=1, column=c).column_letter
        width = (col_widths or {}).get(c, 24 if c > 1 else 30)
        ws.column_dimensions[letter].width = width
    wb.save(str(path))
    print(f"  workbook: {path.relative_to(ROOT)}")


def image_flag(path: Path, bands, vertical=False, badge=None, size=(300, 200)):
    """bands: 颜色列表（横条或竖条）；badge: (颜色, 半径) 圆形徽记。"""
    from PIL import Image, ImageDraw

    w, h = size
    img = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(img)
    n = len(bands)
    if vertical:
        for i, color in enumerate(bands):
            draw.rectangle([w * i // n, 0, w * (i + 1) // n - 1, h - 1], fill=color)
    else:
        for i, color in enumerate(bands):
            draw.rectangle([0, h * i // n, w - 1, h * (i + 1) // n - 1], fill=color)
    if badge:
        color, radius = badge
        draw.ellipse([w // 2 - radius, h // 2 - radius, w // 2 + radius, h // 2 + radius], fill=color)
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(str(path))
    print(f"  image:   {path.name}")


def image_labeled(path: Path, bg, label, size=(400, 300)):
    from PIL import Image, ImageDraw, ImageFont

    img = Image.new("RGB", size, bg)
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("arialbd.ttf", size[1] // 12)
    except OSError:
        font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), label, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((size[0] - tw) // 2 + 2, (size[1] - th) // 2 + 2), label, fill=(0, 0, 0), font=font)
    draw.text(((size[0] - tw) // 2, (size[1] - th) // 2), label, fill=(255, 255, 255), font=font)
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(str(path))
    print(f"  image:   {path.name}")


def wav_tone(path: Path, freqs, note_sec=0.35, sample_rate=44100):
    """多音符提示音（每音符带淡入淡出）。"""
    path.parent.mkdir(parents=True, exist_ok=True)
    frames = []
    fade = int(sample_rate * 0.05)
    for freq in freqs:
        n = int(sample_rate * note_sec)
        for i in range(n):
            value = 14000 * math.sin(2 * math.pi * freq * i / sample_rate)
            if i < fade:
                value *= i / fade
            elif i > n - fade:
                value *= (n - i) / fade
            frames.append(int(value))
    with wave.open(str(path), "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(struct.pack("<" + "h" * len(frames), *frames))
    print(f"  audio:   {path.name}  ({' '.join(str(f) for f in freqs)} Hz)")


def ffmpeg_audio(path: Path, freq: float, duration=0.4):
    path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [str(FFMPEG), "-y", "-f", "lavfi", "-i", f"sine=frequency={freq}:duration={duration}",
         "-q:a", "4", str(path)],
        capture_output=True, check=True, timeout=60,
    )
    print(f"  mp3:     {path.name}  ({freq} Hz)")


def ffmpeg_video(path: Path, rgb: tuple, duration=2):
    path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [str(FFMPEG), "-y", "-f", "lavfi",
         "-i", f"color=c=0x{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}:s=320x240:r=24:d={duration}",
         "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-an", str(path)],
        capture_output=True, check=True, timeout=120,
    )
    print(f"  video:   {path.name}")


# ============================================================ speech (TTS) / feedback SFX

TTS_VOICES = {"Eng": "en-US-AriaNeural", "Ru": "ru-RU-SvetlanaNeural"}

# Google Actions 音效库（免费使用，https://developers.google.com/assistant/tools/sound-library）
SFX_SOURCES = {
    "correct 00": "https://actions.google.com/sounds/v1/cartoon/pop.ogg",
    "correct 01": "https://actions.google.com/sounds/v1/sports/bowling_strike.ogg",
    "incorrect 00": "https://actions.google.com/sounds/v1/impacts/crash.ogg",
    "incorrect 01": "https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg",
}


def build_speech(course: Path, lang: str, entries):
    """entries: [(stem, text)] → speech/<lang>/<stem>.wav。

    用 edge-tts 朗读单元格真实文本（坐标→内容一一对应，手工验收一听即辨）；
    网络/服务不可用时回退合成音（保证脚本离线可跑）。
    """
    import asyncio

    import edge_tts

    out_dir = course / "speech" / lang
    out_dir.mkdir(parents=True, exist_ok=True)
    voice = TTS_VOICES[lang]
    fallback = 0

    async def synth(stem: str, text: str) -> bool:
        """流式取 TTS 音频字节 → ffmpeg stdin → wav，全程不落临时文件。"""
        try:
            com = edge_tts.Communicate(text, voice)
            buf = bytearray()
            async for chunk in com.stream():
                if chunk["type"] == "audio":
                    buf.extend(chunk["data"])
            if not buf:
                raise ValueError("no audio received")
        except Exception as exc:  # noqa: BLE001 —— 任何网络/服务失败都回退
            print(f"  speech:  {lang}/{stem}.wav  TTS 失败（{type(exc).__name__}）→ 合成音回退")
            return False
        subprocess.run([str(FFMPEG), "-y", "-i", "pipe:0", str(out_dir / f"{stem}.wav")],
                       input=bytes(buf), capture_output=True, check=True, timeout=60)
        return True

    async def worker(stem: str, text: str, sem):
        nonlocal fallback
        async with sem:
            if not await synth(stem, text):
                freq = 400 + (sum(ord(ch) for ch in stem) % 400)
                wav_tone(out_dir / f"{stem}.wav", [freq], note_sec=0.45)
                fallback += 1

    async def run():
        sem = asyncio.Semaphore(4)
        await asyncio.gather(*(worker(stem, text, sem) for stem, text in entries))

    asyncio.run(run())
    note = f"，回退合成音 {fallback} 段" if fallback else ""
    print(f"  speech:  {lang}/ 共 {len(entries)} 段（{voice}{note}）")


def build_feedback_sounds(course: Path):
    """correct/incorrect NN.mp3：下载 Google 音效库 ogg 转 mp3；失败回退 ffmpeg 合成。"""
    import urllib.request

    for name, url in SFX_SOURCES.items():
        dest = course / f"{name}.mp3"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            data = urllib.request.urlopen(req, timeout=30).read()
            if not data.startswith(b"OggS"):
                raise ValueError("response is not ogg")
            # ogg 字节直接喂 ffmpeg stdin，不落临时文件
            subprocess.run([str(FFMPEG), "-y", "-i", "pipe:0", "-q:a", "4", str(dest)],
                           input=data, capture_output=True, check=True, timeout=60)
            print(f"  sfx:     {name}.mp3  (Google 音效库, {len(data) // 1024} KB)")
        except Exception as exc:  # noqa: BLE001
            freq = (880 if name.startswith("correct") else 220) + int(name[-2:]) * 12
            ffmpeg_audio(dest, freq)
            print(f"  sfx:     {name}.mp3  下载失败（{type(exc).__name__}）→ 合成音回退")


# ============================================================ Countries

WHITE = (244, 244, 244)
RED = (214, 40, 57)
BLUE = (0, 85, 164)
BLACK = (20, 20, 20)
GOLD = (255, 200, 40)
YELLOW = (255, 222, 64)
GREEN = (52, 120, 86)

# A 主媒体 / B 名称 / C 首都 / D 国旗颜色 / E 地标图 / F 国歌音频 / G 首都视频
# H 货币（Euro 重复→反向歧义跳过；Renminbi/Yuan→别名） / I 电话区号（* 仅作答案）
# J 国鸟（$ 仅作问题） / K #Continent / L #Eurozone
COUNTRIES_COLUMNS_EN = [
    "Countries of the World",
    "Which flag shows this country? / Which country does this flag belong to?",
    "What is the capital? / Which country has this capital?",
    "What colors are on the flag? / Which country has these flag colors?",
    "Which landmark is in this country? / Which country is this landmark in?",
    "Which anthem belongs to this country? / Which country does this anthem belong to?",
    "Which video shows the capital? / Which country is shown in this video?",
    "What is the currency? / Which country uses this currency?",
    "*What is the calling code? / Which country has this calling code?",
    "$Which is the national animal? / Which country has this national animal?",
    "#Continent",
    "#Eurozone",
]

COUNTRIES_COLUMNS_RU = [
    "Страны мира",
    "Какой флаг у этой страны? / Какой стране принадлежит этот флаг?",
    "Какая у неё столица? / У какой страны эта столица?",
    "Какие цвета на флаге? / У какой страны эти цвета флага?",
    "Какая достопримечательность в этой стране? / В какой стране эта достопримечательность?",
    "Какой гимн у этой страны? / Какой стране принадлежит этот гимн?",
    "Какое видео показывает столицу? / Какая страна показана на видео?",
    "Какая у неё валюта? / В какой стране эта валюта?",
    "*Какой у неё телефонный код? / У какой страны этот телефонный код?",
    "$Какое у неё национальное животное? / У какой страны это национальное животное?",
    "#Континент",
    "#Еврозона",
]

# 每行：主媒体引用、英文名、俄文名、首都EN、首都RU、颜色EN、颜色RU、
#        地标文件、国歌文件、视频文件、货币EN、货币RU、区号、国鸟EN、国鸟RU、大洲EN/RU、欧元区EN/RU
COUNTRIES_ROWS = [
    dict(key="pl", flag="pl-flag.png/pl-flag-waving.jpg",
         name_en="Poland", name_ru="Польша",
         capital_en="Warsaw", capital_ru="Варшава",
         colors_en="White; Red", colors_ru="Белый; Красный",
         landmark="pl-landmark.jpg", anthem="pl-anthem.wav", video="cap-pl.mp4",
         currency_en="Zloty", currency_ru="Злотый",
         code="+48", animal_en="White-tailed eagle", animal_ru="Белоголовый орёл",
         continent_en="Europe", continent_ru="Европа",
         euro_en="No", euro_ru="Нет",
         flag_bands=[WHITE, RED], video_rgb=(120, 60, 60), anthem_freqs=[392, 494, 587],
         landmark_rgb=(140, 90, 60)),
    dict(key="fr", flag="fr-flag.jpg",
         name_en="France", name_ru="Франция",
         capital_en="Paris", capital_ru="Париж",
         colors_en="Blue; White; Red", colors_ru="Синий; Белый; Красный",
         landmark="fr-landmark.jpg", anthem="fr-anthem.wav", video="cap-fr.mp4",
         currency_en="Euro", currency_ru="Евро",
         code="+33", animal_en="Gallic rooster", animal_ru="Галльский петух",
         continent_en="Europe", continent_ru="Европа",
         euro_en="Yes", euro_ru="Да",
         flag_bands=[BLUE, WHITE, RED], vertical=True, video_rgb=(60, 60, 140), anthem_freqs=[440, 554, 659],
         landmark_rgb=(120, 120, 160)),
    dict(key="de", flag="de-flag.jpg",
         name_en="Germany", name_ru="Германия",
         capital_en="Berlin", capital_ru="Берлин",
         colors_en="Black; Red; Gold", colors_ru="Чёрный; Красный; Золотой",
         landmark="de-landmark.jpg", anthem="de-anthem.wav", video="cap-de.mp4",
         currency_en="Euro", currency_ru="Евро",
         code="+49", animal_en="Golden eagle", animal_ru="Беркут",
         continent_en="Europe", continent_ru="Европа",
         euro_en="Yes", euro_ru="Да",
         flag_bands=[BLACK, RED, GOLD], video_rgb=(70, 70, 70), anthem_freqs=[494, 587, 740],
         landmark_rgb=(100, 100, 100)),
    dict(key="cn", flag="cn-flag.jpg",
         name_en="China", name_ru="Китай",
         capital_en="Beijing", capital_ru="Пекин",
         colors_en="Red; Yellow", colors_ru="Красный; Жёлтый",
         landmark="cn-landmark.jpg", anthem="cn-anthem.wav", video="cap-cn.mp4",
         currency_en="Renminbi/Yuan", currency_ru="Юань/Жэньминьби",
         code="+86", animal_en="Giant panda", animal_ru="Большая панда",
         continent_en="Asia", continent_ru="Азия",
         euro_en="No", euro_ru="Нет",
         flag_bands=[RED], badge=(YELLOW, 34), video_rgb=(160, 40, 40), anthem_freqs=[523, 659, 784],
         landmark_rgb=(170, 60, 50)),
    dict(key="ru", flag="ru-flag.jpg",
         name_en="Russia", name_ru="Россия",
         capital_en="Moscow", capital_ru="Москва",
         colors_en="White; Blue; Red", colors_ru="Белый; Синий; Красный",
         landmark="ru-landmark.jpg", anthem="ru-anthem.wav", video="cap-ru.mp4",
         currency_en="Rouble", currency_ru="Рубль",
         code="+7", animal_en="Double-headed eagle", animal_ru="Двуглавый орёл",
         continent_en="Europe", continent_ru="Европа",
         euro_en="No", euro_ru="Нет",
         flag_bands=[WHITE, BLUE, RED], video_rgb=(60, 80, 160), anthem_freqs=[349, 440, 523],
         landmark_rgb=(90, 100, 150)),
    dict(key="jp", flag="jp-flag.jpg",
         name_en="Japan", name_ru="Япония",
         capital_en="Tokyo", capital_ru="Токио",
         colors_en="White; Red", colors_ru="Белый; Красный",
         landmark="jp-landmark.jpg", anthem="jp-anthem.wav", video="cap-jp.mp4",
         currency_en="Yen", currency_ru="Иена",
         code="+81", animal_en="Green pheasant", animal_ru="Зелёный фазан",
         continent_en="Asia", continent_ru="Азия",
         euro_en="No", euro_ru="Нет",
         flag_bands=[WHITE], badge=(RED, 40), video_rgb=(180, 180, 190), anthem_freqs=[587, 740, 880],
         landmark_rgb=(150, 150, 160)),
]


def speech_entries_countries(lang: str):
    """B=名称 / C=首都 / D=国旗颜色 / H=货币 列的坐标→朗读文本映射（含 D 列必答组）。"""
    headers = COUNTRIES_COLUMNS_EN if lang == "Eng" else COUNTRIES_COLUMNS_RU
    entries = []
    for letter, idx in (("B", 1), ("C", 2), ("D", 3), ("H", 7)):
        forward, reverse = headers[idx].split(" / ")
        entries.append((f"{letter}1-F", forward.lstrip("*$").strip()))
        entries.append((f"{letter}1-R", reverse.strip()))
    for i, row in enumerate(COUNTRIES_ROWS, 2):
        if lang == "Eng":
            entries.append((f"B{i}", row["name_en"]))
            entries.append((f"C{i}", row["capital_en"]))
            entries.append((f"D{i}", row["colors_en"].replace("; ", " and ")))
            entries.append((f"H{i}", row["currency_en"].replace("/", ", ")))
        else:
            entries.append((f"B{i}", row["name_ru"]))
            entries.append((f"C{i}", row["capital_ru"]))
            entries.append((f"D{i}", row["colors_ru"].replace("; ", " и ")))
            entries.append((f"H{i}", row["currency_ru"].replace("/", ", ")))
    return entries


def build_countries(course: Path):
    course.mkdir(parents=True, exist_ok=True)
    media = course / "media"

    print("[Countries] media/")
    for row in COUNTRIES_ROWS:
        image_flag(media / row["flag"].split("/")[0], row["flag_bands"],
                   vertical=row.get("vertical", False), badge=row.get("badge"))
        if "/" in row["flag"]:
            # 同格多变体：另一张波兰旗（横幅比例 + 色差，方便肉眼区分随机选中的变体）
            image_flag(media / row["flag"].split("/")[1], row["flag_bands"],
                       vertical=row.get("vertical", False), badge=row.get("badge"), size=(360, 180))
        image_labeled(media / row["landmark"], row["landmark_rgb"],
                      f"{row['name_en']} landmark")
        wav_tone(media / row["anthem"], row["anthem_freqs"])
        ffmpeg_video(media / row["video"], row["video_rgb"])

    print("[Countries] feedback sounds/")
    build_feedback_sounds(course)

    print("[Countries] speech/")
    for lang in ("Eng", "Ru"):
        build_speech(course, lang, speech_entries_countries(lang))

    print("[Countries] workbooks/")
    rows_en = [
        [r["flag"], r["name_en"], r["capital_en"], r["colors_en"], r["landmark"], r["anthem"],
         r["video"], r["currency_en"], r["code"], r["animal_en"], r["continent_en"], r["euro_en"]]
        for r in COUNTRIES_ROWS
    ]
    rows_ru = [
        [r["flag"], r["name_ru"], r["capital_ru"], r["colors_ru"], r["landmark"], r["anthem"],
         r["video"], r["currency_ru"], r["code"], r["animal_ru"], r["continent_ru"], r["euro_ru"]]
        for r in COUNTRIES_ROWS
    ]
    widths = {1: 30, 3: 14, 4: 18, 8: 12, 9: 11, 11: 20, 12: 12}
    create_xlsx(course / "Countries_Eng.xlsx", "Countries", COUNTRIES_COLUMNS_EN, rows_en, widths)
    create_xlsx(course / "Countries_Ru.xlsx", "Страны", COUNTRIES_COLUMNS_RU, rows_ru, widths)


# ============================================================ Minerals

MINERALS_COLUMNS = [
    "Minerals",
    "Which photo shows this mineral? / What mineral is it?",
    "What is its chemical formula? / Which mineral has this formula?",
    "What is its Mohs hardness? / Which mineral has this hardness?",
    "#Crystal system",
]

MINERALS_ROWS = [
    dict(name="Quartz", image="quartz.png", formula="SiO₂", hardness="7", system="Trigonal",
         rgb=(200, 200, 210)),
    dict(name="Dolomite", image="dolomite.png", formula="CaMg(CO₃)₂", hardness="3.5–4", system="Trigonal",
         rgb=(220, 210, 190)),
    dict(name="Hematite", image="hematite.png", formula="Fe₂O₃", hardness="5.5–6.5", system="Trigonal",
         rgb=(130, 60, 50)),
    dict(name="Pyrite", image="pyrite.png", formula="FeS₂", hardness="6–6.5", system="Isometric",
         rgb=(190, 160, 60)),
]


def speech_entries_minerals():
    """B=名称 / C=化学式 / D=硬度 列的坐标→朗读文本映射（下标数字转普通数字便于朗读）。"""
    entries = []
    for letter, idx in (("B", 1), ("C", 2), ("D", 3)):
        forward, reverse = MINERALS_COLUMNS[idx].split(" / ")
        entries.append((f"{letter}1-F", forward.strip()))
        entries.append((f"{letter}1-R", reverse.strip()))
    subs = str.maketrans("₀₁₂₃₄₅₆₇₈₉", "0123456789")
    for i, row in enumerate(MINERALS_ROWS, 2):
        entries.append((f"B{i}", row["name"]))
        entries.append((f"C{i}", row["formula"].translate(subs)))
        entries.append((f"D{i}", row["hardness"].replace("–", " to ")))
    return entries


def build_minerals(course: Path):
    course.mkdir(parents=True, exist_ok=True)
    media = course / "media"

    print("[Minerals] media/")
    for row in MINERALS_ROWS:
        image_labeled(media / row["image"], row["rgb"], row["name"], size=(300, 300))

    print("[Minerals] feedback sounds/")
    build_feedback_sounds(course)

    print("[Minerals] speech/")
    build_speech(course, "Eng", speech_entries_minerals())

    print("[Minerals] workbook/")
    rows = [[r["image"], r["name"], r["formula"], r["hardness"], r["system"]] for r in MINERALS_ROWS]
    create_xlsx(course / "Minerals_Eng.xlsx", "Minerals", MINERALS_COLUMNS, rows,
                {1: 22, 3: 18, 4: 14, 5: 16})


# ============================================================ main


def main():
    global FFMPEG
    FFMPEG = find_ffmpeg()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    print(f"output: {OUTPUT}\n")
    build_countries(OUTPUT / "Countries")
    print()
    build_minerals(OUTPUT / "Minerals")
    print("\ndone.")


if __name__ == "__main__":
    main()
