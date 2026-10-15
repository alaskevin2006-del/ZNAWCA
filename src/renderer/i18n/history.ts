import { type Locale } from "./index";

export const historyCopy: Record<
  Locale,
  {
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
  }
> = {
  en: {
    learningHistory: "Learning history",
    testHistory: "Test history",
    noLearningHistory: "No completed learning sessions yet.",
    noTestHistory: "No completed tests yet.",
    attempts: "Attempts",
    answerComparison: "Question and answer comparison",
    correct: "Correct",
    incorrect: "Incorrect",
    replayTitle: "Answer replay",
    backToList: "Back to list",
    noAnswerRecord: "This question's data is missing.",
  },
  pl: {
    learningHistory: "Historia nauki",
    testHistory: "Historia testów",
    noLearningHistory: "Brak ukończonych sesji nauki.",
    noTestHistory: "Brak ukończonych testów.",
    attempts: "Próby",
    answerComparison: "Porównanie pytań i odpowiedzi",
    correct: "Poprawnie",
    incorrect: "Błędnie",
    replayTitle: "Powtórka odpowiedzi",
    backToList: "Wróć do listy",
    noAnswerRecord: "Brak danych tego pytania.",
  },
  "zh-CN": {
    learningHistory: "学习历史",
    testHistory: "测试历史",
    noLearningHistory: "暂无已完成的学习记录。",
    noTestHistory: "暂无已完成的测试记录。",
    attempts: "作答次数",
    answerComparison: "题目与答案对照",
    correct: "正确",
    incorrect: "错误",
    replayTitle: "答题回放",
    backToList: "返回列表",
    noAnswerRecord: "该题数据缺失。",
  },
  ar: {
    learningHistory: "سجل التعلم",
    testHistory: "سجل الاختبارات",
    noLearningHistory: "لا توجد جلسات تعلم مكتملة.",
    noTestHistory: "لا توجد اختبارات مكتملة.",
    attempts: "المحاولات",
    answerComparison: "مقارنة السؤال والإجابة",
    correct: "صحيح",
    incorrect: "خطأ",
    replayTitle: "إعادة تشغيل الإجابات",
    backToList: "العودة إلى القائمة",
    noAnswerRecord: "بيانات هذا السؤال مفقودة.",
  },
  ru: {
    learningHistory: "История обучения",
    testHistory: "История тестов",
    noLearningHistory: "Завершённых учебных сессий пока нет.",
    noTestHistory: "Завершённых тестов пока нет.",
    attempts: "Попытки",
    answerComparison: "Сопоставление вопросов и ответов",
    correct: "Верно",
    incorrect: "Неверно",
    replayTitle: "Повтор ответов",
    backToList: "Назад к списку",
    noAnswerRecord: "Данные этого вопроса отсутствуют.",
  },
};
