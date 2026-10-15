import { type Locale } from "../core/shared/locale.js";
import type { CourseCatalogEntry } from "../core/course/types.js";
import type { DifficultyRecord } from "../core/difficulty/difficulty-memory.js";
import { type KnowledgeProgressRecord } from "../core/progress/knowledge-progress.js";
import type {
  LearningHistoryRecord,
  LearningSessionRecord,
  TestHistoryRecord,
} from "../core/session/session-controller.js";

export interface CourseProgress {
  readonly lastOpenedAt: string;
  readonly completedSessions: number;
}

export interface LocalState {
  version: 7;
  settings: {
    locale: Locale;
    strictDistractors: boolean;
    timerSeconds: 0 | 10 | 15 | 20;
    difficultFirst: boolean;
    courseRoot?: string;
    recentCourseId?: string;
    /** 上次扫描到的课程目录快照，用于启动时免扫描直接渲染课程列表，后台浅刷后再覆盖。 */
    courseCatalogCache?: CourseCatalogEntry[];
    mode: "learning" | "testing";
    coverageMode: "all" | "sample";
    questionLimit: number;
    enabledKinds: { input: boolean; choice: boolean };
    enabledDirections: Record<string, boolean>;
    playerVolume: number;
    removedCourseIds: string[];
    /** 用户已忽略的课程导入 warning 指纹（code|file|sheet|row|column|columnName），忽略后不再展示。 */
    dismissedIssueKeys: string[];
  };
  courses: Record<string, CourseProgress>;
  difficulty: Record<string, number>;
  difficultyRecords: DifficultyRecord[];
  demo: { completed: boolean; step: number };
  /** At most one resumable learning session is retained per course. */
  learningSessions: Record<string, LearningSessionRecord>;
  learningHistory: LearningHistoryRecord[];
  testHistory: TestHistoryRecord[];
  /** Recently presented media paths, retained per course to reduce repetition. */
  mediaHistory: Record<string, string[]>;
  /** Course-wide coverage and mastery, grouped by semantic knowledge project. */
  knowledgeProgress: KnowledgeProgressRecord[];
}
