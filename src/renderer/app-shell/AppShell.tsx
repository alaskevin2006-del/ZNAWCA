import { useEffect, useMemo, useRef, useState } from "react";
import type { CourseOrganizationSummary } from "../../core/course/organizer";
import type { Course, CourseIssue } from "../../core/course/types";
import { DifficultyMemory } from "../../core/difficulty/difficulty-memory";
import { formatItemNameEmpty, supportedLocales, textDirection, translate, type Locale, type MessageKey } from "../../core/localization";
import {
  appendLearningHistory,
  appendTestHistory,
  clearCourseDifficulty,
  defaultLocalState,
  rememberMedia,
  removeDifficultyRecord,
  removeLearningSession,
  saveLearningSession,
  type LocalState,
} from "../../core/persistence";
import { filterOptions, filteredCourseObjects } from "../../core/quiz/course-adapter";
import { buildCourseQuestionSet, type CourseQuestionSet } from "../../core/quiz/question-set";
import { evaluateAnswer } from "../../core/quiz/scoring";
import { mathRandomSource } from "../../core/quiz/types";
import {
  PlaybackCoordinator,
  buildFeedbackPlaybackChain,
  domAudioFactory,
} from "./feedback-playback";
import {
  progressSummary,
  selectLearningQuestions,
  selectTestingQuestions,
  updateKnowledgeProgress,
} from "../../core/progress/knowledge-progress";
import type {
  AnswerEvaluation,
  FilterSelection,
  MediaKind,
  Question,
  QuestionDirection,
  QuestionKind,
  QuestionOption,
} from "../../core/quiz/types";
import {
  LearningSessionController,
  TestingSessionController,
  type LearningHistoryRecord,
  type LearningSessionRecord,
  type SessionIdentity,
  type TestHistoryRecord,
} from "../../core/session";
import type { DifficultyRecord } from "../../core/difficulty/difficulty-memory";
import "./course-errors.css";
import "./choices.css";
import "./filters.css";
import "./media-question.css";
import "./settings.css";

type Screen = "courses" | "setup" | "session" | "results" | "learning-history" | "test-history" | "difficulty";
type Mode = "learning" | "testing";
type CoverageMode = "all" | "sample";
type Timer = 0 | 10 | 15 | 20;
type EnabledKinds = Record<QuestionKind, boolean>;
type EnabledDirections = Record<QuestionDirection, boolean>;

const directionLabels: ReadonlyArray<[QuestionDirection, MessageKey]> = [
  ["name-to-property", "nameToProperty"],
  ["property-to-name", "propertyToName"],
  ["image-to-name", "imageToName"],
  ["name-to-image", "nameToImage"],
  ["audio-to-name", "audioToName"],
  ["name-to-audio", "nameToAudio"],
  ["video-to-name", "videoToName"],
  ["name-to-video", "nameToVideo"],
];
const defaultDirections = Object.fromEntries(directionLabels.map(([key]) => [key, true])) as EnabledDirections;

const emptySet: CourseQuestionSet = {
  questions: [], skipped: [], skippedFields: [],
  availability: { generated: 0, input: 0, choice: 0, degraded: 0, skipped: 0, byDirection: {} },
};

