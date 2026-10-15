# -*- coding: utf-8 -*-
"""
生成「理想完整课程」示例：samples/国家示例课/

覆盖 V2 全部已定功能（对照 优化方案/需求核对清单.md）：
- 双语工作簿（_Zh / _Eng）+ 共享 media/ + 分语言 speech/
- A1 课程显示名、A2+ 主媒体多变体
- 全部属性列双向题干（首个 / 分隔、两侧必填）
- B 列 / 别名；G 列 ; 必答组 + 组内 / 别名
- H 列天然歧义值（5 国同为欧元 -> 反向题自动跳过，D-01）
- I 列 * 仅作答案；J 列 $ 仅作问题；K/L 列 # 筛选（跨列 AND）
- F7 空单元格（跳过不出题）
- correct/incorrect NN.mp3 正误提示音
媒体为占位素材（PIL 色块图、正弦音、testsrc 视频），签名真实可通过校验。
不删除任何已有文件，重复运行只覆盖同名文件。
"""
import math
import subprocess
import sys
import wave
from pathlib import Path

import openpyxl
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
COURSE = ROOT / "samples" / "国家示例课"
MEDIA = COURSE / "media"

# 每个国家：文件名键、中/英名称、中/英首都、中/英语言、中/英货币、中/英人口、中/英洲、中/英欧盟、条带色、旋律基频、视频色相
COUNTRIES = [
    ("France",      "法国/法兰西", "France",    "巴黎",   "Paris",    "法语",                            "French",                          "欧元",   "Euro",        "约6800万",  "about 68 million",   "欧洲", "Europe", "是", "Yes", [(0, 85, 164), (255, 255, 255), (239, 65, 53)], 262, 0),
    ("Germany",     "德国/德意志", "Germany",   "柏林",   "Berlin",   "德语",                            "German",                          "欧元",   "Euro",        "约8400万",  "about 84 million",   "欧洲", "Europe", "是", "Yes", [(0, 0, 0), (221, 0, 0), (255, 206, 0)],          294, 40),
    ("Italy",       "意大利",      "Italy",     "罗马",   "Rome",     "意大利语",                        "Italian",                         "欧元",   "Euro",        "约5900万",  "about 59 million",   "欧洲", "Europe", "是", "Yes", [(0, 146, 70), (255, 255, 255), (206, 43, 55)],   330, 80),
    ("Spain",       "西班牙",      "Spain",     "马德里", "Madrid",   "西班牙语/卡斯蒂利亚语",           "Spanish/Castilian",               "欧元",   "Euro",        "约4800万",  "about 48 million",   "欧洲", "Europe", "是", "Yes", [(170, 21, 27), (241, 191, 0), (170, 21, 27)],    349, 120),
    ("Belgium",     "比利时",      "Belgium",   "布鲁塞尔", "Brussels", "荷兰语/弗拉芒语; 法语; 德语",   "Dutch/Flemish; French; German",   "欧元",   "Euro",        "约1170万",  "about 11.7 million", "欧洲", "Europe", "是", "Yes", [(0, 0, 0), (253, 218, 36), (239, 51, 64)],       392, 160),
    ("Switzerland", "瑞士",        "Switzerland", "伯尔尼", "Bern",   "德语; 法语; 意大利语; 罗曼什语",  "German; French; Italian; Romansh", "瑞士法郎", "Swiss franc", "约890万",   "about 8.9 million",  "欧洲", "Europe", "否", "No",  [(218, 41, 28), (255, 255, 255), (218, 41, 28)],    440, 200),
    ("Poland",      "波兰",        "Poland",    "华沙",   "Warsaw",   "波兰语",                          "Polish",                          "兹罗提", "Zloty",       "约3800万",  "about 38 million",   "欧洲", "Europe", "是", "Yes", [(255, 255, 255), (220, 20, 60), (255, 255, 255)], 494, 240),
    ("China",       "中国",        "China/PRC", "北京",   "Beijing",  "汉语/中文",                       "Chinese/Mandarin",                "人民币/元", "Renminbi/Yuan", "约14亿", "about 1.41 billion", "亚洲", "Asia",   "否", "No",  [(222, 41, 16), (255, 222, 0), (222, 41, 16)],     523, 280),
]

