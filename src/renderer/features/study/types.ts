import type { QuestionDirection, QuestionKind } from "../../../core/quiz/types";

export type Mode = "learning" | "testing";

export type CoverageMode = "all" | "sample";

export type Timer = 0 | 10 | 15 | 20;

export type EnabledKinds = Record<QuestionKind, boolean>;

export type EnabledDirections = Record<QuestionDirection, boolean>;