export function AppShell() {
  const [screen, setScreen] = useState<Screen>("courses");
  const [courseTitle, setCourseTitle] = useState("");
  const [activeCourse, setActiveCourse] = useState<Course>();
  const [loadedCourses, setLoadedCourses] = useState<Course[]>([]);
  const [courseIssues, setCourseIssues] = useState<readonly CourseIssue[]>([]);
  const [mode, setMode] = useState<Mode>("learning");
  const [timer, setTimer] = useState<Timer>(0);
  const [strict, setStrict] = useState(true);
  const [difficultFirst, setDifficultFirst] = useState(false);
  const [playerVolume, setPlayerVolume] = useState(1);
  const [questionLimit, setQuestionLimit] = useState(10);
  const [coverageMode, setCoverageMode] = useState<CoverageMode>("sample");
  const [kinds, setKinds] = useState<EnabledKinds>({ input: true, choice: true });
  const [directions, setDirections] = useState<EnabledDirections>(defaultDirections);
  const [filters, setFilters] = useState<FilterSelection[]>([]);
  const [questions, setQuestions] = useState<readonly Question[]>([]);
  const [question, setQuestion] = useState<Question>();
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<AnswerEvaluation>();
  const [needsAnother, setNeedsAnother] = useState(false);
  const [position, setPosition] = useState(1);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [result, setResult] = useState<TestHistoryRecord>();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [replay, setReplay] = useState<{ kind: "learning" | "test"; recordId: string; index: number }>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importChoiceOpen, setImportChoiceOpen] = useState(false);
  const [importNotice, setImportNotice] = useState<string>();
  const [locale, setLocale] = useState<Locale>("en");
  const [localState, setLocalState] = useState<LocalState>(defaultLocalState);
  const learningRef = useRef<LearningSessionController | undefined>(undefined);
  const testingRef = useRef<TestingSessionController | undefined>(undefined);
  const playbackRef = useRef<PlaybackCoordinator | undefined>(undefined);
  if (!playbackRef.current) playbackRef.current = new PlaybackCoordinator(domAudioFactory);
  const lastFeedbackSoundRef = useRef({ correct: -1, incorrect: -1 });

  useEffect(() => {
    const cancelOnManualPlay = (event: Event) => {
      // D-13：用户在界面手动播放任何媒体时，明确取消自动链。
      if (event.target instanceof HTMLMediaElement) playbackRef.current?.cancel();
    };
    document.addEventListener("play", cancelOnManualPlay, true);
    return () => document.removeEventListener("play", cancelOnManualPlay, true);
  }, []);
  useEffect(() => {
    playbackRef.current?.setVolume(playerVolume);
  }, [playerVolume]);
  useEffect(() => {
    // D-12/D-13：提交/超时产生 feedback 后，串行播放“正误提示音 → 正确答案音频”。
    if (!feedback || !question || !activeCourse) return;
    const selection = buildFeedbackPlaybackChain({
      fullyCorrect: feedback.fullyCorrect,
      feedbackSounds: activeCourse.feedbackSounds,
      question,
      random: mathRandomSource,
      previousCorrectIndex: lastFeedbackSoundRef.current.correct,
      previousIncorrectIndex: lastFeedbackSoundRef.current.incorrect,
    });
    lastFeedbackSoundRef.current = { correct: selection.correctIndex, incorrect: selection.incorrectIndex };
    if (selection.chain.length > 0) playbackRef.current?.play(selection.chain);
  }, [feedback, question, activeCourse]);

  useEffect(() => {
    let active = true;
    void window.znawca?.loadLocalState().then((value) => {
      if (active) {
        setLocalState(value);
        setLocale(value.settings.locale);
        setStrict(value.settings.strictDistractors);
        setTimer(value.settings.timerSeconds);
        setDifficultFirst(value.settings.difficultFirst);
        setMode(value.settings.mode);
        setQuestionLimit(value.settings.questionLimit);
        setCoverageMode(value.settings.coverageMode);
        setKinds(value.settings.enabledKinds);
        setDirections({ ...defaultDirections, ...value.settings.enabledDirections });
        setPlayerVolume(value.settings.playerVolume);
        if (value.settings.courseRoot && window.znawca?.scanCourseRoot) {
          void window.znawca.scanCourseRoot(value.settings.courseRoot).then((library) => {
            if (!active) return;
            const removedCourseIds = new Set(value.settings.removedCourseIds);
            const visibleReports = library.reports.filter((report) => !report.course || !removedCourseIds.has(report.course.id));
            const courses = visibleReports.flatMap((report) => report.canOpen && report.course ? [report.course] : []);
            setLoadedCourses(courses);
            setCourseIssues(visibleReports.flatMap((report) => report.issues));
            const recent = courses.find((course) => course.id === value.settings.recentCourseId);
            if (recent) { setCourseTitle(recent.title); setActiveCourse(recent); }
          });
        }
      }
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = textDirection(locale);
  }, [locale]);

  const questionSet = useMemo(() => {
    if (!activeCourse) return emptySet;
    const selectedDirections = directionLabels.filter(([key]) => directions[key]).map(([key]) => key);
    const requestedKinds = (Object.keys(kinds) as QuestionKind[]).filter((key) => kinds[key]);
    return buildCourseQuestionSet({
      course: activeCourse,
      selections: filters,
      teachingStyle: strict ? "strict" : "lenient",
      directions: selectedDirections,
      requestedKinds,
      recentMediaPaths: [
        ...(localState.mediaHistory[activeCourse.id] ?? []),
        ...localState.knowledgeProgress
          .filter((record) => record.courseId === activeCourse.id)
          .flatMap((record) => record.seenMediaPaths),
      ],
    });
  }, [activeCourse, directions, filters, kinds, strict, localState.mediaHistory, localState.knowledgeProgress]);
  const capabilitySet = useMemo(() => {
    if (!activeCourse) return emptySet;
    return buildCourseQuestionSet({
      course: activeCourse,
      selections: filters,
      teachingStyle: strict ? "strict" : "lenient",
      directions: directionLabels.map(([key]) => key),
      requestedKinds: ["input", "choice"],
      recentMediaPaths: [
        ...(localState.mediaHistory[activeCourse.id] ?? []),
        ...localState.knowledgeProgress
          .filter((record) => record.courseId === activeCourse.id)
          .flatMap((record) => record.seenMediaPaths),
      ],
    });
  }, [activeCourse, filters, strict, localState.mediaHistory, localState.knowledgeProgress]);
  const reviewQuestionSet = useMemo(() => {
    if (!activeCourse) return emptySet;
    return buildCourseQuestionSet({
      course: activeCourse,
      selections: [],
      teachingStyle: strict ? "strict" : "lenient",
      directions: directionLabels.map(([key]) => key),
      requestedKinds: ["input", "choice"],
      recentMediaPaths: [
        ...(localState.mediaHistory[activeCourse.id] ?? []),
        ...localState.knowledgeProgress
          .filter((record) => record.courseId === activeCourse.id)
          .flatMap((record) => record.seenMediaPaths),
      ],
    });
  }, [activeCourse, strict, localState.mediaHistory, localState.knowledgeProgress]);

  const persist = (next: LocalState) => {
    setLocalState(next);
    void window.znawca?.saveLocalState(next);
  };
  const persistSettings = (patch: Partial<LocalState["settings"]>) =>
    persist({ ...localState, settings: { ...localState.settings, ...patch } });
  const identity = (courseId: string, title: string, requestedQuestionCount: number): SessionIdentity => ({
    id: `${courseId}:${Date.now()}`,
    courseId,
    courseTitle: title,
    startedAt: new Date().toISOString(),
    scope: {
      filters,
      selectedQuestionTypes: [
        ...(Object.keys(kinds) as QuestionKind[]).filter((key) => kinds[key]),
        ...directionLabels.filter(([key]) => directions[key]).map(([key]) => key),
      ],
      requestedQuestionCount,
      teachingStyle: strict ? "strict" : "lenient",
      difficultFirst,
    },
  });
  const beginSession = (selected: readonly Question[], sessionMode: Mode) => {
    if (!activeCourse || selected.length === 0) return;
    playbackRef.current?.cancel();
    const courseId = activeCourse.id;
    const sessionIdentity = identity(courseId, courseTitle, selected.length);
    const mediaPaths = selected.flatMap((entry) => [
      entry.media?.path,
      ...(entry.options?.map((option) => option.media?.path) ?? []),
    ].filter((path): path is string => Boolean(path)));
    if (mediaPaths.length) persist(rememberMedia(localState, courseId, mediaPaths));
    setQuestions(selected); setSessionTotal(selected.length); setPosition(1);
    setAnswer(""); setFeedback(undefined); setNeedsAnother(false); setResult(undefined); setReviewOpen(false);
    setMode(sessionMode);
    if (sessionMode === "learning") {
      learningRef.current = new LearningSessionController(sessionIdentity, selected);
      testingRef.current = undefined;
      setQuestion(learningRef.current.current());
    } else {
      testingRef.current = new TestingSessionController(sessionIdentity, selected, timer);
      learningRef.current = undefined;
      setQuestion(testingRef.current.current(Date.now()));
    }
    setScreen("session");
  };
  const start = () => {
    if (!activeCourse || questionSet.questions.length === 0) return;
    const courseProgress = localState.knowledgeProgress.filter((record) => record.courseId === activeCourse.id);
    const courseDifficulty = localState.difficultyRecords.filter((record) => record.courseId === activeCourse.id);
    const projectTotal = progressSummary(questionSet.questions, activeCourse.id, courseProgress).eligibleProjects;
    const selectedCount = coverageMode === "all"
      ? projectTotal
      : Math.min(questionLimit, projectTotal);
    const selection = mode === "learning"
      ? selectLearningQuestions(questionSet.questions, selectedCount, activeCourse.id, courseProgress, courseDifficulty, difficultFirst, { next: Math.random })
      : selectTestingQuestions(questionSet.questions, selectedCount, activeCourse.id, courseProgress, courseDifficulty, difficultFirst, { next: Math.random });
    beginSession(selection.questions, mode);
  };
  const submit = () => {
    if (!question || feedback) return;
    playbackRef.current?.cancel();
    const evaluation = evaluateAnswer(question.acceptedAnswers, answer);
    if (mode === "learning") {
      learningRef.current!.answer(question.id, evaluation, undefined, answer ? [answer] : []);
      const saved = learningRef.current!.save();
      setNeedsAnother(saved.progress.queue.some((entry) => entry.question.id === question.id));
    } else {
      testingRef.current!.submit(question.id, { evaluation, submittedAnswers: answer ? [answer] : [] }, Date.now());
    }
    setFeedback(evaluation);
  };
  const timeout = () => {
    if (!question || feedback || mode !== "testing") return;
    const record = testingRef.current!.expire(Date.now());
    if (record) setFeedback(record.evaluation);
  };
  const completeLearning = () => {
    const records = learningRef.current?.records() ?? [];
    const courseId = learningRef.current?.save().courseId ?? activeCourse?.id;
    if (!courseId) return;
    const memory = new DifficultyMemory(localState.difficultyRecords);
    memory.completeSession(records.flatMap((entry) => entry.question ? [{
      courseId,
      objectId: entry.question.objectId,
      score: entry.evaluation.score,
      fullyCorrect: entry.evaluation.fullyCorrect,
    }] : []));
    const history = learningRef.current!.history();
    const cleaned = appendLearningHistory(removeLearningSession(localState, courseId), history);
    persist({
      ...cleaned,
      courses: {
        ...cleaned.courses,
        [courseId]: {
          lastOpenedAt: new Date().toISOString(),
          completedSessions: (cleaned.courses[courseId]?.completedSessions ?? 0) + 1,
        },
      },
      difficultyRecords: [...memory.snapshot()],
      knowledgeProgress: updateKnowledgeProgress(
        cleaned.knowledgeProgress,
        courseId,
        records,
        "learning",
        history.completedAt,
      ),
    });
    setResult(undefined); setScreen("results");
  };
  const completeTest = () => {
    const history = testingRef.current!.history();
    const memory = new DifficultyMemory(localState.difficultyRecords);
    memory.completeSession(history.summary.records.map((entry) => ({
      courseId: history.courseId,
      objectId: entry.question.objectId,
      score: entry.evaluation.score,
      fullyCorrect: entry.evaluation.fullyCorrect,
    })));
    const withHistory = appendTestHistory(localState, history);
    persist({
      ...withHistory,
      difficultyRecords: [...memory.snapshot()],
      knowledgeProgress: updateKnowledgeProgress(
        withHistory.knowledgeProgress,
        history.courseId,
        history.summary.records,
        "testing",
        history.completedAt,
      ),
    });
    setResult(history); setScreen("results");
  };
  const next = () => {
    playbackRef.current?.cancel();
    if (mode === "learning") {
      if (learningRef.current!.isComplete()) { completeLearning(); return; }
      setQuestion(learningRef.current!.current());
    } else {
      if (testingRef.current!.isComplete()) { completeTest(); return; }
      setQuestion(testingRef.current!.current(Date.now()));
    }
    setPosition((value) => value + 1);
    setAnswer(""); setFeedback(undefined); setNeedsAnother(false);
  };
  const saveAndExit = () => {
    playbackRef.current?.cancel();
    if (mode === "learning" && learningRef.current) {
      persist(saveLearningSession(localState, learningRef.current.save()));
    }
    setScreen("courses");
  };
  const resume = (record: LearningSessionRecord) => {
    const course = loadedCourses.find((entry) => entry.id === record.courseId);
    if (!course) return;
    playbackRef.current?.cancel();
    const controller = LearningSessionController.resume(record);
    learningRef.current = controller; testingRef.current = undefined;
    setActiveCourse(course); setMode("learning"); setCourseTitle(record.courseTitle);
    setQuestions(record.progress.queue.map((entry) => entry.question));
    setSessionTotal(record.progress.queue.length + record.progress.completedQuestionIds.length);
    setPosition(record.progress.completedQuestionIds.length + 1);
    setQuestion(controller.current()); setAnswer(""); setFeedback(undefined); setNeedsAnother(false);
    setScreen("session");
  };
  const changeLocale = (value: Locale) => {
    setLocale(value);
    persist({ ...localState, settings: { ...localState.settings, locale: value } });
  };
  const changeMode = (value: Mode) => { setMode(value); persistSettings({ mode: value }); };
  const changeTimer = (value: Timer) => { setTimer(value); persistSettings({ timerSeconds: value }); };
  const changeStrict = (value: boolean) => { setStrict(value); persistSettings({ strictDistractors: value }); };
  const changeQuestionLimit = (value: number) => { setQuestionLimit(value); persistSettings({ questionLimit: value }); };
  const changeCoverageMode = (value: CoverageMode) => { setCoverageMode(value); persistSettings({ coverageMode: value }); };
  const changeKinds = (value: EnabledKinds) => { setKinds(value); persistSettings({ enabledKinds: value }); };
  const changeDirections = (value: EnabledDirections) => { setDirections(value); persistSettings({ enabledDirections: value }); };
  const changePlayerVolume = (value: number) => {
    const normalized = Math.min(1, Math.max(0, value));
    setPlayerVolume(normalized);
    persistSettings({ playerVolume: normalized });
  };
  const removeCourse = (course: Course) => {
    if (!window.confirm(translate(locale, "removeCourseConfirm"))) return;
    setLoadedCourses((current) => current.filter((entry) => entry.id !== course.id));
    if (activeCourse?.id === course.id) {
      setActiveCourse(undefined);
      setCourseTitle("");
      setFilters([]);
      setScreen("courses");
    }
    const removedCourseIds = [...new Set([...localState.settings.removedCourseIds, course.id])];
    const settings = { ...localState.settings, removedCourseIds };
    if (settings.recentCourseId === course.id) delete settings.recentCourseId;
    persist({ ...localState, settings });
  };
  const refreshCourseLibrary = async () => {
    const rootDirectory = localState.settings.courseRoot;
    if (!rootDirectory || !window.znawca?.scanCourseRoot) return;
    const library = await window.znawca.scanCourseRoot(rootDirectory);
    const removedCourseIds = new Set(localState.settings.removedCourseIds);
    const visibleReports = library.reports.filter((report) =>
      !report.course || !removedCourseIds.has(report.course.id));
    const courses = visibleReports.flatMap((report) =>
      report.canOpen && report.course ? [report.course] : []);
    setLoadedCourses(courses);
    setCourseIssues(visibleReports.flatMap((report) => report.issues));
    if (activeCourse) {
      const refreshed = courses.find((course) => course.id === activeCourse.id);
      if (refreshed) {
        setActiveCourse(refreshed);
        setCourseTitle(refreshed.title);
      } else {
        setActiveCourse(undefined);
        setCourseTitle("");
        setFilters([]);
        setScreen("courses");
      }
    }
  };
  const addCourse = async (importMode?: "scan" | "organize") => {
    if (importMode && window.znawca?.chooseCourseRoot) {
      const library = await window.znawca.chooseCourseRoot(importMode);
      if (!library) return;
      const courses = library.reports.flatMap((report) =>
        report.canOpen && report.course ? [report.course] : []);
      setCourseIssues(library.reports.flatMap((report) => report.issues));
      setImportNotice(library.organization
        ? formatOrganizationNotice(locale, library.organization)
        : undefined);
      if (courses.length === 0) return;
      const restoredCourseIds = new Set(courses.map((course) => course.id));
      setLoadedCourses(courses);
      persist({
        ...localState,
        settings: {
          ...localState.settings,
          courseRoot: library.rootDirectory,
          removedCourseIds: localState.settings.removedCourseIds.filter((id) => !restoredCourseIds.has(id)),
          recentCourseId: courses[0].id,
        },
      });
      setCourseTitle(courses[0].title);
      setActiveCourse(courses[0]);
      setFilters([]);
      return;
    }

    const report = await window.znawca?.chooseCourse();
    if (!report) return;
    setCourseIssues(report.issues);
    if (report.canOpen && report.course) {
      setLoadedCourses((current) => [...current.filter((entry) => entry.id !== report.course!.id), report.course!]);
      setCourseTitle(report.course.title);
      setActiveCourse(report.course);
      setFilters([]);
      setScreen("setup");
      persistSettings({
        recentCourseId: report.course.id,
        removedCourseIds: localState.settings.removedCourseIds.filter((id) => id !== report.course!.id),
      });
    }
  };
  const contextCourseId = screen === "courses" ? undefined : activeCourse?.id;
  const contextLearningHistory = contextCourseId
    ? localState.learningHistory.filter((record) => record.courseId === contextCourseId)
    : [];
  const contextTestHistory = contextCourseId
    ? localState.testHistory.filter((record) => record.courseId === contextCourseId)
    : [];
  const contextDifficulty = contextCourseId
    ? localState.difficultyRecords.filter((record) => record.courseId === contextCourseId)
    : [];
  const replayRecord = replay
    ? ((replay.kind === "learning" && screen === "learning-history") || (replay.kind === "test" && screen === "test-history")
      ? (replay.kind === "learning" ? contextLearningHistory : contextTestHistory).find((record) => record.id === replay.recordId)
      : undefined)
    : undefined;
  const replayAnswers = (replay && replayRecord
    ? replay.kind === "learning"
      ? (replayRecord as LearningHistoryRecord).records
      : (replayRecord as TestHistoryRecord).summary.records
    : undefined) as ReadonlyArray<{ questionId: string; question?: Question; submittedAnswers: readonly string[]; evaluation: AnswerEvaluation }> | undefined;

  return <main className="app-shell">
    <Header locale={locale} onHome={() => setScreen("courses")} onSettings={() => setSettingsOpen(true)} />
    <div className="workspace">
      <section className={`content${screen === "courses" ? " content-courses" : ""}${screen === "setup" ? " content-setup" : ""}${(screen === "difficulty" || screen === "learning-history" || screen === "test-history") ? " content-list" : ""}`}>
        {contextCourseId && (screen === "setup" || screen === "learning-history" || screen === "test-history" || screen === "difficulty") &&
          <CourseContextNav locale={locale} course={courseTitle} screen={screen}
            learningHistoryCount={contextLearningHistory.length}
            testHistoryCount={contextTestHistory.length}
            difficultyCount={contextDifficulty.length}
            onCourses={() => setScreen("courses")} onSetup={() => setScreen("setup")}
            onLearningHistory={() => setScreen("learning-history")}
            onTestHistory={() => setScreen("test-history")} onDifficulty={() => setScreen("difficulty")} />}
        {screen === "courses" && <Courses locale={locale} loadedCourses={loadedCourses} issues={courseIssues} importNotice={importNotice} resumable={Object.values(localState.learningSessions).filter((record) => loadedCourses.some((course) => course.id === record.courseId))} onResume={resume} onRemove={removeCourse} canRefresh={Boolean(localState.settings.courseRoot && window.znawca?.scanCourseRoot)} onRefresh={refreshCourseLibrary} onAdd={async () => {
          if (window.znawca?.chooseCourseRoot) setImportChoiceOpen(true);
          else await addCourse();
        }} onSelect={(selected) => {
          setCourseTitle(selected.title); setActiveCourse(selected); setFilters([]); setScreen("setup");
          persistSettings({ recentCourseId: selected.id });
        }} />}
        {screen === "setup" && activeCourse && <Setup locale={locale} course={courseTitle} courseData={activeCourse} filters={filters} setFilters={setFilters} kinds={kinds} setKinds={changeKinds} directions={directions} setDirections={changeDirections} coverageMode={coverageMode} setCoverageMode={changeCoverageMode} questionLimit={questionLimit} setQuestionLimit={changeQuestionLimit} mode={mode} setMode={changeMode} timer={timer} setTimer={changeTimer} strict={strict} setStrict={changeStrict} questionSet={questionSet} capabilitySet={capabilitySet} progress={localState.knowledgeProgress.filter((record) => record.courseId === activeCourse.id)} onStart={start} />}
        {screen === "session" && question && <Session locale={locale} question={question} course={courseTitle} mode={mode} timer={timer} volume={playerVolume} onVolume={changePlayerVolume} position={position} total={sessionTotal} answer={answer} setAnswer={setAnswer} feedback={feedback} needsAnother={needsAnother} onSubmit={submit} onTimeout={timeout} onSaveExit={saveAndExit} onNext={next} />}
        {screen === "results" && <Results locale={locale} learningTotal={sessionTotal} history={result} reviewOpen={reviewOpen} setReviewOpen={setReviewOpen} onAgain={start} onCourses={() => setScreen("courses")} volume={playerVolume} onVolume={setPlayerVolume} />}
        {screen === "learning-history" && (replay && replayAnswers ? <ReplayView locale={locale} course={courseTitle} kind={replay.kind} answers={replayAnswers} index={replay.index} volume={playerVolume} onVolume={setPlayerVolume} onIndex={(value) => setReplay({ ...replay, index: value })} onExit={() => setReplay(undefined)} /> : <LearningHistory locale={locale} records={contextLearningHistory} onOpen={(record) => setReplay({ kind: "learning", recordId: record.id, index: 0 })} />)}
        {screen === "test-history" && (replay && replayAnswers ? <ReplayView locale={locale} course={courseTitle} kind={replay.kind} answers={replayAnswers} index={replay.index} volume={playerVolume} onVolume={setPlayerVolume} onIndex={(value) => setReplay({ ...replay, index: value })} onExit={() => setReplay(undefined)} /> : <TestHistory locale={locale} records={contextTestHistory} onOpen={(record) => setReplay({ kind: "test", recordId: record.id, index: 0 })} />)}
        {screen === "difficulty" && <Difficulty locale={locale} course={activeCourse} records={contextDifficulty}
          onClear={() => {
            if (contextCourseId && window.confirm(translate(locale, "clearConfirm"))) {
              persist(clearCourseDifficulty(localState, contextCourseId));
            }
          }}
          onRemove={(record) => {
            if (contextCourseId) {
              persist(removeDifficultyRecord(localState, contextCourseId, record.objectId));
            }
          }}
          onPractice={(record) => {
            if (!activeCourse) return;
            const candidates = reviewQuestionSet.questions.filter((entry) =>
              entry.objectId === record.objectId);
            const selected = candidates.slice(0, Math.min(4, candidates.length));
            beginSession(selected, "learning");
          }} />}
      </section>
    </div>
    {importChoiceOpen && <CourseImportChoiceDialog locale={locale}
      onChoose={(mode) => {
        setImportChoiceOpen(false);
        void addCourse(mode);
      }}
      onClose={() => setImportChoiceOpen(false)} />}
    {settingsOpen && <SettingsDialog locale={locale} onLocale={changeLocale}
      onClearLearning={() => {
        if (window.confirm(translate(locale, "clearConfirm"))) persist({ ...localState, courses: {}, learningSessions: {}, learningHistory: [], knowledgeProgress: [] });
      }}
      onClearTests={() => {
        if (window.confirm(translate(locale, "clearConfirm"))) persist({ ...localState, testHistory: [] });
      }}
      onClearAll={() => {
        if (!window.confirm(translate(locale, "clearConfirm"))) return;
        const reset = defaultLocalState();
        persist(reset);
        setLocale(reset.settings.locale); setMode(reset.settings.mode); setTimer(reset.settings.timerSeconds);
        setStrict(reset.settings.strictDistractors); setDifficultFirst(reset.settings.difficultFirst);
        setCoverageMode(reset.settings.coverageMode); setQuestionLimit(reset.settings.questionLimit); setKinds(reset.settings.enabledKinds);
        setDirections(defaultDirections); setPlayerVolume(reset.settings.playerVolume);
        setLoadedCourses([]); setActiveCourse(undefined); setCourseIssues([]); setSettingsOpen(false); setScreen("courses");
      }}
      onClose={() => setSettingsOpen(false)} />}
  </main>;
}

function Header({ locale, onHome, onSettings }: { locale: Locale; onHome(): void; onSettings(): void }) {
  return <header className="title-bar"><button className="brand" type="button" onClick={onHome}><span className="brand-mark">Z</span><span>Znawca</span></button><div className="title-actions"><button className="icon-button" type="button" aria-label={translate(locale, "settings")} title={translate(locale, "interfaceLanguage")} onClick={onSettings}>⚑</button></div></header>;
}

const importChoiceCopy: Record<Locale, {
  title: string;
  detail: string;
  scanTitle: string;
  scanDetail: string;
  organizeTitle: string;
  organizeDetail: string;
}> = {
  en: {
    title: "How should Znawca use this folder?",
    detail: "Whichever option you choose, Znawca scans the selected folder first and only creates courses that pass validation.",
    scanTitle: "Scan without organizing",
    scanDetail: "Use a folder that already follows the course structure. No files are changed.",
    organizeTitle: "Organize a new copy",
    organizeDetail: "Create a separate standardized copy based on workbook and media names. The original folder is never changed.",
  },
  pl: {
    title: "Jak Znawca ma użyć tego folderu?",
    detail: "Niezależnie od wyboru Znawca najpierw skanuje folder i tworzy tylko kursy, które przejdą walidację.",
    scanTitle: "Skanuj bez porządkowania",
    scanDetail: "Użyj folderu, który już ma strukturę kursu. Żaden plik nie zostanie zmieniony.",
    organizeTitle: "Uporządkuj nową kopię",
    organizeDetail: "Utwórz oddzielną kopię na podstawie nazw skoroszytów i multimediów. Oryginał pozostanie bez zmian.",
  },
  "zh-CN": {
    title: "希望如何使用这个文件夹？",
    detail: "无论选择哪种方式，Znawca 都会先扫描所选文件夹，只有符合条件的内容才会被创建为课程。",
    scanTitle: "仅扫描，不组织文件",
    scanDetail: "适用于已经符合课程目录结构的文件夹，不会修改任何文件。",
    organizeTitle: "组织一个新的副本",
    organizeDetail: "根据 Excel 和媒体文件名创建独立的规范化副本，原始文件夹始终保持不变。",
  },
  ar: {
    title: "كيف يستخدم Znawca هذا المجلد؟",
    detail: "في كلتا الحالتين يفحص Znawca المجلد أولاً، ولا ينشئ إلا الدورات التي تجتاز التحقق.",
    scanTitle: "فحص دون تنظيم",
    scanDetail: "استخدم مجلداً منظماً مسبقاً. لن يتم تعديل أي ملف.",
    organizeTitle: "تنظيم نسخة جديدة",
    organizeDetail: "أنشئ نسخة مستقلة ومنظمة اعتماداً على أسماء الملفات، مع إبقاء الأصل دون تغيير.",
  },
  ru: {
    title: "Как Znawca должен использовать эту папку?",
    detail: "При любом выборе Znawca сначала проверяет папку и создаёт только курсы, прошедшие проверку.",
    scanTitle: "Проверить без организации",
    scanDetail: "Использовать уже подготовленную структуру курса. Файлы не изменяются.",
    organizeTitle: "Организовать новую копию",
    organizeDetail: "Создать отдельную упорядоченную копию по именам книг и медиафайлов. Исходная папка не изменяется.",
  },
};

function CourseImportChoiceDialog({ locale, onChoose, onClose }: {
  locale: Locale;
  onChoose(mode: "scan" | "organize"): void;
  onClose(): void;
}) {
  const copy = importChoiceCopy[locale];
  return <div className="dialog-backdrop">
    <section className="demo-dialog import-choice-dialog" role="dialog" aria-modal="true" aria-labelledby="import-choice-title">
      <button className="dialog-close" type="button" aria-label={translate(locale, "close")} onClick={onClose}>×</button>
      <p className="eyebrow">ZNAWCA</p>
      <h1 id="import-choice-title">{copy.title}</h1>
      <p className="import-choice-detail">{copy.detail}</p>
      <div className="import-choice-actions">
        <button className="import-choice-card" type="button" onClick={() => onChoose("scan")}>
          <strong>{copy.scanTitle}</strong>
          <span>{copy.scanDetail}</span>
        </button>
        <button className="import-choice-card is-recommended" type="button" onClick={() => onChoose("organize")}>
          <strong>{copy.organizeTitle}</strong>
          <span>{copy.organizeDetail}</span>
        </button>
      </div>
    </section>
  </div>;
}

function formatOrganizationNotice(locale: Locale, summary: CourseOrganizationSummary): string {
  if (locale === "zh-CN") {
    return `已创建整理副本：${summary.organizedDirectory}（${summary.workbookCount} 个 Excel，${summary.copiedMediaCount} 个媒体文件，${summary.unmatchedMediaCount} 个未匹配）`;
  }
  return `Organized copy created at ${summary.organizedDirectory} (${summary.workbookCount} workbook(s), ${summary.copiedMediaCount} media copied, ${summary.unmatchedMediaCount} unmatched).`;
}

const historyCopy: Record<Locale, {
  learningHistory: string;
  testHistory: string;
  noLearningHistory: string;
  noTestHistory: string;
  attempts: string;
  answerComparison: string;
  correct: string;
  incorrect: string;
  replayTitle: string;
  backToList: string;
  noAnswerRecord: string;
}> = {
  en: { learningHistory: "Learning history", testHistory: "Test history", noLearningHistory: "No completed learning sessions yet.", noTestHistory: "No completed tests yet.", attempts: "Attempts", answerComparison: "Question and answer comparison", correct: "Correct", incorrect: "Incorrect", replayTitle: "Answer replay", backToList: "Back to list", noAnswerRecord: "This question's data is missing." },
  pl: { learningHistory: "Historia nauki", testHistory: "Historia testów", noLearningHistory: "Brak ukończonych sesji nauki.", noTestHistory: "Brak ukończonych testów.", attempts: "Próby", answerComparison: "Porównanie pytań i odpowiedzi", correct: "Poprawnie", incorrect: "Błędnie", replayTitle: "Powtórka odpowiedzi", backToList: "Wróć do listy", noAnswerRecord: "Brak danych tego pytania." },
  "zh-CN": { learningHistory: "学习历史", testHistory: "测试历史", noLearningHistory: "暂无已完成的学习记录。", noTestHistory: "暂无已完成的测试记录。", attempts: "作答次数", answerComparison: "题目与答案对照", correct: "正确", incorrect: "错误", replayTitle: "答题回放", backToList: "返回列表", noAnswerRecord: "该题数据缺失。" },
  ar: { learningHistory: "سجل التعلم", testHistory: "سجل الاختبارات", noLearningHistory: "لا توجد جلسات تعلم مكتملة.", noTestHistory: "لا توجد اختبارات مكتملة.", attempts: "المحاولات", answerComparison: "مقارنة السؤال والإجابة", correct: "صحيح", incorrect: "خطأ", replayTitle: "إعادة تشغيل الإجابات", backToList: "العودة إلى القائمة", noAnswerRecord: "بيانات هذا السؤال مفقودة." },
  ru: { learningHistory: "История обучения", testHistory: "История тестов", noLearningHistory: "Завершённых учебных сессий пока нет.", noTestHistory: "Завершённых тестов пока нет.", attempts: "Попытки", answerComparison: "Сопоставление вопросов и ответов", correct: "Верно", incorrect: "Неверно", replayTitle: "Повтор ответов", backToList: "Назад к списку", noAnswerRecord: "Данные этого вопроса отсутствуют." },
};

const setupCopy: Record<Locale, { fullCoverage: string; sample: string; perQuestionTimer: string; learned: string; mastered: string; unseen: string; projects: string }> = {
  en: { fullCoverage: "The entire set", sample: "Smart batch", perQuestionTimer: "Per-question timer", learned: "learned", mastered: "mastered", unseen: "unseen", projects: "projects" },
  pl: { fullCoverage: "Suma obecnych projeków", sample: "Inteligentnie dobrany zestaw pytań", perQuestionTimer: "Czas na pytanie", learned: "poznano", mastered: "opanowano", unseen: "niepoznane", projects: "projekty" },
  "zh-CN": { fullCoverage: "本次全部项目", sample: "智能安排", perQuestionTimer: "每题计时", learned: "已学习", mastered: "已掌握", unseen: "未接触", projects: "个项目" },
  ar: { fullCoverage: "كل المشاريع هذه المرة", sample: "دفعة ذكية", perQuestionTimer: "مؤقت لكل سؤال", learned: "تم تعلمه", mastered: "تم إتقانه", unseen: "غير مرئي", projects: "مشاريع" },
  ru: { fullCoverage: "Все проекты сейчас", sample: "Умная группа", perQuestionTimer: "Таймер на вопрос", learned: "изучено", mastered: "освоено", unseen: "не просмотрено", projects: "проекты" },
};

const difficultyCardCopy: Record<Locale, { recovery: string; practice: string; confirmDelete: string }> = {
  en: { recovery: "Consecutive correct", practice: "Review", confirmDelete: "Confirm" },
  pl: { recovery: "Poprawne z rzędu", practice: "Ćwicz", confirmDelete: "Potwierdź" },
  "zh-CN": { recovery: "连续答对", practice: "复习", confirmDelete: "确认删除" },
  ar: { recovery: "إجابات صحيحة متتالية", practice: "تدرب", confirmDelete: "تأكيد" },
  ru: { recovery: "Верно подряд", practice: "Повторить", confirmDelete: "Подтвердить" },
};

function CourseContextNav({ locale, course, screen, learningHistoryCount, testHistoryCount, difficultyCount, onCourses, onSetup, onLearningHistory, onTestHistory, onDifficulty }: { locale: Locale; course: string; screen: Screen; learningHistoryCount: number; testHistoryCount: number; difficultyCount: number; onCourses(): void; onSetup(): void; onLearningHistory(): void; onTestHistory(): void; onDifficulty(): void }) {
  const copy = historyCopy[locale];
  return <nav className="course-context-nav" aria-label={course}><button className="course-context-back" type="button" onClick={onCourses}>← {translate(locale, "courses")}</button><strong dir="auto">{course}</strong><div><button type="button" aria-current={screen === "setup" ? "page" : undefined} onClick={onSetup}>{translate(locale, "learning")} / {translate(locale, "testing")}</button><button type="button" aria-current={screen === "learning-history" ? "page" : undefined} onClick={onLearningHistory}>{copy.learningHistory} <small>{learningHistoryCount}</small></button><button type="button" aria-current={screen === "test-history" ? "page" : undefined} onClick={onTestHistory}>{copy.testHistory} <small>{testHistoryCount}</small></button><button type="button" aria-current={screen === "difficulty" ? "page" : undefined} onClick={onDifficulty}>{translate(locale, "difficultItems")} <small>{difficultyCount}</small></button></div></nav>;
}

const courseMediaLabels: Record<Locale, { images: string; audio: string; video: string; text: string }> = {
  en: { images: "Images", audio: "Audio", video: "Video", text: "Text" },
  pl: { images: "Obrazy", audio: "Dźwięk", video: "Wideo", text: "Tekst" },
  "zh-CN": { images: "图片", audio: "音频", video: "视频", text: "文字" },
  ar: { images: "صور", audio: "صوت", video: "فيديو", text: "نص" },
  ru: { images: "Изображения", audio: "Аудио", video: "Видео", text: "Текст" },
};
interface CoursesProps { locale: Locale; loadedCourses: Course[]; issues: readonly CourseIssue[]; importNotice?: string; resumable: LearningSessionRecord[]; canRefresh: boolean; onResume(record: LearningSessionRecord): void; onAdd(): Promise<void>; onRefresh(): Promise<void>; onSelect(course: Course): void; onRemove(course: Course): void }
function Courses({ locale, loadedCourses, issues, importNotice, resumable, canRefresh, onResume, onAdd, onRefresh, onSelect, onRemove }: CoursesProps) {
  return <div className="page-courses">
    <div className="page-heading"><div><p className="eyebrow">{translate(locale, "courses").toUpperCase()}</p><h1>{translate(locale, "chooseMaster")}</h1><p>{translate(locale, "privacyDetail")}</p></div><div className="page-heading-actions">{canRefresh && <button className="metal-button" type="button" onClick={() => void onRefresh()}>{translate(locale, "refreshLibrary")}</button>}<button className="gold-button" type="button" onClick={() => void onAdd()}>{translate(locale, "addCourse")}</button></div></div>
    <div className="courses-scrollable">
      {resumable.map((record) => <div className="local-banner" key={record.id}><strong>{record.courseTitle}</strong><span>{translate(locale, "unfinishedSession")} {new Date(record.savedAt).toLocaleString(locale)}</span><button className="gold-button" type="button" onClick={() => onResume(record)}>{translate(locale, "resumeLearning")}</button></div>)}
      {importNotice && <div className="local-banner import-result" role="status"><strong>{importNotice}</strong></div>}
      {issues.length > 0 && <div className="course-errors" role="alert"><strong>{issues.some((entry) => entry.severity === "error") ? translate(locale, "courseNeedsAttention") : translate(locale, "courseWarnings")}</strong>{issues.map((entry, index) => { const text = entry.code === "ITEM_NAME_EMPTY" ? formatItemNameEmpty(locale, entry.location.row ?? 0, entry.params?.filledColumns ?? []) : { message: entry.message, suggestion: entry.suggestion }; return <article key={`${entry.code}-${entry.location.file}-${index}`}><p><b>{entry.code}</b> — {text.message} {text.suggestion}</p><small>{formatIssueLocation(locale, entry)}</small></article>; })}</div>}
      <div className="course-grid">{loadedCourses.map((entry) => <CourseCard locale={locale} key={entry.id} name={entry.title} meta={`${entry.items.length} ${translate(locale, "objects")} / ${entry.columns.length}`} symbol={entry.title.slice(0, 1).toUpperCase()} onClick={() => onSelect(entry)} onRemove={() => onRemove(entry)} />)}</div>
    </div>
  </div>;
}
function CourseCard({ locale, name, meta, symbol, onClick, onRemove }: { locale: Locale; name: string; meta: string; symbol: string; onClick(): void; onRemove?(): void }) {
  return <article className={`course-card ${name.toLowerCase()}`}><div className="course-art"><span>{symbol}</span></div><div className="course-copy"><h2>{name}</h2><p>{meta}</p><div className="course-actions"><button className="metal-button" type="button" onClick={onClick}>{translate(locale, "openCourse")}</button>{onRemove && <button className="course-remove-button" type="button" aria-label={`${translate(locale, "removeCourse")} ${name}`} onClick={onRemove}>{translate(locale, "removeCourse")}</button>}</div></div></article>;
}

function formatIssueLocation(locale: Locale, issue: CourseIssue): string {
  const parts = [`${translate(locale, "file")}: ${issue.location.file}`];
  if (issue.location.sheet) parts.push(`${translate(locale, "sheet")}: ${issue.location.sheet}`);
  if (issue.location.row) parts.push(`${translate(locale, "row")}: ${issue.location.row}`);
  if (issue.location.column) parts.push(`${translate(locale, "column")}: ${issue.location.column}`);
  return parts.join(" · ");
}

interface SetupProps { locale: Locale; course: string; courseData: Course; filters: FilterSelection[]; setFilters(value: FilterSelection[]): void; kinds: EnabledKinds; setKinds(value: EnabledKinds): void; directions: EnabledDirections; setDirections(value: EnabledDirections): void; coverageMode: CoverageMode; setCoverageMode(value: CoverageMode): void; questionLimit: number; setQuestionLimit(value: number): void; mode: Mode; setMode(value: Mode): void; timer: Timer; setTimer(value: Timer): void; strict: boolean; setStrict(value: boolean): void; questionSet: CourseQuestionSet; capabilitySet: CourseQuestionSet; progress: LocalState["knowledgeProgress"]; onStart(): void }
function Setup(props: SetupProps) {
  const [unavailableNotice, setUnavailableNotice] = useState<{ id: number; message: string }>();
  const [openSection, setOpenSection] = useState<"types" | "scope" | "strategy" | "timer">();
  useEffect(() => {
    if (!unavailableNotice) return;
    const timeout = window.setTimeout(() => setUnavailableNotice(undefined), 2500);
    return () => window.clearTimeout(timeout);
  }, [unavailableNotice]);
  const options = filterOptions(props.courseData);
  const objects = filteredCourseObjects(props.courseData, props.filters).length;
  const summary = progressSummary(props.questionSet.questions, props.courseData.id, props.progress);
  const available = summary.eligibleProjects;
  const selectedQuestionCount = available === 0
    ? 0
    : props.coverageMode === "all"
      ? available
      : questionLimitFor(available, props.questionLimit);
  const selectedFilterCount = props.filters.filter((entry) => entry.values.length > 0).length;
  const directionCount = (direction: QuestionDirection) => props.capabilitySet.availability.byDirection[direction] ?? 0;
  const selectedTypeCount =
    Number(props.kinds.input) +
    Number(props.kinds.choice) +
    directionLabels.filter(([direction]) => props.directions[direction] && directionCount(direction) > 0).length;
  const toggleFilter = (field: string, value: string) => {
    const current = props.filters.find((entry) => entry.field === field)?.values ?? [];
    const values = current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value];
    props.setFilters([...props.filters.filter((entry) => entry.field !== field), { field, values }]);
  };
  const explainUnavailable = (label: MessageKey) => {
    setUnavailableNotice({
      id: Date.now(),
      message: `${translate(props.locale, label)}: ${translate(props.locale, "unavailableReason")}`,
    });
  };
  const toggleSection = (section: "types" | "scope" | "strategy" | "timer") =>
    setOpenSection((current) => current === section ? undefined : section);
  const copy = setupCopy[props.locale];
  return <div className="page setup-page">
    <header className="setup-heading">
      <div><p className="eyebrow">{props.course.toUpperCase()} / {translate(props.locale, "sessionSetup").toUpperCase()}</p><h1>{translate(props.locale, "shapeSession")}</h1></div>
      <div className="setup-primary">
        <div className="segmented compact-segmented" aria-label={translate(props.locale, "mode")}><button className={props.mode === "learning" ? "active" : ""} onClick={() => props.setMode("learning")}>{translate(props.locale, "learning")}</button><button className={props.mode === "testing" ? "active" : ""} onClick={() => props.setMode("testing")}>{translate(props.locale, "testing")}</button></div>
        <div className="coverage-control" aria-label={translate(props.locale, "questions")}>
          <button className={props.coverageMode === "sample" ? "active" : ""} type="button" aria-label={copy.sample} onClick={() => props.setCoverageMode("sample")}>{copy.sample}<small>{props.questionLimit}</small></button>
          <button className={props.coverageMode === "all" ? "active" : ""} type="button" aria-label={copy.fullCoverage} onClick={() => props.setCoverageMode("all")}>{copy.fullCoverage}<small>{available}</small></button>
          {props.coverageMode === "sample" && available > 0 && <label className="compact-field"><input aria-label={translate(props.locale, "questions")} type="number" min={available < 3 ? 1 : 3} max={Math.max(1, available)} value={Math.min(selectedQuestionCount, Math.max(1, available))} onChange={(event) => props.setQuestionLimit(questionLimitFor(available, Number(event.target.value) || 1))} /><small>/ {available}</small></label>}
        </div>
      </div>
    </header>
    <div className="setup-disclosures">
      <section className={`setup-disclosure${openSection === "types" ? " is-open" : ""}`}>
        <button className="setup-disclosure-toggle" type="button" aria-expanded={openSection === "types"} onClick={() => toggleSection("types")}><span><strong>{translate(props.locale, "questionTypes")}</strong><small>{selectedTypeCount} · {props.questionSet.availability.input} {translate(props.locale, "inputAvailable")} · {props.questionSet.availability.choice} {translate(props.locale, "choiceAvailable")}</small></span><b aria-hidden="true">{openSection === "types" ? "−" : "+"}</b></button>
        {openSection === "types" && <div className="setup-disclosure-body"><div className="check-grid"><label><input type="checkbox" checked={props.kinds.input} onChange={() => props.setKinds({ ...props.kinds, input: !props.kinds.input })} /> {translate(props.locale, "textInput")}</label><label><input type="checkbox" checked={props.kinds.choice} onChange={() => props.setKinds({ ...props.kinds, choice: !props.kinds.choice })} /> {translate(props.locale, "multipleChoice")}</label>{directionLabels.map(([key, label]) => { const count = directionCount(key); if (count === 0) return <div key={key} className="unavailable-option" role="button" tabIndex={0} title={translate(props.locale, "unavailableReason")} onClick={() => explainUnavailable(label)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); explainUnavailable(label); } }}><input type="checkbox" disabled aria-label={translate(props.locale, label)} /><span>{translate(props.locale, label)} <small aria-hidden="true">{count}</small></span></div>; return <label key={key}><input type="checkbox" checked={props.directions[key]} onChange={() => props.setDirections({ ...props.directions, [key]: !props.directions[key] })} /> {translate(props.locale, label)} <small aria-hidden="true">{count}</small></label>; })}</div></div>}
      </section>
      <section className={`setup-disclosure${openSection === "scope" ? " is-open" : ""}`}>
        <button className="setup-disclosure-toggle" type="button" aria-expanded={openSection === "scope"} onClick={() => toggleSection("scope")}><span><strong>{translate(props.locale, "scopeFilters")}</strong><small>{objects} {translate(props.locale, "objects")} · {selectedFilterCount}</small></span><b aria-hidden="true">{openSection === "scope" ? "−" : "+"}</b></button>
        {openSection === "scope" && <div className="setup-disclosure-body filter-disclosure">{Object.entries(options).map(([field, values]) => <fieldset className="filter-group" key={field}><legend>{field.startsWith("#") ? field.slice(1).trim() : field}</legend>{values.map((value) => <label key={value}><input type="checkbox" checked={props.filters.find((entry) => entry.field === field)?.values.includes(value) ?? false} onChange={() => toggleFilter(field, value)} /> {value}</label>)}</fieldset>)}{Object.keys(options).length === 0 && <p className="filter-empty">{translate(props.locale, "noFilters")}</p>}</div>}
      </section>
      <section className={`setup-disclosure${openSection === "strategy" ? " is-open" : ""}`}>
        <button className="setup-disclosure-toggle" type="button" aria-expanded={openSection === "strategy"} onClick={() => toggleSection("strategy")}><span><strong>{translate(props.locale, "teachingStyle")}</strong><small>{translate(props.locale, props.strict ? "strict" : "lenient")}</small></span><b aria-hidden="true">{openSection === "strategy" ? "−" : "+"}</b></button>
        {openSection === "strategy" && <div className="setup-disclosure-body strategy-disclosure"><div className="segmented"><button className={props.strict ? "active" : ""} onClick={() => props.setStrict(true)}>{translate(props.locale, "strict")}<small>{translate(props.locale, "strictHelp")}</small></button><button className={!props.strict ? "active" : ""} onClick={() => props.setStrict(false)}>{translate(props.locale, "lenient")}<small>{translate(props.locale, "lenientHelp")}</small></button></div></div>}
      </section>
      {props.mode === "testing" && <section className={`setup-disclosure${openSection === "timer" ? " is-open" : ""}`}>
        <button className="setup-disclosure-toggle" type="button" aria-expanded={openSection === "timer"} onClick={() => toggleSection("timer")}><span><strong>{copy.perQuestionTimer}</strong><small>{props.timer === 0 ? translate(props.locale, "off") : `${props.timer}s`}</small></span><b aria-hidden="true">{openSection === "timer" ? "−" : "+"}</b></button>
        {openSection === "timer" && <div className="setup-disclosure-body timer-disclosure"><div className="timer-row">{([0, 10, 15, 20] as const).map((value) => <button key={value} className={props.timer === value ? "active" : ""} onClick={() => props.setTimer(value)}>{value === 0 ? translate(props.locale, "off") : `${value}s`}</button>)}</div></div>}
      </section>}
    </div>
    {unavailableNotice && <div className="temporary-notice" role="status" aria-live="polite" key={unavailableNotice.id}>{unavailableNotice.message}</div>}
    <footer className="setup-footer"><span><strong>{selectedQuestionCount}</strong> / {available} {copy.projects} · {summary.coveredProjects}/{summary.eligibleProjects} {copy.learned} · {summary.masteredProjects} {copy.mastered} · {summary.unseenProjects} {copy.unseen}</span><button className="gold-button large" disabled={available === 0 || (!props.kinds.input && !props.kinds.choice)} onClick={props.onStart}>{translate(props.locale, "begin")} {translate(props.locale, props.mode)}</button></footer>
  </div>;
}

