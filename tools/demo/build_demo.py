"""
Znawca Instruments Demo — 完善的演示用例生成器

覆盖需求文档中全部媒体格式:
  图片: JPG, PNG, WEBP, BMP, GIF
  音频: WAV, MP3, M4A
  视频: MP4

每件乐器：手工绘制的简化形状图片 + 合成音频 + 动画视频
"""
import math
import struct
import wave
import subprocess
import shutil
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUTPUT = Path("C:/Users/Kevin/Desktop/Instruments Demo")
FFMPEG = None

# ===========================================================
#  ffmpeg 定位
# ===========================================================
def find_ffmpeg():
    global FFMPEG
    exe = shutil.which("ffmpeg")
    if not exe:
        cand = (
            Path(os.environ.get("LOCALAPPDATA", ""))
            / "Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.1-full_build/bin/ffmpeg.exe"
        )
        if cand.exists():
            exe = str(cand)
    FFMPEG = exe
    return FFMPEG

# ===========================================================
#  字体加载
# ===========================================================
def _get_font(size: int):
    """尝试加载系统字体，失败则用默认"""
    candidates = [
        "C:/Windows/Fonts/msyh.ttc",       # 微软雅黑
        "C:/Windows/Fonts/segoeui.ttf",    # Segoe UI
        "C:/Windows/Fonts/arial.ttf",
    ]
    for p in candidates:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()

# ===========================================================
#  图片生成 — 绘制乐器形状
# ===========================================================
W, H = 640, 480
FONT_TITLE = _get_font(32)
FONT_LABEL = _get_font(18)
FONT_SMALL = _get_font(14)

def make_bg(draw, color_top, color_bot):
    """渐变背景"""
    for y in range(H):
        r = int(color_top[0] + (color_bot[0] - color_top[0]) * y / H)
        g = int(color_top[1] + (color_bot[1] - color_top[1]) * y / H)
        b = int(color_top[2] + (color_bot[2] - color_top[2]) * y / H)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

def draw_title(img, name: str, sub: str = ""):
    """在图片底部叠加半透明标题栏 + 乐器名"""
    draw = ImageDraw.Draw(img)
    # 标题栏
    bar = Image.new("RGBA", (W, 70), (0, 0, 0, 140))
    img.paste(bar, (0, H - 70), bar)
    draw = ImageDraw.Draw(img)
    draw.text((20, H - 62), name, fill=(255, 255, 255), font=FONT_TITLE)
    if sub:
        draw.text((24, H - 30), sub, fill=(200, 200, 200), font=FONT_SMALL)
    return img

def shadow_circle(draw, cx, cy, r, fill, blur=3):
    """带模糊阴影的圆"""
    for i in range(blur, 0, -1):
        alpha = int(60 / (i + 1))
        draw.ellipse([cx - r - i, cy - r - i, cx + r + i, cy + r + i],
                      fill=(0, 0, 0, alpha))
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill)

# ----- 各乐器绘制函数 -----

