import { type Locale } from "./index";

export const difficultyCardCopy: Record<
  Locale,
  { recovery: string; practice: string; confirmDelete: string }
> = {
  en: {
    recovery: "Consecutive correct",
    practice: "Review",
    confirmDelete: "Confirm",
  },
  pl: {
    recovery: "Poprawne z rzędu",
    practice: "Ćwicz",
    confirmDelete: "Potwierdź",
  },
  "zh-CN": {
    recovery: "连续答对",
    practice: "复习",
    confirmDelete: "确认删除",
  },
  ar: {
    recovery: "إجابات صحيحة متتالية",
    practice: "تدرب",
    confirmDelete: "تأكيد",
  },
  ru: {
    recovery: "Верно подряд",
    practice: "Повторить",
    confirmDelete: "Подтвердить",
  },
};