function questionLimitFor(available: number, requested: number): number {
  if (available <= 0) return 1;
  const minimum = available < 3 ? 1 : 3;
  return Math.min(available, Math.max(minimum, requested));
}

// D-11：仅当选择题为纯图片/音频选项且为 3 或 4 项时启用媒体 2×2 网格标记。
// 文字选择题、视频选项（本轮排除）不适用；判定只依赖选项媒体类型与数量，
// 不改变答案数据顺序。
function isMediaGridOptions(question: Question): boolean {
  return (
    question.kind === "choice" &&
    question.options !== undefined &&
    question.options.length >= 3 &&
    question.options.length <= 4 &&
    question.options.every((option) => option.media?.kind === "image" || option.media?.kind === "audio")
  );
}

interface SessionProps { locale: Locale; question: Question; course: string; mode: Mode; timer: number; volume: number; onVolume(value: number): void; position: number; total: number; answer: string; setAnswer(value: string): void; feedback?: AnswerEvaluation; needsAnother: boolean; onSubmit(): void; onTimeout(): void; onSaveExit(): void; onNext(): void }
function Session(props: SessionProps) {
  const [remaining, setRemaining] = useState(props.timer);
  useEffect(() => {
    setRemaining(props.timer);
    if (props.mode !== "testing" || props.timer === 0 || props.feedback) return;
    const interval = window.setInterval(() => setRemaining((current) => {
      if (current > 1) return current - 1;
      window.clearInterval(interval); queueMicrotask(props.onTimeout); return 0;
    }), 1000);
    return () => window.clearInterval(interval);
  }, [props.question.id, props.mode, props.timer, props.feedback]);
  const correct = props.feedback?.fullyCorrect;
  const directionLabel = directionLabels.find(([direction]) => direction === props.question.direction)?.[1];
  return <div className="session-page"><header className="session-header"><div><p>{props.course} / {translate(props.locale, props.mode)}</p><strong>{translate(props.locale, "question")} {props.position} {translate(props.locale, "of")} {props.total}</strong></div><div className="progress-track"><span style={{ width: `${Math.min(100, props.position / Math.max(1, props.total) * 100)}%` }} /></div>{props.mode === "testing" && props.timer > 0 && <span className="timer-badge">{remaining}s</span>}</header><article className={`question-card${isMediaGridOptions(props.question) ? " media-grid-card" : ""}`}><p className="section-label">{directionLabel ? translate(props.locale, directionLabel).toUpperCase() : props.question.direction.toUpperCase()}</p><h1 dir="auto">{promptText(props.locale, props.question)}</h1>{props.question.media && <QuestionMedia locale={props.locale} media={props.question.media} volume={props.volume} onVolume={props.onVolume} />}{props.question.kind === "choice" ? <fieldset className={`choice-list${isMediaGridOptions(props.question) ? " media-grid" : ""}`} disabled={Boolean(props.feedback)}><legend>{translate(props.locale, "yourAnswer")}</legend>{props.question.options?.map((option, index) => <QuestionChoice locale={props.locale} key={option.id} option={option} index={index} selected={props.answer === option.value} volume={props.volume} onVolume={props.onVolume} onSelect={() => props.setAnswer(option.value)} />)}</fieldset> : <label className="answer-box"><span>{translate(props.locale, "yourAnswer")}</span><input dir="auto" autoFocus value={props.answer} onChange={(event) => props.setAnswer(event.target.value)} onKeyDown={(event) => event.key === "Enter" && props.onSubmit()} placeholder={translate(props.locale, "yourAnswer")} disabled={Boolean(props.feedback)} /></label>}{props.feedback && <div className={`feedback ${correct ? "correct" : "incorrect"}`}><strong>{translate(props.locale, correct ? "correct" : "notQuite")}</strong><span>{correct ? (props.mode === "learning" && props.needsAnother ? translate(props.locale, "correctAgain") : translate(props.locale, "mastered")) : <>{translate(props.locale, "correctAnswer")}: <AnswerValues locale={props.locale} values={props.question.acceptedAnswers} mediaKind={answerMediaKind(props.question.direction)} volume={props.volume} onVolume={props.onVolume} /></>}</span>{!correct && <FeedbackDetails locale={props.locale} evaluation={props.feedback} question={props.question} volume={props.volume} onVolume={props.onVolume} />}</div>}<div className="question-actions"><button className="metal-button" onClick={props.onSaveExit}>{translate(props.locale, "saveExit")}</button>{!props.feedback ? <button className="gold-button" onClick={props.onSubmit}>{translate(props.locale, "checkAnswer")}</button> : <button className="gold-button" onClick={props.onNext}>{translate(props.locale, "nextQuestion")}</button>}</div></article></div>;
}
function FeedbackDetails({ locale, evaluation, question, volume, onVolume }: { locale: Locale; evaluation: AnswerEvaluation; question: Question; volume: number; onVolume(value: number): void }) {
  const mediaKind = answerMediaKind(question.direction);
  const render = (values: readonly string[]) => values.length > 0 ? <AnswerValues locale={locale} values={values} mediaKind={mediaKind} volume={volume} onVolume={onVolume} /> : null;
  return <div className="feedback-details">{evaluation.matched.length > 0 && <span>{translate(locale, "matchedAnswers")}: {render(evaluation.matched)}</span>}{evaluation.extra.length > 0 && <span>{translate(locale, "extraAnswers")}: {render(evaluation.extra)}</span>}</div>;
}
function QuestionChoice({ locale, option, index, selected, volume, onVolume, onSelect }: { locale: Locale; option: QuestionOption; index: number; selected: boolean; volume: number; onVolume(value: number): void; onSelect(): void }) {
  const kind = option.media?.kind === "image" ? courseMediaLabels[locale].images : option.media ? courseMediaLabels[locale][option.media.kind] : "";
  return <label><input type="radio" name="answer" value={option.value} checked={selected} onChange={onSelect} aria-label={option.media ? `${translate(locale, "selectMedia")} ${kind} ${index + 1}` : option.label} />{option.media ? <><QuestionMedia locale={locale} media={option.media} volume={volume} onVolume={onVolume} /><span>{index + 1}</span></> : <span dir="auto">{option.label}</span>}</label>;
}
function QuestionMedia({ locale, media, volume, onVolume }: { locale: Locale; media: { kind: "image" | "audio" | "video"; path: string }; volume: number; onVolume(value: number): void }) {
  const [failed, setFailed] = useState(false);
  const player = useRef<HTMLMediaElement | null>(null);
  useEffect(() => { if (player.current) player.current.volume = volume; }, [volume, media.path]);
  if (failed) return <div className="question-media media-error" role="status">{translate(locale, "mediaUnavailable")}</div>;
  if (media.kind === "image") return <div className="question-media"><img src={media.path} alt={translate(locale, "identifyObject")} onError={() => setFailed(true)} /></div>;
  if (media.kind === "audio") return <div className="question-media"><audio ref={(element) => { player.current = element; }} src={media.path} controls aria-label={`${translate(locale, "identifyObject")} ${courseMediaLabels[locale].audio}`} onError={() => setFailed(true)} onVolumeChange={(event) => onVolume(event.currentTarget.volume)} /></div>;
  return <div className="question-media"><video ref={(element) => { player.current = element; }} src={media.path} controls aria-label={`${translate(locale, "identifyObject")} ${courseMediaLabels[locale].video}`} onError={() => setFailed(true)} onVolumeChange={(event) => onVolume(event.currentTarget.volume)} /></div>;
}