HEADERS = {
    "Zh": {
        "B": "哪张图片展示了这个国家？ / 这是哪个国家？",
        "C": "这个国家的首都是哪里？ / 哪国的首都是这里？",
        "D": "哪面国旗属于这个国家？ / 这面国旗属于哪个国家？",
        "E": "哪段国歌属于这个国家？ / 这段国歌属于哪个国家？",
        "F": "哪段地标视频属于这个国家？ / 这段地标视频属于哪个国家？",
        "G": "这个国家使用哪些官方语言？ / 哪个国家使用这些官方语言？",
        "H": "这个国家使用什么货币？ / 哪个国家使用这种货币？",
        "I": "*这个国家大约有多少人口？ / 哪个国家大约有这些人口？",
        "J": "$这个国家的地图轮廓是哪一张？ / 这是哪个国家的地图轮廓？",
        "K": "#洲",
        "L": "#欧盟",
        "A1": "国家示例课（完整功能演示）",
    },
    "Eng": {
        "B": "Which image shows this country? / What country is this?",
        "C": "What is the capital of this country? / Which country has this capital?",
        "D": "Which flag belongs to this country? / Which country does this flag belong to?",
        "E": "Which anthem belongs to this country? / Which country does this anthem belong to?",
        "F": "Which landmark video belongs to this country? / Which country does this landmark video belong to?",
        "G": "Which official languages does this country use? / Which country uses these official languages?",
        "H": "What currency does this country use? / Which country uses this currency?",
        "I": "*About how many people live in this country? / Which country has about this population?",
        "J": "$Which outline map belongs to this country? / Which country does this outline map belong to?",
        "K": "#Continent",
        "L": "#EU",
        "A1": "Countries Demo Course (Full Feature)",
    },
}


