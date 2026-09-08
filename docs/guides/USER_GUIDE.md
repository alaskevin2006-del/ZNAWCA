# Znawca User Guide

## Install and start

- Run `Znawca-Setup-1.0.0-x64.exe` for a normal Windows installation.
- Run `Znawca-Portable-1.0.0-x64.exe` when installation is not desired.
- Znawca works locally. Course files, progress and settings are not uploaded.

## Course folder format

Each course is one folder containing exactly one `.xlsx` workbook. The folder name
is used as the course name.

```text
Example Course/
  Example Course.xlsx
  Object A/
    images/
      image-1.jpg
      image-2.png
    audio/
      audio-1.mp3
      audio-2.wav
    videos/
      video-1.mp4
```

An object may have any number of images, audio clips and videos. Media filenames
do not need to match the object name because the object folder provides the
association.

The workbook filename becomes the displayed course title. Using the same clear,
stable name for the course folder and workbook is recommended.

## Workbook format

- Use `.xlsx`; legacy `.xls`, macro workbooks and online sheets are not supported.
- The first worksheet is the course table.
- Row 1 contains unique, non-empty column headings.
- Column A contains the unique object name and must be named `Name`.
- Rows 2 onward contain one object each.
- Separate multiple values in one cell with semicolons, for example
  `insects; seeds; nuts`.
- Prefix a heading with `#` to make it a filter-only column, for example
  `# Primary habitat`.
- Do not use formulas. Store the final text value directly in each cell.
- Empty rows are ignored. Empty object names and duplicate object names are errors.

Znawca reports the file, row or column when a workbook cannot be processed and
suggests how to correct it.

## Media formats

- Images: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.bmp`
- Audio: `.mp3`, `.wav`, `.m4a`
- Video: `.mp4`

Files with an allowed extension but an invalid or mismatched file signature are
reported instead of silently used.
