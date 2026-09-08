# Znawca V1.0 Development Plan

The single source of product truth is `Znawca 需求规格说明书 V1.0.docx`.
Every implementation branch must read it before changing code.

## Architecture baseline

- Windows desktop: Electron, React, TypeScript, Vite.
- Security: context isolation on, renderer has no direct Node access, typed IPC only.
- Offline first: no login, network, cloud, telemetry, or AI dependency.
- Core domain modules are pure TypeScript and do not import Electron or React.
- Local persistence is adapter-based so tests can use in-memory stores.
- Large real media stays outside Git; automated tests use small fixtures/mocks.

## Branch ownership

| Workstream | Branch scope | Owned paths |
| --- | --- | --- |
| Foundation | Desktop runtime and build | `package.json`, build config, `src/main`, `src/preload`, app shell |
| Course engine | Course discovery, Excel, media, validation | `src/core/course`, `tests/course`, `fixtures/course` |
| Quiz engine | Questions, sessions, scoring, difficulty | `src/core/quiz`, `src/core/session`, `src/core/difficulty`, related tests |
| Product UI | Course setup, learning, testing, results | Created after foundation contracts stabilize |
| Localization/example | Five UI languages and customer-provided reference course | Revalidated after the reference course is available |
| Packaging/QA | Installer, upgrade, offline E2E, acceptance | Final integration phase |

## Merge order

1. Foundation.
2. Course engine.
3. Quiz/session/difficulty engine.
4. Product UI and localization/demo in parallel after core contracts stabilize.
5. Packaging, end-to-end tests, installer, release verification.

## Deferred backlog

- Automation-assisted research and complex course-file preparation may be added
  later. It requires a separate, stable filename contract and is not part of the
  current implementation scope.

## Definition of done for a branch

- Scope matches the V1.0 specification.
- No unrelated path changes.
- Tests cover success, malformed input, and relevant edge cases.
- Tests and build pass in the branch.
- No network, login, cloud, telemetry, or AI dependency is introduced.
- Changes are committed with a clear message.
- The branch reports risks and integration contracts.
