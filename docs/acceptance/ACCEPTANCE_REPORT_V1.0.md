# Znawca V1.0 Acceptance Report

Acceptance baseline: `Znawca 需求规格说明书 V1.0.docx`

Accepted main commit: `0471105`

> Historical snapshot: the bundled Birds/Rocks mock courses and guided mock were
> removed after this acceptance run. Final acceptance must be repeated with the
> customer-provided reference course.

## Result

Znawca V1.0 is accepted as a buildable, testable, installable and usable offline
Windows desktop application.

## Verified scope

- Electron desktop security isolation with a narrow typed IPC bridge.
- Fully local operation without accounts, cloud storage, telemetry or required network access.
- Validated `.xlsx` course loading with actionable file, row and column errors.
- Multiple images, audio files and videos per object through an allowlisted local-media protocol.
- Text input, multiple-choice, image, audio and video identification questions.
- Name-to-property and property-to-name text directions.
- Strict and lenient distractor pools with 4-to-3-to-input fallback.
- `#` field filtering with OR inside one field and AND between fields.
- Automatic skipping of non-discriminating question columns after filtering.
- Learning sessions requiring two consecutive correct answers after an error.
- Testing sessions with each selected question once and optional 10/15/20-second countdown.
- Semicolon-delimited multi-answer feedback in Learning; Testing awards one point only for a fully correct answer.
- Persisted course progress and fine-grained difficulty weighting.
- Difficulty cleared after two clean sessions through the shared difficulty engine.
- Five interface languages: English, Polish, Simplified Chinese, Arabic and Russian.
- Arabic RTL document direction and layout adjustments.
- Guided workflow pending revalidation with the customer-provided reference course.
- NSIS installer and portable Windows x64 executable.

## Verification evidence

- TypeScript renderer and Electron main/preload type checks: passed.
- Vitest: 19 test files, 45 tests passed.
- Vite renderer and TypeScript Electron production build: passed.
- Production dependency audit: 0 known vulnerabilities.
- Packaged `release/win-unpacked/Znawca.exe`: remained running during launch smoke test.
- Installer SHA-256: `7E5353450E9C8C3AEBEA70F90E68227B9660DF5F74E91F0B386911667813C1B0`.
- Portable SHA-256: `ED8B0084FAACCE68DC2027C52926698966987F03B08D74ED5FB438AA6D4EC641`.

## Release notes

- The V1.0 packages use the default Electron application icon. A customer-approved
  icon can replace it without changing application behavior.
- No commercial Windows code-signing certificate is configured. Windows may show
  an unknown-publisher warning until a certificate is supplied.
- AI and other online integrations remain deferred as required by the offline V1.0 baseline.