// 「名称 → 媒体」方向的题目，其 acceptedAnswers 存的是媒体文件路径而非文字，
// 反馈时应渲染媒体（图片缩略图/音频/视频控件），而不是把路径当字符串显示。
// 媒体→名称方向（image/audio/video-to-name）的题干由 generator 硬编码为英文
// "Identify the object"，这里按界面语言本地化；其余方向直接显示 question.prompt。
// 注：客户反馈⑦的“用名称列首格替代”属 V2，本函数仅做本地化、不引入首格机制。
function promptText(locale: Locale, question: Question): string {
  return question.direction === "image-to-name" || question.direction === "audio-to-name" || question.direction === "video-to-name"
    ? translate(locale, "promptMedia")
    : question.prompt;
}

function answerMediaKind(direction: QuestionDirection): MediaKind | undefined {
  if (direction === "name-to-image") return "image";
  if (direction === "name-to-audio") return "audio";
  if (direction === "name-to-video") return "video";
  return undefined;
}

// 渲染一串答案值：媒体题渲染媒体，文字题渲染文本。plain 时不包裹 <bdi>，
// 与 ReplayView / Results 原本“纯文本节点”的结构保持一致（避免拆散标签与答案的连续文本）。
function AnswerValues({ locale, values, mediaKind, volume, onVolume, plain }: { locale: Locale; values: readonly string[]; mediaKind?: MediaKind; volume: number; onVolume(value: number): void; plain?: boolean }) {
  if (mediaKind) {
    return <div className="feedback-media">{values.map((path) => <QuestionMedia key={path} locale={locale} media={{ kind: mediaKind, path }} volume={volume} onVolume={onVolume} />)}</div>;
  }
  if (plain) return <>{values.join("; ")}</>;
  return <bdi>{values.join("; ")}</bdi>;
}

