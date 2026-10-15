import { type Locale, type MessageKey } from "./index";
import type { QuestionDirection } from "../../core/quiz/types";

export const setupCopy: Record<
  Locale,
  {
    fullCoverage: string;
    sample: string;
    perQuestionTimer: string;
    learned: string;
    mastered: string;
    unseen: string;
    projects: string;
  }
> = {
  en: {
    fullCoverage: "The entire set",
    sample: "Smart batch",
    perQuestionTimer: "Per-question timer",
    learned: "learned",
    mastered: "mastered",
    unseen: "unseen",
    projects: "projects",
  },
  pl: {
    fullCoverage: "Suma obecnych projeków",
    sample: "Inteligentnie dobrany zestaw pytań",
    perQuestionTimer: "Czas na pytanie",
    learned: "poznano",
    mastered: "opanowano",
    unseen: "niepoznane",
    projects: "projekty",
  },
  "zh-CN": {
    fullCoverage: "本次全部项目",
    sample: "智能安排",
    perQuestionTimer: "每题计时",
    learned: "已学习",
    mastered: "已掌握",
    unseen: "未接触",
    projects: "个项目",
  },
  ar: {
    fullCoverage: "كل المشاريع هذه المرة",
    sample: "دفعة ذكية",
    perQuestionTimer: "مؤقت لكل سؤال",
    learned: "تم تعلمه",
    mastered: "تم إتقانه",
    unseen: "غير مرئي",
    projects: "مشاريع",
  },
  ru: {
    fullCoverage: "Все проекты сейчас",
    sample: "Умная группа",
    perQuestionTimer: "Таймер на вопрос",
    learned: "изучено",
    mastered: "освоено",
    unseen: "не просмотрено",
    projects: "проекты",
  },
};

export const directionLabels: ReadonlyArray<[QuestionDirection, MessageKey]> = [
  ["name-to-property", "nameToProperty"],
  ["property-to-name", "propertyToName"],
  ["image-to-name", "imageToName"],
  ["name-to-image", "nameToImage"],
  ["audio-to-name", "audioToName"],
  ["name-to-audio", "nameToAudio"],
  ["video-to-name", "videoToName"],
  ["name-to-video", "nameToVideo"],
];