def draw_piano(canvas: ImageDraw, img: Image):
    """钢琴键盘"""
    cx, cy = W // 2, 200
    kw, kh = 48, 180
    n_keys = 8
    start_x = cx - (n_keys * kw) // 2
    # 白色键
    for i in range(n_keys):
        x = start_x + i * kw
        canvas.rectangle([x + 1, cy, x + kw - 1, cy + kh],
                         fill=(245, 245, 245), outline=(180, 180, 180))
    # 黑色键
    black_indices = [0, 1, 3, 4, 5]
    for i in black_indices:
        x = start_x + i * kw + kw * 2 // 3
        canvas.rectangle([x, cy, x + kw * 2 // 3, cy + kh * 3 // 5],
                         fill=(30, 30, 30), outline=(10, 10, 10))

def draw_violin(canvas: ImageDraw, img: Image):
    """小提琴 — 沙漏形琴身 + 指板 + f 孔"""
    cx, cy = W // 2, 230
    # 琴身沙漏形
    body = []
    for angle in range(0, 361, 2):
        rad = math.radians(angle)
        r = 75 + 35 * math.cos(2 * rad)  # 沙漏形
        x = cx + int(r * math.cos(rad))
        y = cy + int(r * math.sin(rad))
        body.append((x, y))
    canvas.polygon(body, fill=(180, 120, 70), outline=(100, 60, 30))
    # 指板
    canvas.rectangle([cx - 6, cy - 160, cx + 6, cy], fill=(50, 30, 20), outline=(30, 15, 10))
    # f 孔
    canvas.arc([cx - 35, cy - 40, cx - 15, cy + 40], 300, 60,
               fill=(80, 40, 20), width=2)
    canvas.arc([cx + 15, cy - 40, cx + 35, cy + 40], 120, 240,
               fill=(80, 40, 20), width=2)
    # 琴马
    canvas.rectangle([cx - 20, cy - 4, cx + 20, cy + 4], fill=(60, 35, 20))
    # 琴弦
    for dy in [-20, -6, 6, 20]:
        canvas.line([(cx + dy // 3, cy - 160), (cx + dy // 3, cy)], fill=(220, 200, 170), width=1)

def draw_trumpet(canvas: ImageDraw, img: Image):
    """小号 — 管道 + 三个活塞 + 喇叭口"""
    cx, cy = W // 2 + 20, 220
    # 主横管
    canvas.rectangle([cx - 100, cy - 14, cx + 100, cy + 14],
                     fill=(218, 165, 32), outline=(160, 120, 20))
    # 喇叭口
    canvas.polygon([
        (cx + 80, cy - 14), (cx + 170, cy - 70),
        (cx + 190, cy), (cx + 170, cy + 70), (cx + 80, cy + 14)
    ], fill=(240, 190, 50), outline=(180, 140, 30))
    # 三个活塞
    for dx in [-30, 0, 30]:
        canvas.rectangle([cx + dx - 8, cy - 40, cx + dx + 8, cy - 14],
                         fill=(200, 180, 180), outline=(150, 130, 130))
        shadow_circle(canvas, cx + dx, cy - 44, 7, (220, 200, 200))
    # 吹嘴
    canvas.rectangle([cx - 115, cy - 5, cx - 100, cy + 5],
                     fill=(180, 160, 140))

def draw_flute(canvas: ImageDraw, img: Image):
    """长笛 — 银色长管 + 按键"""
    cx, cy = W // 2, 200
    # 管身
    canvas.rounded_rectangle([cx - 180, cy - 10, cx + 180, cy + 10],
                             radius=10, fill=(192, 192, 192), outline=(140, 140, 140))
    # 高光
    canvas.line([(cx - 170, cy - 4), (cx + 170, cy - 4)], fill=(230, 230, 230), width=2)
    # 按键
    for dx in [-100, -50, 0, 50, 100]:
        canvas.ellipse([cx + dx - 7, cy - 14, cx + dx + 7, cy], fill=(160, 160, 160))
        canvas.ellipse([cx + dx - 5, cy - 12, cx + dx + 5, cy - 2], fill=(200, 200, 200))
    # 吹口
    canvas.ellipse([cx - 190, cy - 5, cx - 170, cy + 5], fill=(180, 180, 180))

def draw_guitar(canvas: ImageDraw, img: Image):
    """电吉他 — 实心琴体"""
    cx, cy = W // 2, 180
    # 琴体（下半部大圆 + 上半部小圆，梨形）
    body_pts = []
    for angle in range(0, 361, 3):
        rad = math.radians(angle)
        r = 80
        if angle < 180:
            r = 80 - 25 * math.sin(rad)  # 上部收窄
        x = cx + int(r * math.cos(rad))
        y = cy + 40 + int(r * math.sin(rad))
        body_pts.append((x, y))
    canvas.polygon(body_pts, fill=(200, 50, 50), outline=(140, 20, 20))
    # 护板
    canvas.ellipse([cx - 25, cy + 10, cx + 25, cy + 70], fill=(180, 40, 40), outline=(150, 30, 30))
    # 琴颈
    canvas.rectangle([cx - 10, cy - 160, cx + 10, cy + 10], fill=(101, 67, 33), outline=(70, 40, 20))
    # 品格
    for dy in [-140, -120, -100, -80, -60, -40, -20]:
        canvas.line([(cx - 10, cy + dy), (cx + 10, cy + dy)], fill=(200, 200, 200), width=1)
    # 拾音器
    for dx in [-15, 15]:
        canvas.rectangle([cx + dx - 10, cy + 20, cx + dx + 10, cy + 40],
                         fill=(50, 50, 50), outline=(30, 30, 30))
    # 琴头
    canvas.rectangle([cx - 12, cy - 170, cx + 12, cy - 130], fill=(80, 50, 30))
    # 弦钮
    for dy in [-160, -145]:
        for dx in [-14, 14]:
            canvas.ellipse([cx + dx - 4, cy + dy - 4, cx + dx + 4, cy + dy + 4],
                           fill=(220, 220, 220))

def draw_saxophone(canvas: ImageDraw, img: Image):
    """萨克斯 — J 形管体"""
    cx, cy = 300, 140
    # U 形弯管底部
    canvas.ellipse([cx - 30, cy + 140, cx + 30, cy + 200], fill=(255, 215, 0), outline=(200, 160, 0))
    # 上升管
    w_body = 24
    canvas.rectangle([cx - w_body, cy + 60, cx + w_body, cy + 170],
                     fill=(255, 215, 0), outline=(200, 160, 0))
    # 主体管
    canvas.rectangle([cx - w_body, cy, cx + w_body, cy + 100],
                     fill=(255, 215, 0), outline=(200, 160, 0))
    # 弯脖
    canvas.arc([cx - 40, cy - 40, cx + 40, cy + 40], 270, 90,
               fill=(255, 215, 0), width=w_body)
    # 吹嘴
    mouth_x, mouth_y = cx, cy - 40
    canvas.rectangle([mouth_x - 4, mouth_y - 20, mouth_x + 4, mouth_y],
                     fill=(50, 50, 50))
    # 喇叭口
    canvas.polygon([
        (cx - 50, cy + 180), (cx + 50, cy + 180),
        (cx + 35, cy + 260), (cx - 35, cy + 260)
    ], fill=(255, 215, 0), outline=(200, 160, 0))
    # 按键
    for dy in [20, 60, 100, 140]:
        canvas.ellipse([cx + 28, cy + dy - 6, cx + 44, cy + dy + 6],
                       fill=(220, 220, 220), outline=(160, 160, 160))

def draw_djembe(canvas: ImageDraw, img: Image):
    """非洲鼓 — 沙漏形鼓身"""
    cx, cy = W // 2, 200
    # 鼓面
    canvas.ellipse([cx - 80, cy - 100, cx + 80, cy - 40], fill=(210, 190, 150),
                   outline=(160, 130, 90))
    # 鼓身沙漏形
    for dy in range(-40, 180):
        progress = (dy + 40) / 220
        r = 80 - 55 * math.sin(progress * math.pi)  # 先收窄再放宽
        alpha = int(180 + 75 * math.sin(progress * math.pi))
        canvas.line([(cx - int(r), cy + dy), (cx + int(r), cy + dy)],
                    fill=(alpha, 70, 40))
    # 底部
    canvas.ellipse([cx - 60, cy + 180, cx + 60, cy + 200],
                   fill=(120, 50, 30), outline=(80, 30, 15))
    # 鼓面纹理
    for i in range(3):
        dr = 80 - i * 5
        canvas.ellipse([cx - dr, cy - 100 + i * 5, cx + dr, cy - 40 - i * 5],
                       fill=None, outline=(180, 150, 120), width=1)

def draw_shamisen(canvas: ImageDraw, img: Image):
    """三味线 — 方琴身 + 长颈"""
    cx, cy = W // 2, 220
    # 琴身方形
    body_w, body_h = 70, 80
    canvas.rounded_rectangle(
        [cx - body_w, cy + 10, cx + body_w, cy + 10 + body_h],
        radius=8, fill=(180, 140, 100), outline=(120, 80, 50)
    )
    # 琴皮纹理线
    for dy in [20, 40, 60]:
        canvas.line(
            [(cx - body_w + 10, cy + 10 + dy), (cx + body_w - 10, cy + 10 + dy)],
            fill=(200, 170, 140), width=1
        )
    # 琴颈
    canvas.rectangle([cx - 8, cy - 140, cx + 8, cy + 10],
                     fill=(120, 70, 40), outline=(80, 40, 20))
    # 三根弦
    for dx in [-3, 0, 3]:
        canvas.line([(cx + dx, cy - 140), (cx + dx, cy + 80)], fill=(230, 220, 200), width=1)
    # 琴马
    canvas.rectangle([cx - 30, cy + 60, cx + 30, cy + 66], fill=(60, 40, 20))
    # 琴头
    canvas.rectangle([cx - 12, cy - 155, cx + 12, cy - 135],
                     fill=(80, 50, 30))

# 乐器绘图函数表
DRAW_FUNCS = {
    "Piano": draw_piano,
    "Violin": draw_violin,
    "Trumpet": draw_trumpet,
    "Flute": draw_flute,
    "Electric Guitar": draw_guitar,
    "Saxophone": draw_saxophone,
    "Djembe": draw_djembe,
    "Shamisen": draw_shamisen,
}

# 每件乐器的配色方案（用于渐变背景）
INSTRUMENT_THEMES = {
    "Piano":        ((30, 30, 40),   (10, 10, 20),   "Keyboard / Percussion"),
    "Violin":       ((80, 40, 30),   (40, 20, 15),   "Strings"),
    "Trumpet":      ((120, 90, 30),  (60, 40, 15),   "Brass"),
    "Flute":        ((80, 80, 90),   (40, 40, 50),   "Woodwinds"),
    "Electric Guitar": ((80, 20, 20),(40, 10, 10),   "Strings / Electronic"),
    "Saxophone":    ((120, 100, 20), (60, 50, 10),   "Woodwinds / Jazz"),
    "Djembe":       ((100, 50, 30),  (50, 20, 10),   "Percussion"),
    "Shamisen":     ((100, 80, 40),  (50, 40, 20),   "Strings / Traditional"),
}


def generate_images(obj_dir: Path, name: str, formats: list[str]):
    """生成指定格式的乐器图片"""
    images_dir = obj_dir / "images"
    images_dir.mkdir(parents=True, exist_ok=True)

    color_top, color_bot, family = INSTRUMENT_THEMES[name]
    draw_func = DRAW_FUNCS[name]

    for i, fmt in enumerate(formats):
        ext = fmt.lower()
        path = images_dir / f"{name} {i:02d}.{ext}"

        # RGBA 画布
        img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        canvas = ImageDraw.Draw(img)

        make_bg(canvas, color_top, color_bot)
        draw_func(canvas, img)
        draw_title(img, name, family)

        # 保存
        save_kwargs = {}
        if ext in ("jpg", "jpeg"):
            img = img.convert("RGB")
            save_kwargs["quality"] = 90
        elif ext == "png":
            save_kwargs["optimize"] = True
        elif ext == "webp":
            save_kwargs["quality"] = 90
            save_kwargs["method"] = 6
        elif ext == "gif":
            img = img.convert("RGB").quantize(colors=128)
            save_kwargs["optimize"] = True

        img.save(path, **save_kwargs)
        print(f"  {path.name}  ({img.size[0]}x{img.size[1]})")


# ===========================================================
#  音频生成 — 乐器音色模拟
# ===========================================================
SAMPLE_RATE = 44100

def _adsr(samples, attack=0.02, decay=0.1, sustain=0.7, release=0.15, duration=None):
    """ADSR 包络"""
    total = len(samples)
    a = int(SAMPLE_RATE * (attack if duration is None else attack * duration / (len(samples) / SAMPLE_RATE)))
    d = int(SAMPLE_RATE * (decay if duration is None else decay * duration / (len(samples) / SAMPLE_RATE)))
    r = int(SAMPLE_RATE * (release if duration is None else release * duration / (len(samples) / SAMPLE_RATE)))
    for i in range(total):
        if i < a:
            env = i / a
        elif i < a + d:
            env = 1.0 - (1.0 - sustain) * (i - a) / d
        elif i > total - r:
            env = sustain * (total - i) / r
        else:
            env = sustain
        samples[i] = int(samples[i] * max(0, min(1, env)))
    return samples

def _mix(*waves, normalize=True):
    """混合多个波形"""
    length = max(len(w) for w in waves)
    result = [0] * length
    for w in waves:
        for i in range(len(w)):
            result[i] += w[i]
    if normalize:
        peak = max(abs(x) for x in result) if result else 1
        if peak > 30000:
            scale = 30000 / peak
            result = [int(x * scale) for x in result]
    return result

def generate_wav_audio(obj_dir: Path, name: str):
    """生成乐器音色 WAV"""
    audio_dir = obj_dir / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)

    dur = 10.0
    n = int(SAMPLE_RATE * dur)

    # 根据乐器选择音色参数
    specs = {
        "Piano":        {"base": 440, "harmonics": [1, 0.6, 0.3, 0.15, 0.08], "wave": "decay_sin", "decay": 3.0},
        "Violin":       {"base": 392, "harmonics": [1, 0.8, 0.5, 0.3, 0.2], "wave": "saw", "vibrato": 5.5},
        "Trumpet":      {"base": 466, "harmonics": [1, 0.7, 0.4, 0.2, 0.15], "wave": "brass", "vibrato": 4.0},
        "Flute":        {"base": 523, "harmonics": [1, 0.4, 0.1], "wave": "sin", "vibrato": 3.0},
        "Electric Guitar": {"base": 330, "harmonics": [1, 0.6, 0.3, 0.2], "wave": "distort", "decay": 1.5},
        "Saxophone":    {"base": 349, "harmonics": [1, 0.7, 0.5, 0.25, 0.15], "wave": "saw", "vibrato": 5.0, "growl": 70},
        "Djembe":       {"base": 200, "harmonics": [1], "wave": "perc", "decay": 0.3},
        "Shamisen":     {"base": 294, "harmonics": [1, 0.5, 0.2], "wave": "pluck", "decay": 2.5},
    }

    spec = specs.get(name, specs["Piano"])
    base = spec["base"]
    harmonics = spec["harmonics"]
    wave_type = spec["wave"]
    vibrato_hz = spec.get("vibrato", 0)

    # 生成基础波形
    samples = [0.0] * n
    for j, amp in enumerate(harmonics):
        freq = base * (j + 1)
        for i in range(n):
            t = i / SAMPLE_RATE
            phase = 2 * math.pi * freq * t

            if wave_type == "sin" or wave_type == "decay_sin":
                val = math.sin(phase)
            elif wave_type == "saw":
                val = 2 * ((freq * t) % 1.0) - 1.0
            elif wave_type == "brass":
                # 扁平的类三角波
                val = math.sin(phase)
                val = math.copysign(abs(val) ** 0.4, val)
            elif wave_type == "distort":
                val = math.tanh(3 * math.sin(phase))
            elif wave_type == "pluck":
                decay = spec.get("decay", 2)
                env = math.exp(-t / decay)
                val = math.sin(phase) * env * (1 + 0.5 * math.sin(2 * math.pi * 8 * t))
                samples[i] += val * amp
                continue  # pluck 已经乘了 env，不走下面
            elif wave_type == "perc":
                env = math.exp(-t / spec.get("decay", 0.3))
                noise = (hash(str(i)) % 20000 - 10000) / 10000
                val = math.sin(phase * (1 + 3 * math.exp(-t * 20))) * env + noise * 0.3 * env
                samples[i] += val * amp * 0.6
                continue

            samples[i] += val * amp

    # 颤音
    if vibrato_hz > 0:
        for i in range(n):
            t = i / SAMPLE_RATE
            vibrato = 1 + 0.003 * math.sin(2 * math.pi * vibrato_hz * t)
            samples[i] *= vibrato

    # ADSR 包络（perc 和 pluck 类跳过）
    if wave_type not in ("perc", "pluck"):
        decay = spec.get("decay", 2.0)
        for i in range(n):
            t = i / SAMPLE_RATE
            env = min(1.0, max(0.0, math.exp(-t / decay) * 1.2))
            samples[i] *= env

    # 归一化 & 转为 16-bit PCM
    peak = max(abs(x) for x in samples) if samples else 1
    scale = 30000 / max(peak, 0.001)
    pcm = [max(-32768, min(32767, int(s * scale))) for s in samples]

    # 写出 WAV
    wav_path = audio_dir / f"{name} 00.wav"
    with wave.open(str(wav_path), "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(struct.pack("<" + "h" * len(pcm), *pcm))
    print(f"  {wav_path.name}  ({dur:.1f}s, {wave_type})")

    return wav_path


def convert_audio(wav_path: Path, target_ext: str):
    """用 ffmpeg 将 WAV 转为 MP3 / M4A"""
    if not FFMPEG:
        print(f"  [skip {target_ext}] ffmpeg not available")
        return None

    out_path = wav_path.parent / f"{wav_path.stem}.{target_ext}"
    codec_map = {"mp3": "libmp3lame", "m4a": "aac"}
    codec = codec_map.get(target_ext)
    if not codec:
        return None

    try:
        subprocess.run(
            [FFMPEG, "-y", "-i", str(wav_path), "-c:a", codec, "-b:a", "192k", str(out_path)],
            capture_output=True, check=True, timeout=30,
        )
        print(f"  {out_path.name}  (converted from WAV)")
        return out_path
    except Exception as e:
        print(f"  [FAIL {target_ext}] {e}")
        # 回退：如果 lame 不可用，用 libmp3lame 失败时试 libtwolame
        if target_ext == "mp3":
            try:
                subprocess.run(
                    [FFMPEG, "-y", "-i", str(wav_path), "-c:a", "libtwolame", "-b:a", "192k", str(out_path)],
                    capture_output=True, check=True, timeout=30,
                )
                print(f"  {out_path.name}  (converted via libtwolame)")
                return out_path
            except Exception:
                pass
    return None


# ===========================================================
#  视频生成 — 带乐器名称的动态展示
# ===========================================================
def generate_video(obj_dir: Path, name: str):
    """用 ffmpeg 生成 10 秒乐器动画视频（图片 zoompan + 合成音频）"""
    if not FFMPEG:
        print(f"  [skip video] ffmpeg not available")
        return

    video_dir = obj_dir / "videos"
    video_dir.mkdir(parents=True, exist_ok=True)
    out_path = video_dir / f"{name} 00.mp4"
    if out_path.exists():
        return

    image_path = obj_dir / "images" / f"{name} 00.jpg"
    audio_path = obj_dir / "audio" / f"{name} 00.wav"
    if not image_path.exists():
        print(f"  [skip video] {image_path} not found")
        return
    if not audio_path.exists():
        print(f"  [skip video] {audio_path} not found")
        return

    fps = 24
    duration = 10
    total_frames = fps * duration

    vf = (
        f"zoompan=z='min(zoom+0.0015,1.25)':"
        f"x='iw/2-(iw/zoom/2)+30*sin(on*2*PI/{total_frames})':"
        f"y='ih/2-(ih/zoom/2)':"
        f"d={total_frames}:s=640x480:fps={fps}"
    )

    cmd = [
        FFMPEG, "-y",
        "-loop", "1", "-i", str(image_path),
        "-i", str(audio_path),
        "-vf", vf,
        "-c:v", "libx264", "-preset", "ultrafast",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k",
        "-shortest",
        "-movflags", "+faststart",
        str(out_path),
    ]

    subprocess.run(cmd, capture_output=True, check=True, timeout=60)
    print(f"  {out_path.name}  ({duration}s image+audio)")


# ===========================================================
#  xlsx 生成
# ===========================================================
def create_xlsx(course_dir: Path):
    """创建完整的课程 Excel"""
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

    wb = Workbook()
    ws = wb.active
    ws.title = "Musical Instruments"

    headers = [
        "Instrument",
        "Instrument Family",
        "Primary Material",
        "Playing Technique",
        "Origin Region",
        "Typical Pitch Range",
        "Notable Composers / Players",
        "Era of Origin",
        "Ensemble Role",
        "#Orchestra Section",
        "#Difficulty Level",
        "#Historical Period"
    ]

    rows = [
        ["Piano", "Keyboard; Percussion", "Wood; metal strings; felt hammers", "Struck (hammer action)",
         "Italy (Bartolomeo Cristofori, ca. 1700)", "A0 to C8 (7¼ octaves)",
         "Chopin; Liszt; Rachmaninoff; Debussy", "Early 18th century",
         "Solo; accompaniment; orchestral keyboard", "Keyboard", "Advanced", "Baroque–Modern"],
        ["Violin", "Strings", "Wood (maple; spruce)", "Bowed (arco); plucked (pizzicato)",
         "Italy (Cremona school, 16th c.)", "G3 to E6+ (4 strings, G-D-A-E)",
         "Paganini; Vivaldi; Heifetz; Hahn", "Mid 16th century",
         "Orchestral leader; chamber; solo concerti", "Strings", "Advanced", "Renaissance–Modern"],
        ["Trumpet", "Brass", "Brass (yellow brass, lacquered or silver-plated)", "Blown (buzzed lips into cup mouthpiece)",
         "Ancient Egypt → Europe (valves added 19th c.)", "F♯3 to C6 (B♭ trumpet)",
         "Miles Davis; Louis Armstrong; Håkan Hardenberger", "Antiquity (valves: 19th c.)",
         "Fanfare; jazz lead; orchestral brass section", "Brass", "Intermediate", "Antiquity–Modern"],
        ["Flute", "Woodwinds", "Metal (silver; nickel; gold alloys)", "Blown (edge tone across embouchure hole)",
         "Prehistoric → Europe (Boehm system, 1847)", "C4 to C7 (3 octaves, C footjoint)",
         "Debussy (Syrinx); James Galway; Rampal", "Prehistoric (modern: 19th c.)",
         "Orchestral woodwind section; solo; chamber", "Woodwinds", "Intermediate", "Antiquity–Modern"],
        ["Electric Guitar", "Strings; Electronic", "Wood (alder; mahogany); metal strings; magnetic pickups",
         "Plucked; picked (plectrum); fingerstyle", "United States (Fender, Gibson, 1930s–50s)",
         "E2 to E6 (22–24 frets, standard tuning)", "Jimi Hendrix; Eric Clapton; Sister Rosetta Tharpe",
         "Mid 20th century", "Rock; blues; jazz; pop rhythm & lead", "Guitar", "Intermediate", "20th Century–Modern"],
        ["Saxophone", "Woodwinds", "Brass (body); cane reed (mouthpiece)", "Blown (single reed)",
         "Belgium (Adolphe Sax, 1840s)", "B♭3 to F♯6 (alto sax, written range)",
         "Charlie Parker; John Coltrane; Marcel Mule", "Mid 19th century",
         "Jazz; military band; occasional orchestral", "Woodwinds; Jazz", "Intermediate", "19th Century–Modern"],
        ["Djembe", "Percussion", "Wood (lenke; mahogany); goatskin head; rope tuning",
         "Struck (bare hands — bass, tone, slap)", "West Africa (Mali; Guinea; Senegal)",
         "Variable (bass; tone; slap — 3 primary sounds)", "Mamady Keïta; Famoudou Konaté",
         "Ancient (12th c. Mandé empire)", "Rhythm ensemble; dance accompaniment; solo", "Percussion", "Beginner", "Ancient–Modern"],
        ["Shamisen", "Strings", "Wood; silk or nylon strings; bachi plectrum",
         "Plucked (bachi); tremolo; glissando", "Japan (Okinawa → mainland, 16th c.)",
         "D3 to D5+ (3 strings, various tunings)", "Yoshida Brothers; Takahashi Chikuzan",
         "Mid 16th century", "Kabuki; jiuta; min'yō folk music", "Traditional", "Advanced", "16th Century–Modern"],
    ]

    # 样式
    header_fill = PatternFill(start_color="1B3A2B", end_color="1B3A2B", fill_type="solid")
    header_font = Font(name="Segoe UI", bold=True, color="FFFFFF", size=11)
    cell_font = Font(name="Segoe UI", size=10)
    cell_align = Alignment(wrap_text=True, vertical="top")
    thin_border = Border(
        left=Side(style="thin", color="C6A24B"),
        right=Side(style="thin", color="C6A24B"),
        top=Side(style="thin", color="C6A24B"),
        bottom=Side(style="thin", color="C6A24B"),
    )
    alt_fill = PatternFill(start_color="F5F0E8", end_color="F5F0E8", fill_type="solid")

    # 写表头
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(wrap_text=True, vertical="center", horizontal="center")
        cell.border = thin_border

    # 写数据
    for r, row_data in enumerate(rows, 2):
        for c, val in enumerate(row_data, 1):
            cell = ws.cell(row=r, column=c, value=val)
            cell.font = cell_font
            cell.alignment = cell_align
            cell.border = thin_border
            if r % 2 == 0:
                cell.fill = alt_fill

    # 列宽
    col_widths = [20, 22, 30, 28, 32, 24, 30, 22, 28, 18, 14, 18]
    for i, w in enumerate(col_widths, 1):
        ws.column_dimensions[ws.cell(row=1, column=i).column_letter].width = w

    # 行高
    ws.row_dimensions[1].height = 30
    for r in range(2, len(rows) + 2):
        ws.row_dimensions[r].height = 60

    path = course_dir / "Instruments.xlsx"
    wb.save(path)
    print(f"  {path.name}  ({len(rows)} rows × {len(headers)} columns)")


# ===========================================================
#  主流程
# ===========================================================
def main():
    print("=" * 60)
    print("  Znawca Instruments Demo — Build Script")
    print("=" * 60)

    find_ffmpeg()
    if FFMPEG:
        print(f"ffmpeg: {FFMPEG}")
    else:
        print("ffmpeg: NOT FOUND (audio conversion & video will be skipped)")

    if OUTPUT.exists():
        print(f"\nRemoving existing demo...")
        shutil.rmtree(OUTPUT)
    OUTPUT.mkdir(parents=True)

    # ---- 1. xlsx ----
    print("\n[1/4] Creating xlsx...")
    create_xlsx(OUTPUT)

    # ---- 2. Images ----
    print("\n[2/4] Generating instrument images...")
    img_formats = {
        "Piano":           ["jpg", "png", "webp"],
        "Violin":          ["jpg", "bmp", "gif"],
        "Trumpet":         ["jpg", "png"],
        "Flute":           ["jpg", "webp"],
        "Electric Guitar": ["jpg", "bmp"],
        "Saxophone":       ["jpg", "gif"],
        "Djembe":          ["jpg", "png", "webp"],
        "Shamisen":        ["jpg", "bmp", "gif"],
    }
    for name, fmts in img_formats.items():
        obj_dir = OUTPUT / name
        print(f"  {name} → {', '.join(fmts)}")
        generate_images(obj_dir, name, fmts)

    # ---- 3. Audio ----
    print("\n[3/4] Generating audio...")
    audio_extras = {
        "Piano":           ["mp3"],
        "Violin":          ["m4a"],
        "Trumpet":         ["mp3"],
        "Flute":           [],          # WAV only
        "Electric Guitar": ["m4a"],
        "Saxophone":       ["mp3"],
        "Djembe":          [],          # WAV only
        "Shamisen":        ["m4a"],
    }
    wav_paths = {}
    for name, extras in audio_extras.items():
        obj_dir = OUTPUT / name
        print(f"  {name}")
        wav = generate_wav_audio(obj_dir, name)
        wav_paths[name] = wav
        for ext in extras:
            convert_audio(wav, ext)

    # ---- 4. Video ----
    print("\n[4/4] Generating videos...")
    for name in DRAW_FUNCS:
        if not FFMPEG:
            print(f"  [skip] {name} (no ffmpeg)")
            continue
        obj_dir = OUTPUT / name
        print(f"  {name}")
        generate_video(obj_dir, name)

    # ---- Summary ----
    print("\n" + "=" * 60)
    print("  BUILD COMPLETE")
    print("=" * 60)

    # 文件统计
    total_files = 0
    total_size = 0
    format_count = {}
    for root, _, files in os.walk(OUTPUT):
        for f in files:
            fp = os.path.join(root, f)
            total_files += 1
            total_size += os.path.getsize(fp)
            ext = os.path.splitext(f)[1].lower()
            format_count[ext] = format_count.get(ext, 0) + 1

    print(f"\nOutput: {OUTPUT}")
    print(f"Files: {total_files}  |  Size: {total_size / 1024 / 1024:.1f} MB")
    print(f"\nFormats:")
    for ext in sorted(format_count):
        print(f"  {ext}: {format_count[ext]} file(s)")
    print()


if __name__ == "__main__":
    main()