function Results({ locale, learningTotal, history, reviewOpen, setReviewOpen, onAgain, onCourses, volume, onVolume }: { locale: Locale; learningTotal: number; history?: TestHistoryRecord; reviewOpen: boolean; setReviewOpen(value: boolean): void; onAgain(): void; onCourses(): void; volume: number; onVolume(value: number): void }) {
  const summary = history?.summary;
  const percentage = Math.round(summary?.percentage ?? 100);
  return <div className="results-page"><p className="eyebrow">{translate(locale, "sessionComplete").toUpperCase()}</p><div className="score-medallion"><strong>{percentage}%</strong><span>{summary ? `${summary.score} / ${summary.total} ${translate(locale, "points")}` : `${learningTotal} ${translate(locale, "masteredCount")}`}</span></div>{summary && <div className="result-stats"><span>{translate(locale, "correctCount")} {summary.fullyCorrect}</span><span>{translate(locale, "incorrectCount")} {summary.incorrect}</span></div>}<h1>{percentage === 100 ? translate(locale, "flawless") : translate(locale, "progressWorth")}</h1>{summary && <button className="metal-button" onClick={() => setReviewOpen(!reviewOpen)}>{translate(locale, "reviewAnswers")}</button>}{reviewOpen && summary && <div className="answer-review">{summary.records.map((record) => <article key={record.questionId}><strong>{promptText(locale, record.question)}</strong><span>{translate(locale, "submittedAnswer")}: {record.submittedAnswers.length > 0 ? <AnswerValues locale={locale} values={record.submittedAnswers} mediaKind={answerMediaKind(record.question.direction)} volume={volume} onVolume={onVolume} plain /> : translate(locale, "noAnswer")}</span><span>{translate(locale, "correctAnswer")}: <AnswerValues locale={locale} values={record.question.acceptedAnswers} mediaKind={answerMediaKind(record.question.direction)} volume={volume} onVolume={onVolume} plain /></span></article>)}</div>}<div className="result-actions"><button className="metal-button" onClick={onCourses}>{translate(locale, "courses")}</button><button className="gold-button" onClick={onAgain}>{history ? translate(locale, "testing") : translate(locale, "learning")}</button></div></div>;
}
function LearningHistory({ locale, records, onOpen }: { locale: Locale; records: LearningHistoryRecord[]; onOpen(record: LearningHistoryRecord): void }) {
  const copy = historyCopy[locale];
  return <div className="page-list"><div className="list-heading"><p className="eyebrow">{translate(locale, "progress").toUpperCase()}</p><h1>{copy.learningHistory}</h1></div><div className="history-list list-scroll">{records.length === 0 && <p>{copy.noLearningHistory}</p>}{[...records].reverse().map((record) => <article className="setting-panel history-card" key={record.id} role="button" tabIndex={0} onClick={() => onOpen(record)} onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && onOpen(record)}><h2>{new Date(record.completedAt).toLocaleString(locale)}</h2><span>{translate(locale, "questions")} {record.questionCount} / {copy.attempts} {record.attemptCount}</span><span className="history-card-open">{copy.answerComparison} →</span></article>)}</div></div>;
}

