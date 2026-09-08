// D-22 的坐标解析逻辑已收敛到 src/core/course/speech-audio.ts（浏览器安全的
// 纯函数，供 AppShell 与测试共用）。本文件保留为兼容入口，仅重导出。
export {
  columnLetters,
  speechAudioForOption,
  speechAudioForQuestion,
} from "../../core/course/speech-audio";
