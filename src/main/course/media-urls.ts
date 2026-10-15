import path from "node:path";
import type { CourseLoadReport } from "../../core/course/types.js";
import { mediaUrl } from "../media-protocol.js";

export function withMediaUrls(report: CourseLoadReport): CourseLoadReport {
  if (!report.course) return report;
  const course = report.course;
  // D-22：把 speech/<lang>/ 坐标文件名转换为可直接播放的 znawca-media:// URL。
  const speech =
    course.speechFiles && course.speechDirectory
      ? course.speechFiles.map((file) => ({
          file,
          url: mediaUrl(path.join(course.speechDirectory!, file)),
        }))
      : undefined;
  return {
    ...report,
    course: {
      ...course,
      items: course.items.map((item) => ({
        ...item,
        media: item.media.map((asset) => ({
          ...asset,
          path: mediaUrl(asset.path),
        })),
      })),
      feedbackSounds: course.feedbackSounds
        ? {
            correct: course.feedbackSounds.correct.map(mediaUrl),
            incorrect: course.feedbackSounds.incorrect.map(mediaUrl),
          }
        : undefined,
      speech,
    },
  };
}
