import { translate, type Locale } from "../../i18n/index";
import type { Question } from "../../../core/quiz/types";

export function promptText(locale: Locale, question: Question): string {
  return question.direction === "image-to-name" ||
    question.direction === "audio-to-name" ||
    question.direction === "video-to-name"
    ? translate(locale, "promptMedia")
    : question.prompt;
}

export function isMediaGridOptions(question: Question): boolean {
  return (
    question.kind === "choice" &&
    question.options !== undefined &&
    question.options.length >= 3 &&
    question.options.length <= 4 &&
    question.options.every(
      (option) =>
        option.media?.kind === "image" ||
        option.media?.kind === "audio" ||
        option.media?.kind === "video",
    )
  );
}
