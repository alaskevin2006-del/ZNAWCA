import { useEffect, useState } from "react";
import type { Course } from "../../../core/course/types";
import { translate, type Locale } from "../../i18n/index";
import { speechAudioForOption } from "../../../core/course/speech-audio";
import { type ProgressUnitCounts } from "../../../core/progress/knowledge-progress";
import type {
  AnswerEvaluation,
  Question,
  QuestionOption,
} from "../../../core/quiz/types";
import { Mode } from "./types";
import { courseMediaLabels } from "../../i18n/courses";
import { directionLabels } from "../../i18n/study";
import { QuestionMedia } from "../../shared/media/QuestionMedia";
import { SpeechButton } from "../../shared/media/SpeechButton";
import {
  AnswerValues,
  FeedbackDetails,
  answerMediaKind,
} from "../../shared/question/answers";
import {
  isMediaGridOptions,
  promptText,
} from "../../shared/question/presentation";

export interface SessionProps {
  locale: Locale;
  question: Question;
  course: string;
  speechCourse?: Course;
  speechUrls: readonly string[];
  onPlaySpeech(urls: readonly string[]): void;
  mode: Mode;
  timer: number;
  volume: number;
  onVolume(value: number): void;
  position: number;
  total: number;
  units?: ProgressUnitCounts;
  answer: string;
  setAnswer(value: string): void;
  feedback?: AnswerEvaluation;
  needsAnother: boolean;
  onSubmit(): void;
  onTimeout(): void;
  onSaveExit(): void;
  onNext(): void;
}

