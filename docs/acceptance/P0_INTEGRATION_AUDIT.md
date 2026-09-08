# P0 integration audit baseline

This document records the renderer contracts completed when the session,
persistence, and question-generation branches were integrated. The former
executable red specifications now run as normal passing smoke tests.

## Resolved blockers

1. `AppShell` does not use `LearningSession`. Its local `masteryStreaks` rule
   repeats every initially-correct question instead of removing it immediately.
2. `saveAndExit` persists difficulty only. It does not serialize a
   `LearningSnapshot`, and the course library has no resume entry.
3. `AppShell` does not use `TestingSession`. The result screen has only an
   aggregate score, and `LocalState` has no test history.
4. `buildCourseQuestions` implements only media-to-name, name-to-property, and a
   subset of property-to-name. Name-to-image/audio/video choices are absent.
5. `buildCourseQuestions` returns `demoQuestions` when a real course produces no
   questions. Demo data must never enter a real course session, score, or
   difficulty record.

## Expected integration interfaces

The exact names may change, but the merged implementation needs equivalent
capabilities:

- A renderer question-plan adapter returning core `Question[]` plus availability
  metadata (counts, disabled reasons, and degradation reasons). It must call the
  core generator rather than duplicate its rules in `AppShell`.
- `LocalState.activeLearningSession`, containing at least the course identity,
  selected scope/settings, and a `LearningSnapshot`.
- `LocalState.testHistory`, containing date, course, selected scope, timer,
  summary, and per-question `TestAnswerRecord` data needed for answer review.
- A resumable course-library entry exposed as an enabled, accessible
  `Resume learning` button.
- Testing results that expose fully correct and incorrect counts, plus answer
  review with matched/missed details and an enabled score-history destination.
- Explicit controls or equivalent accessible UI for image/audio/video in both
  directions. Media-valued choice options must render the relevant media, not a
  raw path.

## Smoke-test conversion

The P0 contract tests are enabled without `.fails`. Full tests, type checking,
and a production build are required before merging this integration branch.
