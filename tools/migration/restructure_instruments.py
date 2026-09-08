"""
Restructure the Instruments course library so ZNAWCA can load it.

What it does:
1. Back up the entire Instruments/ directory to Instruments.backup-<date>/
2. Read Instruments.xlsx (the master metadata table) and split it per instrument
3. For each instrument subdirectory:
   a. Move all files from audio/ images/ videos/ up to the instrument directory top level (legacy-flat layout)
   b. Remove the now-empty audio/ images/ videos/ subdirectories
   c. Generate <Instrument>.xlsx with the instrument's metadata as a single-item workbook
4. Remove the Excel lock file ~$Instruments.xlsx from the root

Run with --dry-run first to preview without changes.
"""

from __future__ import annotations

import argparse
import shutil
import sys
from datetime import date
from pathlib import Path

from openpyxl import Workbook, load_workbook

ROOT = Path(r"C:\Users\Kevin\Desktop\ZNAWCA课程库\Instruments")
LOCK_FILES = {"~$Instruments.xlsx"}
MEDIA_SUBDIRS = ("audio", "images", "videos")


def read_master_workbook(path: Path) -> tuple[list[str], dict[str, list[str]]]:
    """Return (headers, {instrument_name: [col2_value, col3_value, ...]})."""
    wb = load_workbook(path, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        sys.exit("Master workbook is empty.")
    headers = [str(c).strip() if c is not None else "" for c in rows[0]]
    instruments: dict[str, list[str]] = {}
    for row in rows[1:]:
        if not row or not row[0]:
            continue
        name = str(row[0]).strip()
        instruments[name] = [str(c).strip() if c is not None else "" for c in row[1:]]
    return headers, instruments


def collect_media_files(instrument_dir: Path) -> list[Path]:
    """Return all media files currently nested under audio/images/videos/."""
    files: list[Path] = []
    for sub in MEDIA_SUBDIRS:
        sub_dir = instrument_dir / sub
        if sub_dir.is_dir():
            files.extend(f for f in sub_dir.iterdir() if f.is_file())
    return files


def build_workbook(instrument_name: str, headers: list[str], values: list[str]) -> Workbook:
    wb = Workbook()
    ws = wb.active
    ws.title = instrument_name[:31] or "Sheet"
    ws.append(headers)
    ws.append([instrument_name, *values])
    return wb


def restructure(dry_run: bool) -> None:
    if not ROOT.is_dir():
        sys.exit(f"Course root not found: {ROOT}")

    master_path = ROOT / "Instruments.xlsx"
    if not master_path.is_file():
        sys.exit(f"Master workbook not found: {master_path}")

    headers, instruments = read_master_workbook(master_path)
    print(f"Master workbook: {len(instruments)} instruments, {len(headers)} columns")
    print(f"Headers: {headers}")
    print()

    instrument_dirs = sorted(d for d in ROOT.iterdir() if d.is_dir())
    print(f"Found {len(instrument_dirs)} instrument subdirectories:")
    for d in instrument_dirs:
        media = collect_media_files(d)
        has_workbook = any(f.suffix.lower() == ".xlsx" for f in d.iterdir() if f.is_file())
        in_master = d.name in instruments
        print(f"  {d.name}: {len(media)} media files, workbook={has_workbook}, in_master={in_master}")
    print()

    if dry_run:
        print("=== DRY RUN — no changes will be made ===")
    else:
        backup = ROOT.parent / f"Instruments.backup-{date.today().isoformat()}"
        if backup.exists():
            shutil.rmtree(backup)
        shutil.copytree(ROOT, backup)
        print(f"Backup created: {backup}")
    print()

    actions: list[str] = []
    for d in instrument_dirs:
        name = d.name
        if name not in instruments:
            actions.append(f"[SKIP] {name}: not found in master workbook")
            continue

        # 3a. Move media files to top level
        for sub in MEDIA_SUBDIRS:
            sub_dir = d / sub
            if sub_dir.is_dir():
                for f in sorted(sub_dir.iterdir()):
                    if f.is_file():
                        target = d / f.name
                        if target.exists():
                            actions.append(f"[WARN] {name}/{f.name} already exists at top level, skipping move")
                        elif dry_run:
                            actions.append(f"[MOVE] {name}/{sub}/{f.name} -> {name}/{f.name}")
                        else:
                            shutil.move(str(f), str(target))
                if not dry_run:
                    try:
                        sub_dir.rmdir()
                        actions.append(f"[RMDIR] {name}/{sub}/")
                    except OSError as e:
                        actions.append(f"[WARN] could not remove {name}/{sub}/: {e}")

        # 3b. Generate workbook
        wb_path = d / f"{name}.xlsx"
        if dry_run:
            actions.append(f"[CREATE] {name}/{name}.xlsx (1 item, {len(headers)} columns)")
        else:
            wb = build_workbook(name, headers, instruments[name])
            wb.save(wb_path)
            actions.append(f"[CREATE] {name}/{name}.xlsx")

    # 4. Remove lock files
    for lock in LOCK_FILES:
        lock_path = ROOT / lock
        if lock_path.exists():
            if dry_run:
                actions.append(f"[DELETE] {lock}")
            else:
                lock_path.unlink()
                actions.append(f"[DELETE] {lock}")

    print("Actions:")
    for a in actions:
        print(f"  {a}")

    print()
    if dry_run:
        print("Dry run complete. Re-run without --dry-run to apply.")
    else:
        print(f"Done. {len(actions)} actions applied.")
        print("Next: open ZNAWCA, point course root to:")
        print(f"  {ROOT}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    restructure(args.dry_run)