def font(size: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def make_image(path: Path, stripes, label: str) -> None:
    w, h = 360, 220
    img = Image.new("RGB", (w, h), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    band = h // len(stripes)
    for i, color in enumerate(stripes):
        draw.rectangle([0, i * band, w, (i + 1) * band if i < len(stripes) - 1 else h], fill=color)
    draw.rectangle([0, 0, w - 1, h - 1], outline=(60, 60, 60), width=2)
    f = font(26)
    bbox = draw.textbbox((0, 0), label, font=f)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.rectangle([(w - tw) // 2 - 8, (h - th) // 2 - 6, (w + tw) // 2 + 8, (h + th) // 2 + 6], fill=(255, 255, 255))
    draw.text(((w - tw) // 2, (h - th) // 2), label, fill=(20, 20, 20), font=f)
    img.save(path, "JPEG", quality=88)


def make_outline(path: Path, label: str) -> None:
    w, h = 360, 220
    img = Image.new("RGB", (w, h), (245, 245, 242))
    draw = ImageDraw.Draw(img)
    draw.polygon([(90, 40), (230, 30), (300, 90), (280, 170), (180, 200), (80, 150), (60, 80)], fill=(70, 70, 70))
    draw.text((14, h - 30), label, fill=(120, 120, 120), font=font(18))
    img.save(path, "JPEG", quality=88)


def make_anthem(path: Path, base_freq: float) -> None:
    rate = 22050
    notes = [base_freq, base_freq * 1.25, base_freq * 1.5, base_freq * 1.25]
    frames = bytearray()
    for freq in notes:
        n = int(rate * 0.3)
        for i in range(n):
            sample = int(12000 * math.sin(2 * math.pi * freq * i / rate))
            frames += sample.to_bytes(2, "little", signed=True)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(rate)
        wf.writeframes(bytes(frames))


def ffmpeg(args: list) -> bool:
    try:
        result = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *args], capture_output=True, timeout=60)
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def make_video(path: Path, hue_deg: int) -> bool:
    return ffmpeg(["-f", "lavfi", "-i", f"testsrc=duration=1.5:size=320x240:rate=10",
                   "-vf", f"hue=h={hue_deg}", "-pix_fmt", "yuv420p", str(path)])


def make_feedback(path: Path, freq: int) -> bool:
    return ffmpeg(["-f", "lavfi", "-i", f"sine=frequency={freq}:duration=0.25", str(path)])


def build_workbook(lang: str) -> None:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "国家" if lang == "Zh" else "Countries"
    hd = HEADERS[lang]
    ws["A1"] = hd["A1"]
    for col in "BCDEFGHIJKL":
        ws[f"{col}1"] = hd[col]
    zi = 1 if lang == "Zh" else 2  # 名称字段在 COUNTRIES 元组中的语言偏移（capital=zi+2 … eu=zi+12）
    for idx, c in enumerate(COUNTRIES):
        row = idx + 2
        key = c[0]
        ws.cell(row=row, column=1, value=f"{key}-main-1.jpg/{key}-main-2.jpg")
        ws.cell(row=row, column=2, value=c[zi])
        ws.cell(row=row, column=3, value=c[zi + 2])
        ws.cell(row=row, column=4, value=f"{key}-flag-1.jpg/{key}-flag-2.jpg")
        ws.cell(row=row, column=5, value=f"{key}-anthem.wav")
        if key != "Switzerland":  # F7 空单元格示例：跳过不出题
            ws.cell(row=row, column=6, value=f"{key}-landmark.mp4")
        ws.cell(row=row, column=7, value=c[zi + 4])
        ws.cell(row=row, column=8, value=c[zi + 6])
        ws.cell(row=row, column=9, value=c[zi + 8])
        ws.cell(row=row, column=10, value=f"{key}-outline.jpg")
        ws.cell(row=row, column=11, value=c[zi + 10])
        ws.cell(row=row, column=12, value=c[zi + 12])
    wb.save(COURSE / f"国家示例课_{lang}.xlsx")


def try_speech() -> str:
    try:
        import edge_tts  # noqa: F401
    except ImportError:
        return "edge-tts 不可用，speech/ 留空（缺失静默跳过，不影响导入）"
    import asyncio

    async def synth() -> int:
        import edge_tts
        count = 0
        jobs = []
        for lang, voice, name_idx in (("Zh", "zh-CN-XiaoxiaoNeural", 2), ("Eng", "en-US-AriaNeural", 3)):
            out_dir = COURSE / "speech" / lang
            out_dir.mkdir(parents=True, exist_ok=True)
            for i, c in enumerate(COUNTRIES):
                row = i + 2
                text = c[name_idx].split("/")[0].split(";")[0].strip()
                jobs.append((voice, text, out_dir / f"B{row}.mp3"))
            hd = HEADERS[lang]["B"]
            fwd, rev = [p.strip() for p in hd.split("/", 1)]
            jobs.append((voice, fwd, out_dir / "B1-F.mp3"))
            jobs.append((voice, rev, out_dir / "B1-R.mp3"))
        for voice, text, out in jobs:
            try:
                await edge_tts.Communicate(text, voice).save(str(out))
                if out.stat().st_size > 0:
                    count += 1
            except Exception:
                pass
            await asyncio.sleep(0.6)  # 串行+间隔，避免并发被限流产生 0 字节文件
        return count

    try:
        n = asyncio.run(synth())
        return f"speech/ 坐标朗读 {n} 段（edge-tts 真实朗读）" if n else "TTS 全部失败，speech/ 留空（缺失静默跳过）"
    except Exception:
        return "TTS 失败，speech/ 留空（缺失静默跳过，不影响导入）"


def verify() -> None:
    on_disk = {p.name for p in MEDIA.iterdir() if p.is_file()}
    referenced = set()
    for lang in ("Zh", "Eng"):
        wb = openpyxl.load_workbook(COURSE / f"国家示例课_{lang}.xlsx")
        ws = wb[wb.sheetnames[0]]
        for row in ws.iter_rows(min_row=2, max_row=ws.max_row, max_col=12):
            for cell in row:
                v = cell.value
                if isinstance(v, str) and any(e in v for e in (".jpg", ".wav", ".mp4")):
                    referenced.update(p.strip() for p in v.split("/") if p.strip())
        wb.close()
    missing = sorted(referenced - on_disk)
    orphan = sorted(on_disk - referenced)
    sig_ok = 0
    for name in on_disk:
        head = (MEDIA / name).read_bytes()[:12]
        ext = name.rsplit(".", 1)[-1].lower()
        ok = (
            (ext == "jpg" and head[:3] == b"\xff\xd8\xff")
            or (ext == "wav" and head[:4] == b"RIFF" and head[8:12] == b"WAVE")
            or (ext == "mp4" and head[4:8] == b"ftyp")
        )
        sig_ok += 1 if ok else 0
    print(f"media/ 文件 {len(on_disk)}，引用 {len(referenced)}，缺失 {len(missing)}，孤儿 {len(orphan)}，签名通过 {sig_ok}/{len(on_disk)}")
    if missing:
        print("MISSING:", missing)
    if orphan:
        print("ORPHAN:", orphan)


def main() -> None:
    MEDIA.mkdir(parents=True, exist_ok=True)
    for key, *_rest in COUNTRIES:
        stripes = _rest[14]
        freq = _rest[15]
        hue = _rest[16]
        make_image(MEDIA / f"{key}-main-1.jpg", stripes, f"{key} main 1")
        make_image(MEDIA / f"{key}-main-2.jpg", stripes[::-1], f"{key} main 2")
        make_image(MEDIA / f"{key}-flag-1.jpg", stripes, f"{key} flag 1")
        make_image(MEDIA / f"{key}-flag-2.jpg", stripes[::-1], f"{key} flag 2")
        make_anthem(MEDIA / f"{key}-anthem.wav", float(freq))
        make_outline(MEDIA / f"{key}-outline.jpg", f"{key} outline")
        if key != "Switzerland":
            if not make_video(MEDIA / f"{key}-landmark.mp4", hue):
                print(f"ffmpeg 不可用，跳过视频 {key}-landmark.mp4（对应单元格将报缺失 warning）")
    fb_ok = make_feedback(COURSE / "correct 00.mp3", 880) and make_feedback(COURSE / "correct 01.mp3", 990) and make_feedback(COURSE / "incorrect 00.mp3", 220)
    print("正误提示音:", "3 枚 mp3 已生成" if fb_ok else "ffmpeg 不可用，未生成（缺失静默跳过）")
    build_workbook("Zh")
    build_workbook("Eng")
    print("工作簿: 国家示例课_Zh.xlsx / 国家示例课_Eng.xlsx")
    print(try_speech())
    verify()
    print(f"输出目录: {COURSE}")


if __name__ == "__main__":
    sys.exit(main())