function TestHistory({ locale, records, onOpen }: { locale: Locale; records: TestHistoryRecord[]; onOpen(record: TestHistoryRecord): void }) {
  const copy = historyCopy[locale];
  return <div className="page-list"><div className="list-heading"><p className="eyebrow">{translate(locale, "progress").toUpperCase()}</p><h1>{copy.testHistory}</h1></div><div className="history-list list-scroll">{records.length === 0 && <p>{copy.noTestHistory}</p>}{[...records].reverse().map((record) => <article className="setting-panel history-card" key={record.id} role="button" tabIndex={0} onClick={() => onOpen(record)} onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && onOpen(record)}><h2>{new Date(record.completedAt).toLocaleString(locale)}</h2><strong>{Math.round(record.summary.percentage)}%</strong><span> {translate(locale, "questions")} {record.summary.total} / {translate(locale, "timer")}: {record.timerSeconds === 0 ? translate(locale, "off") : `${record.timerSeconds}s`}</span><span> {translate(locale, "correctCount")} {record.summary.fullyCorrect} / {translate(locale, "incorrectCount")} {record.summary.incorrect}</span><span className="history-card-open">{copy.answerComparison} →</span></article>)}</div></div>;
}

function ReplayView({ locale, course, kind, answers, index, volume, onVolume, onIndex, onExit }: { locale: Locale; course: string; kind: "learning" | "test"; answers: ReadonlyArray<{ questionId: string; question?: Question; submittedAnswers: readonly string[]; evaluation: AnswerEvaluation }>; index: number; volume: number; onVolume(value: number): void; onIndex(value: number): void; onExit(): void }) {
  const copy = historyCopy[locale];
  const record = answers[index];
  const question = record?.question;
  if (!question) {
    return <div className="page-list"><div className="list-heading"><p className="eyebrow">{course}</p><h1>{copy.replayTitle}</h1></div><div className="history-list list-scroll"><p>{copy.noAnswerRecord}</p><button className="metal-button" type="button" onClick={onExit}>{copy.backToList}</button></div></div>;
  }
  const directionLabel = directionLabels.find(([direction]) => direction === question.direction)?.[1];
  const isTest = kind === "test";
  const evaluation = record.evaluation;
  const fullyCorrect = evaluation.fullyCorrect;
  const partial = !fullyCorrect && evaluation.score > 0;
  const correctValues = new Set(question.acceptedAnswers);
  return <div className="replay-view"><header className="replay-header"><div className="replay-meta"><p>{course} / {isTest ? copy.testHistory : copy.learningHistory}</p><strong>{translate(locale, "question")} {index + 1} {translate(locale, "of")} {answers.length}</strong></div><div className="replay-nav"><button type="button" className="replay-step" onClick={() => onIndex(Math.max(0, index - 1))} disabled={index === 0} aria-label={translate(locale, "back")}>←</button><select value={index} onChange={(event) => onIndex(Number(event.target.value))} aria-label={translate(locale, "question")}>{answers.map((_, i) => <option key={i} value={i}>{i + 1}</option>)}</select><button type="button" className="replay-step" onClick={() => onIndex(Math.min(answers.length - 1, index + 1))} disabled={index === answers.length - 1} aria-label={translate(locale, "next")}>→</button></div><button type="button" className="metal-button replay-exit" onClick={onExit}>{copy.backToList}</button></header><article className={`question-card replay-card${isMediaGridOptions(question) ? " media-grid-card" : ""}`}><p className="section-label">{directionLabel ? translate(locale, directionLabel).toUpperCase() : question.direction.toUpperCase()}</p><h1 dir="auto">{promptText(locale, question)}</h1>{question.media && <QuestionMedia locale={locale} media={question.media} volume={volume} onVolume={onVolume} />}{question.kind === "choice" ? <fieldset className={`choice-list${isMediaGridOptions(question) ? " media-grid" : ""}`} disabled><legend>{translate(locale, "yourAnswer")}</legend>{question.options?.map((option) => { const selected = record.submittedAnswers.includes(option.value); const isCorrect = correctValues.has(option.value); return <label key={option.id} className={`${selected ? "is-selected" : ""}${isTest && isCorrect ? " is-correct" : ""}${isTest && selected && !isCorrect ? " is-wrong" : ""}`}><input type="radio" name="replay-answer" checked={selected} readOnly />{option.media ? <QuestionMedia locale={locale} media={option.media} volume={volume} onVolume={onVolume} /> : <span dir="auto">{option.label}</span>}{isTest && isCorrect && <em className="answer-mark">{translate(locale, "correct")}</em>}</label>; })}</fieldset> : <div className="answer-box replay-input"><span>{translate(locale, "yourAnswer")}</span><div className="replay-user-answer" dir="auto">{record.submittedAnswers.join("; ") || translate(locale, "noAnswer")}</div></div>}<div className={`feedback replay-feedback${isTest ? (fullyCorrect ? " correct" : " incorrect") : ""}`}><strong>{isTest ? (fullyCorrect ? translate(locale, "correct") : partial ? translate(locale, "partialCount") : translate(locale, "notQuite")) : copy.answerComparison}</strong><div className="replay-answers"><span dir="auto">{translate(locale, "submittedAnswer")}: {record.submittedAnswers.length > 0 ? <AnswerValues locale={locale} values={record.submittedAnswers} mediaKind={answerMediaKind(question.direction)} volume={volume} onVolume={onVolume} plain /> : translate(locale, "noAnswer")}</span><span dir="auto">{translate(locale, "correctAnswer")}: <AnswerValues locale={locale} values={question.acceptedAnswers} mediaKind={answerMediaKind(question.direction)} volume={volume} onVolume={onVolume} plain /></span></div><FeedbackDetails locale={locale} evaluation={evaluation} question={question} volume={volume} onVolume={onVolume} /></div></article></div>;
}
const localeNames: Record<Locale, string> = { en: "English", pl: "Polski", "zh-CN": "简体中文", ar: "العربية", ru: "Русский" };
function SettingsDialog({ locale, onLocale, onClearLearning, onClearTests, onClearAll, onClose }: { locale: Locale; onLocale(value: Locale): void; onClearLearning(): void; onClearTests(): void; onClearAll(): void; onClose(): void }) {
  return <div className="dialog-backdrop"><section className="demo-dialog settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title"><button className="dialog-close" aria-label={translate(locale, "close")} onClick={onClose}>×</button><p className="eyebrow">ZNAWCA</p><h1 id="settings-title">{translate(locale, "settings")}</h1><label className="settings-language">{translate(locale, "interfaceLanguage")}<select value={locale} onChange={(event) => onLocale(event.target.value as Locale)}>{supportedLocales.map((value) => <option key={value} value={value}>{localeNames[value]}</option>)}</select></label><h2>{translate(locale, "localData")}</h2><div className="data-actions"><button className="metal-button" onClick={onClearLearning}>{translate(locale, "clearLearning")}</button><button className="metal-button" onClick={onClearTests}>{translate(locale, "clearTests")}</button><button className="danger-button" onClick={onClearAll}>{translate(locale, "clearAllData")}</button></div><button className="gold-button" onClick={onClose}>{translate(locale, "close")}</button></section></div>;
}