export function Session(props: SessionProps) {
  const [remaining, setRemaining] = useState(props.timer);
  useEffect(() => {
    setRemaining(props.timer);
    if (props.mode !== "testing" || props.timer === 0 || props.feedback) return;
    const interval = window.setInterval(
      () =>
        setRemaining((current) => {
          if (current > 1) return current - 1;
          window.clearInterval(interval);
          queueMicrotask(props.onTimeout);
          return 0;
        }),
      1000,
    );
    return () => window.clearInterval(interval);
  }, [props.question.id, props.mode, props.timer, props.feedback]);
  const correct = props.feedback?.fullyCorrect;
  const directionLabel = directionLabels.find(
    ([direction]) => direction === props.question.direction,
  )?.[1];
  // D-22：文字答案按钮的手动朗读（媒体选项自身可播放，不提供）。
  const optionSpeechUrl = (option: QuestionOption): string | undefined =>
    props.speechCourse
      ? speechAudioForOption(props.speechCourse, props.question, option)
      : undefined;
  return (
    <div className="session-page">
      <header className="session-header">
        <div>
          <p>
            {props.course} / {translate(props.locale, props.mode)}
          </p>
          {props.mode === "learning" && props.units ? (
            <strong>
              {props.units.completed} / {props.units.total}{" "}
              {translate(props.locale, "masteredCount")}
            </strong>
          ) : (
            <strong>
              {translate(props.locale, "question")} {props.position}{" "}
              {translate(props.locale, "of")} {props.total}
            </strong>
          )}
          {props.units && (
            <span className="unit-progress">
              {props.units.completed} / {props.units.total}{" "}
              {translate(props.locale, "unitsLabel")} · {props.units.remaining}{" "}
              {translate(props.locale, "unitsRemaining")}
            </span>
          )}
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={props.units ? props.units.total : props.total}
          aria-valuenow={props.units ? props.units.completed : props.position}
          aria-label={translate(props.locale, "progress")}
        >
          <span
            style={{
              width: `${Math.min(100, (props.units ? props.units.completed / Math.max(1, props.units.total) : props.position / Math.max(1, props.total)) * 100)}%`,
            }}
          />
        </div>
        {props.mode === "testing" && props.timer > 0 && (
          <span className="timer-badge">{remaining}s</span>
        )}
      </header>
      <article
        className={`question-card${isMediaGridOptions(props.question) ? " media-grid-card" : ""}`}
      >
        <p className="section-label">
          {directionLabel
            ? translate(props.locale, directionLabel).toUpperCase()
            : props.question.direction.toUpperCase()}
        </p>
        <div className="question-heading">
          <h1 dir="auto">{promptText(props.locale, props.question)}</h1>
          {!props.question.media && props.speechUrls.length > 0 && (
            <SpeechButton
              locale={props.locale}
              onPlay={() => props.onPlaySpeech(props.speechUrls)}
            />
          )}
        </div>
        {props.question.media && (
          <QuestionMedia
            locale={props.locale}
            media={props.question.media}
            volume={props.volume}
            onVolume={props.onVolume}
          />
        )}
        {props.question.kind === "choice" ? (
          <fieldset
            className={`choice-list${isMediaGridOptions(props.question) ? " media-grid" : ""}`}
            disabled={Boolean(props.feedback)}
          >
            <legend>{translate(props.locale, "yourAnswer")}</legend>
            {props.question.options?.map((option, index) => (
              <QuestionChoice
                locale={props.locale}
                key={option.id}
                option={option}
                index={index}
                selected={props.answer === option.value}
                volume={props.volume}
                onVolume={props.onVolume}
                onSelect={() => props.setAnswer(option.value)}
                speechUrl={optionSpeechUrl(option)}
                onPlaySpeech={() => {
                  const url = optionSpeechUrl(option);
                  if (url) props.onPlaySpeech([url]);
                }}
              />
            ))}
          </fieldset>
        ) : (
          <label className="answer-box">
            <span>{translate(props.locale, "yourAnswer")}</span>
            <input
              dir="auto"
              autoFocus
              value={props.answer}
              onChange={(event) => props.setAnswer(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && props.onSubmit()}
              placeholder={translate(props.locale, "yourAnswer")}
              disabled={Boolean(props.feedback)}
            />
          </label>
        )}
        {props.feedback && (
          <div className={`feedback ${correct ? "correct" : "incorrect"}`}>
            <strong>
              {translate(props.locale, correct ? "correct" : "notQuite")}
            </strong>
            <span>
              {correct ? (
                props.mode === "learning" && props.needsAnother ? (
                  translate(props.locale, "correctAgain")
                ) : (
                  translate(props.locale, "mastered")
                )
              ) : (
                <>
                  {translate(props.locale, "correctAnswer")}:{" "}
                  <AnswerValues
                    locale={props.locale}
                    values={props.question.acceptedAnswers}
                    mediaKind={answerMediaKind(props.question.direction)}
                    volume={props.volume}
                    onVolume={props.onVolume}
                    options={props.question.options}
                  />
                </>
              )}
            </span>
            {!correct && (
              <FeedbackDetails
                locale={props.locale}
                evaluation={props.feedback}
                question={props.question}
                volume={props.volume}
                onVolume={props.onVolume}
              />
            )}
          </div>
        )}
        <div className="question-actions">
          <button className="metal-button" onClick={props.onSaveExit}>
            {translate(props.locale, "saveExit")}
          </button>
          {!props.feedback ? (
            <button className="gold-button" onClick={props.onSubmit}>
              {translate(props.locale, "checkAnswer")}
            </button>
          ) : (
            <button className="gold-button" onClick={props.onNext}>
              {translate(props.locale, "nextQuestion")}
            </button>
          )}
        </div>
      </article>
    </div>
  );
}

export function QuestionChoice({
  locale,
  option,
  index,
  selected,
  volume,
  onVolume,
  onSelect,
  speechUrl,
  onPlaySpeech,
}: {
  locale: Locale;
  option: QuestionOption;
  index: number;
  selected: boolean;
  volume: number;
  onVolume(value: number): void;
  onSelect(): void;
  speechUrl?: string;
  onPlaySpeech(): void;
}) {
  const kind =
    option.media?.kind === "image"
      ? courseMediaLabels[locale].images
      : option.media
        ? courseMediaLabels[locale][option.media.kind]
        : "";
  return (
    <label>
      <input
        type="radio"
        name="answer"
        value={option.value}
        checked={selected}
        onChange={onSelect}
        aria-label={
          option.media
            ? `${translate(locale, "selectMedia")} ${kind} ${index + 1}`
            : option.label
        }
      />
      {option.media ? (
        <>
          <QuestionMedia
            locale={locale}
            media={option.media}
            volume={volume}
            onVolume={onVolume}
          />
          <span>{index + 1}</span>
        </>
      ) : (
        <span dir="auto">{option.label}</span>
      )}
      {!option.media && speechUrl && (
        <SpeechButton locale={locale} onPlay={onPlaySpeech} />
      )}
    </label>
  );
}

// D-22/D-23：问题行与文字答案按钮的手动扬声器。点击只触发播放：
// type="button"（不触发表单提交），preventDefault/stopPropagation 阻止
// label→radio 的隐式激活与事件冒泡，因此不会选中选项、更不会提交答案。
// 提示语走本地化文案 playNarration（朗读内容本身取决于课程语言配套录音）。
