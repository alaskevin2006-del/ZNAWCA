import { loadCourse } from "./src/core/course/loader";
import { buildCourseQuestionSet } from "./src/core/quiz/question-set";

async function main() {
  const report = await loadCourse("C:/Users/Kevin/Desktop/Instruments Demo");
  console.log("Course title:", report.course?.title);
  console.log("Course keys:", report.course ? Object.keys(report.course) : "undefined");
  console.log("Objects:", report.course?.objects?.length);
  console.log("Can open:", report.canOpen);
  console.log("Issues:", report.issues.length);
  if (report.issues.length > 0) {
    for (const issue of report.issues.slice(0, 5)) {
      console.log("  -", issue.severity, issue.message);
    }
  }
  if (report.course) {
    const set = buildCourseQuestionSet({ course: report.course, teachingStyle: "strict" });
    console.log("Questions:", set.questions.length);
    console.log("Skipped:", set.skipped.length);
    const byKind = set.questions.reduce((a: any, q) => {
      a[q.kind] = (a[q.kind] || 0) + 1;
      return a;
    }, {});
    console.log("By kind:", byKind);
    const directions = set.questions.reduce((a: any, q) => {
      a[q.direction] = (a[q.direction] || 0) + 1;
      return a;
    }, {});
    console.log("Directions:", directions);
    const mediaKinds = new Set(set.questions.map(q => q.media?.kind).filter(Boolean));
    console.log("Media kinds:", [...mediaKinds]);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
