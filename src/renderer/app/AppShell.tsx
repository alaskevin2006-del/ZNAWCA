import { useSyncExternalStore } from "react";
import { createDesktopServices } from "../adapters/desktop";
import { useCourseLibrary } from "../features/courses/useCourseLibrary";
import { useQuestionSets } from "../features/study/useQuestionSets";
import { StudySession } from "../../application/study/study-session";
import { PersistenceNotice } from "../shared/PersistenceNotice";
import { CourseImportChoiceDialog } from "../features/courses/ImportChoiceDialog";
import { usePlayback } from "../shared/media/usePlayback";
import { useEffect, useMemo, useState } from "react";
import type { Course, CourseIssue } from "../../core/course/types";

import { textDirection, translate, type Locale } from "../i18n/index";
import {
  clearCourseDifficulty,
  removeDifficultyRecord,
} from "../../application/state/updates.js";
import { defaultLocalState } from "../../application/state/defaults.js";

import {
  progressSummary,
  selectLearningQuestions,
  selectTestingQuestions,
} from "../../core/progress/knowledge-progress";
import type {
  AnswerEvaluation,
  FilterSelection,
  Question,
  QuestionKind,
} from "../../core/quiz/types";
import {
  type LearningHistoryRecord,
  type LearningSessionRecord,
  type SessionIdentity,
  type TestHistoryRecord,
} from "../../core/session/index";
import { CourseContextNav, Header } from "./navigation";
import { Screen } from "./types";
import { Courses } from "../features/courses/Courses";

import {
  CourseListEntry,
  isLoadedCourse,
  issueKey,
} from "../../application/courses/catalog";
import { Difficulty } from "../features/difficulty/Difficulty";
import { LearningHistory, TestHistory } from "../features/history/HistoryList";
import { ReplayView } from "../features/history/ReplayView";
import { SettingsDialog } from "../features/settings/SettingsDialog";
import { Results } from "../features/study/Results";
import { Session } from "../features/study/Session";
import { Setup } from "../features/study/Setup";
import { defaultDirections } from "../features/study/options";
import {
  CoverageMode,
  EnabledDirections,
  EnabledKinds,
  Mode,
  Timer,
} from "../features/study/types";
import { formatOrganizationNotice } from "../i18n/courses";
import { directionLabels } from "../i18n/study";

