import type { CourseOrganizationSummary } from "../../contracts/course-library";
import { type Locale } from "./index";

export const importChoiceCopy: Record<
  Locale,
  {
    title: string;
    detail: string;
    scanTitle: string;
    scanDetail: string;
    organizeTitle: string;
    organizeDetail: string;
  }
> = {
  en: {
    title: "How should Znawca use this folder?",
    detail:
      "Whichever option you choose, Znawca scans the selected folder first and only creates courses that pass validation.",
    scanTitle: "Scan without organizing",
    scanDetail:
      "Use a folder that already follows the course structure. No files are changed.",
    organizeTitle: "Organize a new copy",
    organizeDetail:
      "Create a separate standardized copy based on workbook and media names. The original folder is never changed.",
  },
  pl: {
    title: "Jak Znawca ma użyć tego folderu?",
    detail:
      "Niezależnie od wyboru Znawca najpierw skanuje folder i tworzy tylko kursy, które przejdą walidację.",
    scanTitle: "Skanuj bez porządkowania",
    scanDetail:
      "Użyj folderu, który już ma strukturę kursu. Żaden plik nie zostanie zmieniony.",
    organizeTitle: "Uporządkuj nową kopię",
    organizeDetail:
      "Utwórz oddzielną kopię na podstawie nazw skoroszytów i multimediów. Oryginał pozostanie bez zmian.",
  },
  "zh-CN": {
    title: "希望如何使用这个文件夹？",
    detail:
      "无论选择哪种方式，Znawca 都会先扫描所选文件夹，只有符合条件的内容才会被创建为课程。",
    scanTitle: "仅扫描，不组织文件",
    scanDetail: "适用于已经符合课程目录结构的文件夹，不会修改任何文件。",
    organizeTitle: "组织一个新的副本",
    organizeDetail:
      "根据 Excel 和媒体文件名创建独立的规范化副本，原始文件夹始终保持不变。",
  },
  ar: {
    title: "كيف يستخدم Znawca هذا المجلد؟",
    detail:
      "في كلتا الحالتين يفحص Znawca المجلد أولاً، ولا ينشئ إلا الدورات التي تجتاز التحقق.",
    scanTitle: "فحص دون تنظيم",
    scanDetail: "استخدم مجلداً منظماً مسبقاً. لن يتم تعديل أي ملف.",
    organizeTitle: "تنظيم نسخة جديدة",
    organizeDetail:
      "أنشئ نسخة مستقلة ومنظمة اعتماداً على أسماء الملفات، مع إبقاء الأصل دون تغيير.",
  },
  ru: {
    title: "Как Znawca должен использовать эту папку?",
    detail:
      "При любом выборе Znawca сначала проверяет папку и создаёт только курсы, прошедшие проверку.",
    scanTitle: "Проверить без организации",
    scanDetail:
      "Использовать уже подготовленную структуру курса. Файлы не изменяются.",
    organizeTitle: "Организовать новую копию",
    organizeDetail:
      "Создать отдельную упорядоченную копию по именам книг и медиафайлов. Исходная папка не изменяется.",
  },
};

export function formatOrganizationNotice(
  locale: Locale,
  summary: CourseOrganizationSummary,
): string {
  if (locale === "zh-CN") {
    return `已创建整理副本：${summary.organizedDirectory}（${summary.workbookCount} 个 Excel，${summary.copiedMediaCount} 个媒体文件，${summary.unmatchedMediaCount} 个未匹配）`;
  }
  return `Organized copy created at ${summary.organizedDirectory} (${summary.workbookCount} workbook(s), ${summary.copiedMediaCount} media copied, ${summary.unmatchedMediaCount} unmatched).`;
}

export const courseMediaLabels: Record<
  Locale,
  { images: string; audio: string; video: string; text: string }
> = {
  en: { images: "Images", audio: "Audio", video: "Video", text: "Text" },
  pl: { images: "Obrazy", audio: "Dźwięk", video: "Wideo", text: "Tekst" },
  "zh-CN": { images: "图片", audio: "音频", video: "视频", text: "文字" },
  ar: { images: "صور", audio: "صوت", video: "فيديو", text: "نص" },
  ru: { images: "Изображения", audio: "Аудио", video: "Видео", text: "Текст" },
};
