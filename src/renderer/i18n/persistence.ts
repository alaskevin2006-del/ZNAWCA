import type { Locale } from "../../core/shared/locale";

export const persistenceCopy: Record<
  Locale,
  { failed: string; retry: string }
> = {
  en: {
    failed:
      "Local data could not be loaded or saved. Keep this window open and retry.",
    retry: "Retry",
  },
  pl: {
    failed:
      "Nie można odczytać lub zapisać danych lokalnych. Nie zamykaj okna i spróbuj ponownie.",
    retry: "Ponów",
  },
  "zh-CN": {
    failed: "本地数据读写失败，请保留当前窗口并重试。",
    retry: "重试",
  },
  ar: {
    failed:
      "تعذر تحميل البيانات المحلية أو حفظها. أبق النافذة مفتوحة وحاول مجدداً.",
    retry: "إعادة المحاولة",
  },
  ru: {
    failed:
      "Не удалось прочитать или сохранить локальные данные. Не закрывайте окно и повторите попытку.",
    retry: "Повторить",
  },
};
