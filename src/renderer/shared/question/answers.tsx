import { translate, type Locale } from "../../i18n/index";
import type {
  AnswerEvaluation,
  MediaKind,
  Question,
  QuestionDirection,
  QuestionOption,
} from "../../../core/quiz/types";
import { QuestionMedia } from "../media/QuestionMedia";

export function AnswerValues({
  locale,
  values,
  mediaKind,
  volume,
  onVolume,
  plain,
  options,
}: {
  locale: Locale;
  values: readonly string[];
  mediaKind?: MediaKind;
  volume: number;
  onVolume(value: number): void;
  plain?: boolean;
  options?: readonly QuestionOption[];
}) {
  if (mediaKind && mediaKind !== "image") {
    return (
      <div className="feedback-media-av">
        {values.map((path) => {
          const index =
            options?.findIndex((option) => option.value === path) ?? -1;
          return (
            <div key={path} className="feedback-media-av-item">
              {index >= 0 && (
                <span
                  className="feedback-option-index"
                  aria-label={`${translate(locale, "selectMedia")} ${index + 1}`}
                >
                  {index + 1}
                </span>
              )}
              <QuestionMedia
                locale={locale}
                media={{ kind: mediaKind, path }}
                volume={volume}
                onVolume={onVolume}
              />
            </div>
          );
        })}
      </div>
    );
  }
  if (mediaKind) {
    return (
      <div className="feedback-media">
        {values.map((path) => (
          <QuestionMedia
            key={path}
            locale={locale}
            media={{ kind: mediaKind, path }}
            volume={volume}
            onVolume={onVolume}
          />
        ))}
      </div>
    );
  }
  if (plain) return <>{values.join("; ")}</>;
  return <bdi>{values.join("; ")}</bdi>;
}

export function FeedbackDetails({
  locale,
  evaluation,
  question,
  volume,
  onVolume,
}: {
  locale: Locale;
  evaluation: AnswerEvaluation;
  question: Question;
  volume: number;
  onVolume(value: number): void;
}) {
  const mediaKind = answerMediaKind(question.direction);
  const render = (values: readonly string[]) =>
    values.length > 0 ? (
      <AnswerValues
        locale={locale}
        values={values}
        mediaKind={mediaKind}
        volume={volume}
        onVolume={onVolume}
        options={question.options}
      />
    ) : null;
  return (
    <div className="feedback-details">
      {evaluation.matched.length > 0 && (
        <span>
          {translate(locale, "matchedAnswers")}: {render(evaluation.matched)}
        </span>
      )}
      {evaluation.extra.length > 0 && (
        <span>
          {translate(locale, "extraAnswers")}: {render(evaluation.extra)}
        </span>
      )}
    </div>
  );
}

export function answerMediaKind(
  direction: QuestionDirection,
): MediaKind | undefined {
  if (direction === "name-to-image") return "image";
  if (direction === "name-to-audio") return "audio";
  if (direction === "name-to-video") return "video";
  return undefined;
}

// 渲染一串答案值：媒体题渲染媒体，文字题渲染文本。plain 时不包裹 <bdi>，
// 与 ReplayView / Results 原本“纯文本节点”的结构保持一致（避免拆散标签与答案的连续文本）。
// 音频/视频答案（name-to-audio/video）在反馈区标注对应选项序号（与媒体网格中
// 选项下方的编号一致），同时保留正常宽度的播放器，可直接重听/重看正确答案。