function Difficulty({ locale, course, records, onClear, onRemove, onPractice }: { locale: Locale; course?: Course; records: LocalState["difficultyRecords"]; onClear(): void; onRemove(record: DifficultyRecord): void; onPractice(record: DifficultyRecord): void }) {
  const copy = difficultyCardCopy[locale];
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const names = new Map(course?.items.map((item) => [item.id, item.name]) ?? []);
  const objects = [...records].sort((left, right) =>
    (names.get(left.objectId) ?? left.objectId).localeCompare(names.get(right.objectId) ?? right.objectId, locale));
  return <div className="page-list"><div className="list-heading"><p className="eyebrow">{translate(locale, "progress").toUpperCase()}</p><div className="page-heading"><h1>{translate(locale, "difficultItems")}</h1><button className="metal-button" disabled={records.length === 0} onClick={onClear}>{translate(locale, "clearAllDifficulty")}</button></div></div><div className="history-list list-scroll">{objects.length === 0 && <p>{translate(locale, "emptyDifficulty")}</p>}{objects.map((entry) => { const key = `${entry.courseId}:${entry.objectId}`; const confirming = confirmingKey === key; return <article className="setting-panel difficulty-object-card" key={key}><div className="difficulty-object-head"><h2>{names.get(entry.objectId) ?? entry.objectId}</h2></div><ul className="difficulty-aspect-list"><li className="difficulty-aspect-row" key={key}><span className="difficulty-aspect-label">{copy.recovery}</span><span className="difficulty-aspect-progress">{entry.consecutiveCorrect} / 2</span><span className="difficulty-aspect-actions"><button className="gold-button" type="button" onClick={() => onPractice(entry)}>{copy.practice}</button><button className={`course-remove-button${confirming ? " confirm-delete" : ""}`} type="button" aria-label={`${translate(locale, "removeCourse")} ${names.get(entry.objectId) ?? entry.objectId}`} onClick={() => { if (confirming) { setConfirmingKey(null); onRemove(entry); } else { setConfirmingKey(key); } }}>{confirming ? copy.confirmDelete : "×"}</button></span></li></ul></article>; })}</div></div>;
}