export function AppShell() {
  const [screen, setScreen] = useState<Screen>("courses");
  const [courseTitle, setCourseTitle] = useState("");
  const [services] = useState(createDesktopServices);
  const stateSnapshot = useSyncExternalStore(
    services.state.subscribe,
    services.state.getSnapshot,
  );
  const localState = stateSnapshot.state;
  const {
    locale,
    timerSeconds: timer,
    strictDistractors: strict,
    difficultFirst,
    playerVolume,
    questionLimit,
    coverageMode,
    enabledKinds: kinds,
  } = localState.settings;
  const directions = useMemo(
    () => ({ ...defaultDirections, ...localState.settings.enabledDirections }),
    [localState.settings.enabledDirections],
  );
  // A difficulty review temporarily chooses Learning without rewriting the saved setup mode.
  const [modeOverride, setModeOverride] = useState<Mode>();
  const mode = modeOverride ?? localState.settings.mode;
  const library = useCourseLibrary(
    services.state,
    stateSnapshot.ready,
    services.courses,
    services.courseAccess,
  );
  const { activeCourse, setActiveCourse, loadedCourses, openCourseEntry } =
    library;
  const courseListEntries = library.entries;
  const courseIssues = library.issues;
  const [study] = useState(() => new StudySession(services.state));
  const studySnapshot = useSyncExternalStore(
    study.subscribe,
    study.getSnapshot,
  );
  const {
    question,
    feedback,
    needsAnother,
    position,
    total: sessionTotal,
    units: unitCounts,
    result,
  } = studySnapshot;
  const [filters, setFilters] = useState<FilterSelection[]>([]);
  const [answer, setAnswer] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [replay, setReplay] = useState<{
    kind: "learning" | "test";
    recordId: string;
    index: number;
  }>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importChoiceOpen, setImportChoiceOpen] = useState(false);
  const [importNotice, setImportNotice] = useState<string>();
  const { stopAllPlayback, questionSpeech, playSpeech } = usePlayback(
    activeCourse,
    question,
    feedback,
    playerVolume,
  );

  useEffect(() => {
    void services.state.initialize();
  }, [services]);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = textDirection(locale);
  }, [locale]);

  const { questionSet, capabilitySet, reviewQuestionSet } = useQuestionSets(
    activeCourse,
    filters,
    strict,
    directions,
    kinds,
    localState,
  );

  const persist = services.state.update;
  const persistSettings = services.state.updateSettings;
  const dismissIssue = (issue: CourseIssue) => {
    const key = issueKey(issue);
    services.state.update((state) => ({
      ...state,
      settings: {
        ...state.settings,
        dismissedIssueKeys: [
          ...new Set([...state.settings.dismissedIssueKeys, key]),
        ],
      },
    }));
  };
  const restoreDismissedIssues = () =>
    persistSettings({ dismissedIssueKeys: [] });
  const knownCourseIds = useMemo(
    () => new Set(courseListEntries.map((entry) => entry.id)),
    [courseListEntries],
  );
  const selectLoadedCourse = (course: Course): void => {
    setCourseTitle(course.title);
    setActiveCourse(course);
    setFilters([]);
    setScreen("setup");
    persist((state) => ({
      ...state,
      settings: {
        ...state.settings,
        recentCourseId: course.id,
        removedCourseIds: state.settings.removedCourseIds.filter(
          (id) => id !== course.id,
        ),
      },
    }));
  };
  const selectCourseEntry = (entry: CourseListEntry): void => {
    if (isLoadedCourse(entry)) {
      selectLoadedCourse(entry);
      return;
    }
    const loaded = loadedCourses.find((course) => course.id === entry.id);
    if (loaded) {
      selectLoadedCourse(loaded);
      return;
    }
    void openCourseEntry(entry).then((course) => {
      if (course) selectLoadedCourse(course);
    });
  };
  const identity = (
    courseId: string,
    title: string,
    requestedQuestionCount: number,
  ): SessionIdentity => ({
    id: `${courseId}:${Date.now()}`,
    courseId,
    courseTitle: title,
    startedAt: new Date().toISOString(),
    scope: {
      filters,
      selectedQuestionTypes: [
        ...(Object.keys(kinds) as QuestionKind[]).filter((key) => kinds[key]),
        ...directionLabels
          .filter(([key]) => directions[key])
          .map(([key]) => key),
      ],
      requestedQuestionCount,
      teachingStyle: strict ? "strict" : "lenient",
      difficultFirst,
    },
  });
  const beginSession = (selected: readonly Question[], sessionMode: Mode) => {
    if (!activeCourse || !selected.length) return;
    stopAllPlayback();
    study.start(
      identity(activeCourse.id, courseTitle, selected.length),
      selected,
      sessionMode,
      timer,
    );
    setModeOverride(sessionMode);
    setAnswer("");
    setReviewOpen(false);
    setScreen("session");
  };
  const start = () => {
    if (!activeCourse || questionSet.questions.length === 0) return;
    const courseProgress = localState.knowledgeProgress.filter(
      (record) => record.courseId === activeCourse.id,
    );
    const courseDifficulty = localState.difficultyRecords.filter(
      (record) => record.courseId === activeCourse.id,
    );
    const projectTotal = progressSummary(
      questionSet.questions,
      activeCourse.id,
      courseProgress,
    ).eligibleProjects;
    const selectedCount =
      coverageMode === "all"
        ? projectTotal
        : Math.min(questionLimit, projectTotal);
    const selection =
      mode === "learning"
        ? selectLearningQuestions(
            questionSet.questions,
            selectedCount,
            activeCourse.id,
            courseProgress,
            courseDifficulty,
            difficultFirst,
            { next: Math.random },
          )
        : selectTestingQuestions(
            questionSet.questions,
            selectedCount,
            activeCourse.id,
            courseProgress,
            courseDifficulty,
            difficultFirst,
            { next: Math.random },
          );
    beginSession(selection.questions, mode);
  };
  const submit = () => {
    stopAllPlayback();
    study.submit(answer);
  };
  const timeout = () => study.timeout();
  const next = () => {
    stopAllPlayback();
    study.next();
    setAnswer("");
    if (study.getSnapshot().phase === "results") setScreen("results");
  };
  const saveAndExit = () => {
    stopAllPlayback();
    study.save();
    setScreen("courses");
  };
  const resume = async (record: LearningSessionRecord) => {
    const entry = courseListEntries.find(
      (course) => course.id === record.courseId,
    );
    const course = entry
      ? await openCourseEntry(entry)
      : loadedCourses.find((course) => course.id === record.courseId);
    if (!course) return;
    stopAllPlayback();
    study.resume(record);
    setActiveCourse(course);
    setModeOverride("learning");
    setCourseTitle(record.courseTitle);
    setAnswer("");
    setScreen("session");
  };
  const changeLocale = (value: Locale) => persistSettings({ locale: value });
  const changeMode = (value: Mode) => {
    setModeOverride(undefined);
    persistSettings({ mode: value });
  };
  const changeTimer = (value: Timer) =>
    persistSettings({ timerSeconds: value });
  const changeStrict = (value: boolean) =>
    persistSettings({ strictDistractors: value });
  const changeQuestionLimit = (value: number) =>
    persistSettings({ questionLimit: value });
  const changeCoverageMode = (value: CoverageMode) =>
    persistSettings({ coverageMode: value });
  const changeKinds = (value: EnabledKinds) =>
    persistSettings({ enabledKinds: value });
  const changeDirections = (value: EnabledDirections) =>
    persistSettings({ enabledDirections: value });
  const changePlayerVolume = (value: number) =>
    persistSettings({ playerVolume: Math.min(1, Math.max(0, value)) });
  const setPlayerVolume = changePlayerVolume;
  const removeCourse = (course: CourseListEntry) => {
    if (!window.confirm(translate(locale, "removeCourseConfirm"))) return;
    library.remove(course);
    if (activeCourse?.id === course.id) {
      setCourseTitle("");
      setFilters([]);
      setScreen("courses");
    }
  };
  const refreshCourseLibrary = async () => {
    const ids = await library.refresh();
    if (activeCourse && ids && !ids.has(activeCourse.id)) {
      setCourseTitle("");
      setFilters([]);
      setScreen("courses");
    }
  };
  const addCourse = async (importMode?: "scan" | "organize") => {
    const result = await library.add(importMode);
    if (result?.library) {
      setImportNotice(
        result.library.organization
          ? formatOrganizationNotice(locale, result.library.organization)
          : undefined,
      );
      if (
        result.library.catalog?.length ||
        result.library.reports.some((report) => report.canOpen)
      )
        setFilters([]);
    } else if (result?.course) {
      setCourseTitle(result.course.title);
      setActiveCourse(result.course);
      setFilters([]);
      setScreen("setup");
    }
  };
  const contextCourseId = screen === "courses" ? undefined : activeCourse?.id;
  const contextLearningHistory = contextCourseId
    ? localState.learningHistory.filter(
        (record) => record.courseId === contextCourseId,
      )
    : [];
  const contextTestHistory = contextCourseId
    ? localState.testHistory.filter(
        (record) => record.courseId === contextCourseId,
      )
    : [];
  const contextDifficulty = contextCourseId
    ? localState.difficultyRecords.filter(
        (record) => record.courseId === contextCourseId,
      )
    : [];
  const replayRecord = replay
    ? (replay.kind === "learning" && screen === "learning-history") ||
      (replay.kind === "test" && screen === "test-history")
      ? (replay.kind === "learning"
          ? contextLearningHistory
          : contextTestHistory
        ).find((record) => record.id === replay.recordId)
      : undefined
    : undefined;
  const replayAnswers = (
    replay && replayRecord
      ? replay.kind === "learning"
        ? (replayRecord as LearningHistoryRecord).records
        : (replayRecord as TestHistoryRecord).summary.records
      : undefined
  ) as
    | ReadonlyArray<{
        questionId: string;
        question?: Question;
        submittedAnswers: readonly string[];
        evaluation: AnswerEvaluation;
      }>
    | undefined;

  return (
    <main className="app-shell">
      {stateSnapshot.saveStatus === "error" && (
        <PersistenceNotice locale={locale} onRetry={services.state.retry} />
      )}
      <Header
        locale={locale}
        onHome={() => setScreen("courses")}
        onSettings={() => setSettingsOpen(true)}
      />
      <div className="workspace">
        <section
          className={`content${screen === "courses" ? " content-courses" : ""}${screen === "setup" ? " content-setup" : ""}${screen === "session" ? " content-session" : ""}${screen === "difficulty" || screen === "learning-history" || screen === "test-history" ? " content-list" : ""}`}
        >
          {contextCourseId &&
            (screen === "setup" ||
              screen === "learning-history" ||
              screen === "test-history" ||
              screen === "difficulty") && (
              <CourseContextNav
                locale={locale}
                course={courseTitle}
                screen={screen}
                learningHistoryCount={contextLearningHistory.length}
                testHistoryCount={contextTestHistory.length}
                difficultyCount={contextDifficulty.length}
                onCourses={() => setScreen("courses")}
                onSetup={() => setScreen("setup")}
                onLearningHistory={() => setScreen("learning-history")}
                onTestHistory={() => setScreen("test-history")}
                onDifficulty={() => setScreen("difficulty")}
              />
            )}
          {screen === "courses" && (
            <Courses
              locale={locale}
              courses={courseListEntries}
              issues={courseIssues}
              dismissedIssueKeys={localState.settings.dismissedIssueKeys}
              onDismissIssue={dismissIssue}
              onRestoreDismissed={restoreDismissedIssues}
              importNotice={importNotice}
              resumable={Object.values(localState.learningSessions).filter(
                (record) => knownCourseIds.has(record.courseId),
              )}
              onResume={resume}
              onRemove={removeCourse}
              canRefresh={Boolean(
                localState.settings.courseRoot &&
                  services.courses?.scanCourseRoot,
              )}
              onRefresh={refreshCourseLibrary}
              onAdd={async () => {
                if (services.courses?.chooseCourseRoot)
                  setImportChoiceOpen(true);
                else await addCourse();
              }}
              onSelect={selectCourseEntry}
            />
          )}
          {screen === "setup" && activeCourse && (
            <Setup
              locale={locale}
              course={courseTitle}
              courseData={activeCourse}
              filters={filters}
              setFilters={setFilters}
              kinds={kinds}
              setKinds={changeKinds}
              directions={directions}
              setDirections={changeDirections}
              coverageMode={coverageMode}
              setCoverageMode={changeCoverageMode}
              questionLimit={questionLimit}
              setQuestionLimit={changeQuestionLimit}
              mode={mode}
              setMode={changeMode}
              timer={timer}
              setTimer={changeTimer}
              strict={strict}
              setStrict={changeStrict}
              questionSet={questionSet}
              capabilitySet={capabilitySet}
              progress={localState.knowledgeProgress.filter(
                (record) => record.courseId === activeCourse.id,
              )}
              onStart={start}
            />
          )}
          {screen === "session" && question && (
            <Session
              locale={locale}
              question={question}
              course={courseTitle}
              speechCourse={activeCourse}
              speechUrls={questionSpeech}
              onPlaySpeech={playSpeech}
              mode={mode}
              timer={timer}
              volume={playerVolume}
              onVolume={changePlayerVolume}
              position={position}
              total={sessionTotal}
              units={unitCounts}
              answer={answer}
              setAnswer={setAnswer}
              feedback={feedback}
              needsAnother={needsAnother}
              onSubmit={submit}
              onTimeout={timeout}
              onSaveExit={saveAndExit}
              onNext={next}
            />
          )}
          {screen === "results" && (
            <Results
              locale={locale}
              learningTotal={sessionTotal}
              history={result}
              reviewOpen={reviewOpen}
              setReviewOpen={setReviewOpen}
              onAgain={start}
              onCourses={() => setScreen("courses")}
              volume={playerVolume}
              onVolume={setPlayerVolume}
            />
          )}
          {screen === "learning-history" &&
            (replay && replayAnswers ? (
              <ReplayView
                locale={locale}
                course={courseTitle}
                kind={replay.kind}
                answers={replayAnswers}
                index={replay.index}
                volume={playerVolume}
                onVolume={setPlayerVolume}
                onIndex={(value) => setReplay({ ...replay, index: value })}
                onExit={() => setReplay(undefined)}
              />
            ) : (
              <LearningHistory
                locale={locale}
                records={contextLearningHistory}
                onOpen={(record) =>
                  setReplay({ kind: "learning", recordId: record.id, index: 0 })
                }
              />
            ))}
          {screen === "test-history" &&
            (replay && replayAnswers ? (
              <ReplayView
                locale={locale}
                course={courseTitle}
                kind={replay.kind}
                answers={replayAnswers}
                index={replay.index}
                volume={playerVolume}
                onVolume={setPlayerVolume}
                onIndex={(value) => setReplay({ ...replay, index: value })}
                onExit={() => setReplay(undefined)}
              />
            ) : (
              <TestHistory
                locale={locale}
                records={contextTestHistory}
                onOpen={(record) =>
                  setReplay({ kind: "test", recordId: record.id, index: 0 })
                }
              />
            ))}
          {screen === "difficulty" && (
            <Difficulty
              locale={locale}
              course={activeCourse}
              records={contextDifficulty}
              onClear={() => {
                if (
                  contextCourseId &&
                  window.confirm(translate(locale, "clearConfirm"))
                ) {
                  persist((state) =>
                    clearCourseDifficulty(state, contextCourseId),
                  );
                }
              }}
              onRemove={(record) => {
                if (contextCourseId) {
                  persist((state) =>
                    removeDifficultyRecord(
                      state,
                      contextCourseId,
                      record.objectId,
                    ),
                  );
                }
              }}
              onPractice={(record) => {
                if (!activeCourse) return;
                const candidates = reviewQuestionSet.questions.filter(
                  (entry) => entry.objectId === record.objectId,
                );
                const selected = candidates.slice(
                  0,
                  Math.min(4, candidates.length),
                );
                beginSession(selected, "learning");
              }}
            />
          )}
        </section>
      </div>
      {importChoiceOpen && (
        <CourseImportChoiceDialog
          locale={locale}
          onChoose={(mode) => {
            setImportChoiceOpen(false);
            void addCourse(mode);
          }}
          onClose={() => setImportChoiceOpen(false)}
        />
      )}
      {settingsOpen && (
        <SettingsDialog
          locale={locale}
          onLocale={changeLocale}
          onClearLearning={() => {
            if (window.confirm(translate(locale, "clearConfirm")))
              persist((state) => ({
                ...state,
                courses: {},
                learningSessions: {},
                learningHistory: [],
                knowledgeProgress: [],
              }));
          }}
          onClearTests={() => {
            if (window.confirm(translate(locale, "clearConfirm")))
              persist((state) => ({ ...state, testHistory: [] }));
          }}
          onClearAll={() => {
            if (!window.confirm(translate(locale, "clearConfirm"))) return;
            const reset = defaultLocalState();
            persist(() => reset);
            library.reset();
            setModeOverride(undefined);
            setSettingsOpen(false);
            setScreen("courses");
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </main>
  );
}

import "../features/courses/course-errors.css";
import "../features/study/choices.css";
import "../features/study/filters.css";
import "../shared/media/media-question.css";
import "../features/settings/settings.css";
