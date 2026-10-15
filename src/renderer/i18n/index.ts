import { type Locale } from "../../core/shared/locale.js";
export {
  supportedLocales,
  isLocale,
  textDirection,
  type Locale,
} from "../../core/shared/locale.js";

import type { Messages, MessageKey } from "./types";
export type { Messages, MessageKey } from "./types";
import { en } from "./locales/en";
import { pl } from "./locales/pl";
import { zh } from "./locales/zh";
import { ar } from "./locales/ar";
import { ru } from "./locales/ru";

const messages: Record<Locale, Messages> = { en, pl, "zh-CN": zh, ar, ru };

export const translate = (locale: Locale, key: MessageKey): string =>
  messages[locale][key];

// ITEM_NAME_EMPTY 导入报错的本地化文案（row=行号，columns=该行有内容的列字母数组）。
// core 层只生成英文 fallback + 结构化参数，UI 层按界面语言渲染对应文案。
const itemNameEmptyCopy: Record<
  Locale,
  {
    readonly message: (row: number) => string;
    readonly suggestion: (row: number, columns: readonly string[]) => string;
  }
> = {
  en: {
    message: (row) => `Row ${row}, column A (item name) is empty.`,
    suggestion: (row, columns) =>
      columns.length > 0
        ? `Column ${columns.join(", ")} has content, but column A is empty. Fill column A in row ${row} or delete this row.`
        : `Fill column A in row ${row} or delete this row.`,
  },
  pl: {
    message: (row) => `Wiersz ${row}, kolumna A (nazwa pozycji) jest pusta.`,
    suggestion: (row, columns) =>
      columns.length > 0
        ? `Kolumna ${columns.join(", ")} ma treść, ale kolumna A jest pusta. Uzupełnij kolumnę A w wierszu ${row} lub usuń ten wiersz.`
        : `Uzupełnij kolumnę A w wierszu ${row} lub usuń ten wiersz.`,
  },
  "zh-CN": {
    message: (row) => `第 ${row} 行 A 列（条目名）为空。`,
    suggestion: (row, columns) =>
      columns.length > 0
        ? `第 ${columns.join("、")} 列有内容，但 A 列为空。请填写第 ${row} 行 A 列，或删除该行。`
        : `请填写第 ${row} 行 A 列，或删除该行。`,
  },
  ar: {
    message: (row) => `الصف ${row}، العمود A (اسم العنصر) فارغ.`,
    suggestion: (row, columns) =>
      columns.length > 0
        ? `العمود ${columns.join("، ")} يحتوي على محتوى، لكن العمود A فارغ. املأ العمود A في الصف ${row} أو احذف هذا الصف.`
        : `املأ العمود A في الصف ${row} أو احذف هذا الصف.`,
  },
  ru: {
    message: (row) => `Строка ${row}, столбец A (название элемента) пуст.`,
    suggestion: (row, columns) =>
      columns.length > 0
        ? `Столбец ${columns.join(", ")} содержит данные, но столбец A пуст. Заполните столбец A в строке ${row} или удалите эту строку.`
        : `Заполните столбец A в строке ${row} или удалите эту строку.`,
  },
};

export const formatItemNameEmpty = (
  locale: Locale,
  row: number,
  filledColumns: readonly string[],
): { readonly message: string; readonly suggestion: string } => {
  const copy = itemNameEmptyCopy[locale] ?? itemNameEmptyCopy.en;
  return {
    message: copy.message(row),
    suggestion: copy.suggestion(row, filledColumns),
  };
};
