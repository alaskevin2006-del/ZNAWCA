import { describe, expect, it } from "vitest";
import { applyFilters, findNonDiscriminatingFields } from "../../src/core/quiz/filter.js";
import { generateQuestion, QuestionGenerationError } from "../../src/core/quiz/generator.js";
import { buildCourseQuestionSet } from "../../src/core/quiz/question-set.js";
import { evaluateAnswer } from "../../src/core/quiz/scoring.js";
import type { Course } from "../../src/core/course/types.js";
import type { CourseObject, RandomSource } from "../../src/core/quiz/types.js";

const fixed: RandomSource = { next: () => 0 };
const objects: CourseObject[] = [
  { id: "gull", name: "Gull", attributes: { Type: ["Bird"], Food: ["fish", "worms"] }, filters: { Habitat: ["Coast"] }, media: { image: ["gull-a.jpg", "gull-b.jpg"] } },
  { id: "cuckoo", name: "Cuckoo", attributes: { Type: ["Bird"], Food: ["insects"] }, filters: { Habitat: ["Woodland"] }, media: { image: ["cuckoo.jpg"] } },
  { id: "tit", name: "Tit", attributes: { Type: ["Bird"], Food: ["insects"] }, filters: { Habitat: ["Woodland", "Garden"] }, media: { image: ["tit.jpg"] } },
  { id: "oriole", name: "Oriole", attributes: { Type: ["Bird"], Food: ["fruit"] }, filters: { Habitat: ["Woodland"] }, media: { image: ["oriole.jpg"] } },
];

describe("quiz filtering and scoring", () => {
  it("uses OR within a field and AND between fields", () => {
    expect(applyFilters(objects, [
      { field: "Habitat", values: ["Coast", "Garden"] },
      { field: "Type", values: ["Bird"] },
    ]).map((object) => object.id)).toEqual(["gull", "tit"]);
  });

  it("skips fields with no distinction", () => {
    expect(findNonDiscriminatingFields(objects, ["Type", "Food"])).toEqual(["Type"]);
  });

  it("reports partial matches but requires every semicolon part", () => {
    expect(evaluateAnswer(["fish", "worms"], " WORMS ; ")).toMatchObject({ score: 0.5, fullyCorrect: false, matched: ["worms"], missed: ["fish"] });
  });
});

describe("question generation", () => {
  it("uses the filtered scope for strict distractors", () => {
    const filtered = objects;
    const question = generateQuestion({ target: objects[0], field: "Food", direction: "name-to-property", requestedKind: "choice", filteredObjects: filtered, allCourseObjects: objects, teachingStyle: "strict", random: fixed });
    expect(question.kind).toBe("choice");
    expect(question.options?.every((option) => filtered.some((object) => object.id === option.objectId))).toBe(true);
  });

  it("degrades a name-to-media choice into media-to-name input", () => {
    const question = generateQuestion({ target: objects[0], direction: "name-to-image", requestedKind: "choice", filteredObjects: objects.slice(0, 2), allCourseObjects: objects.slice(0, 2), teachingStyle: "strict", random: fixed });
    expect(question).toMatchObject({ kind: "input", direction: "image-to-name", acceptedAnswers: ["Gull"], degradationReason: "insufficient-distractors" });
    expect(question.media?.path).toBe("gull-a.jpg");
  });

  it("rejects ambiguous property-to-name questions", () => {
    expect(() => generateQuestion({ target: objects[1], field: "Food", direction: "property-to-name", requestedKind: "input", filteredObjects: objects, allCourseObjects: objects, teachingStyle: "strict", random: fixed }))
      .toThrowError(QuestionGenerationError);
  });

  it("uses all-course distractors in lenient mode and keeps strict distractors in scope", () => {
    const filtered = [objects[0]!, objects[1]!];
    const strictQuestion = generateQuestion({ target: objects[0]!, direction: "image-to-name", requestedKind: "choice", filteredObjects: filtered, allCourseObjects: objects, teachingStyle: "strict", random: fixed });
    const lenientQuestion = generateQuestion({ target: objects[0]!, direction: "image-to-name", requestedKind: "choice", filteredObjects: filtered, allCourseObjects: objects, teachingStyle: "lenient", random: fixed });
    expect(strictQuestion).toMatchObject({ kind: "input", degradationReason: "insufficient-distractors" });
    expect(lenientQuestion.kind).toBe("choice");
    expect(lenientQuestion.options).toHaveLength(4);
  });

  it("uses exactly one target media option and accepts that selected path", () => {
    const question = generateQuestion({ target: objects[0]!, direction: "name-to-image", requestedKind: "choice", filteredObjects: objects, allCourseObjects: objects, teachingStyle: "strict", random: fixed });
    expect(question.kind).toBe("choice");
    expect(question.options?.filter((option) => option.objectId === "gull")).toHaveLength(1);
    const targetOption = question.options?.find((option) => option.objectId === "gull");
    expect(question.acceptedAnswers).toEqual([targetOption?.value]);
    expect(targetOption?.media).toEqual({ kind: "image", path: targetOption?.value });
  });

  it("rotates away from recently presented media when alternatives exist", () => {
    const question = generateQuestion({
      target: objects[0]!,
      direction: "image-to-name",
      requestedKind: "input",
      filteredObjects: objects,
      allCourseObjects: objects,
      teachingStyle: "strict",
      recentMediaPaths: ["gull-a.jpg"],
      random: fixed,
    });
    expect(question.media?.path).toBe("gull-b.jpg");
  });

  it("uses three options when only two unique distractors exist", () => {
    const scoped = [objects[0]!, objects[1]!, objects[3]!];
    const question = generateQuestion({ target: scoped[0]!, direction: "image-to-name", requestedKind: "choice", filteredObjects: scoped, allCourseObjects: scoped, teachingStyle: "strict", random: fixed });
    expect(question.kind).toBe("choice");
    expect(question.options).toHaveLength(3);
  });
});

const course: Course = {
  id: "birds",
  title: "Birds",
  directory: "C:/birds",
  workbookPath: "C:/birds/Birds.xlsx",
  sheetName: "Birds",
  columns: [
    { index: 1, title: "Name", displayTitle: "Name", filterOnly: false },
    { index: 2, title: "Food", displayTitle: "Food", filterOnly: false },
    { index: 3, title: "#Habitat", displayTitle: "Habitat", filterOnly: true },
  ],
  items: objects.map((object, index) => ({
    id: object.id,
    name: object.name,
    sourceRow: index + 2,
    values: {
      Food: object.attributes.Food ?? [],
      "#Habitat": object.filters?.Habitat ?? [],
    },
    media: (object.media?.image ?? []).map((path) => ({
      kind: "image" as const,
      path,
      extension: ".jpg",
      source: "standard" as const,
    })),
  })),
};

const multimediaCourse: Course = {
  ...course,
  items: course.items.map((item) => ({
    ...item,
    media: [
      ...item.media,
      { kind: "audio" as const, path: `${item.id}.mp3`, extension: ".mp3", source: "standard" as const },
      { kind: "video" as const, path: `${item.id}.mp4`, extension: ".mp4", source: "standard" as const },
    ],
  })),
};

describe("course question set", () => {
  it("builds renderer-ready text and media questions through the core generator", () => {
    const result = buildCourseQuestionSet({
      course,
      teachingStyle: "strict",
      directions: ["name-to-property", "property-to-name", "image-to-name", "name-to-image"],
      requestedKinds: ["input", "choice"],
      random: fixed,
    });

    expect(result.questions.some((question) => question.direction === "name-to-property" && question.kind === "input")).toBe(true);
    expect(result.questions.some((question) => question.direction === "name-to-property" && question.kind === "choice")).toBe(true);
    expect(result.questions.some((question) => question.direction === "image-to-name" && question.media?.kind === "image")).toBe(true);
    expect(result.questions.some((question) => question.direction === "name-to-image" && question.kind === "choice")).toBe(true);
    expect(result.skipped.some((entry) => entry.direction === "property-to-name" && entry.reason === "ambiguous-reverse-question")).toBe(true);
    expect(result.availability.generated).toBe(result.questions.length);
  });

  it("covers every text and multimedia direction", () => {
    const result = buildCourseQuestionSet({
      course: multimediaCourse,
      teachingStyle: "lenient",
      requestedKinds: ["input", "choice"],
      random: fixed,
    });
    const directions = new Set(result.questions.map((question) => question.direction));
    expect(directions).toEqual(new Set([
      "name-to-property",
      "property-to-name",
      "image-to-name",
      "name-to-image",
      "audio-to-name",
      "name-to-audio",
      "video-to-name",
      "name-to-video",
    ]));
  });

  it("honors filters and reports missing media instead of emitting invalid questions", () => {
    const result = buildCourseQuestionSet({
      course,
      selections: [{ field: "#Habitat", values: ["Coast"] }],
      teachingStyle: "strict",
      directions: ["audio-to-name", "name-to-audio"],
      requestedKinds: ["input", "choice"],
      random: fixed,
    });

    expect(result.questions).toEqual([]);
    expect(result.skipped).toEqual([
      { objectId: "gull", direction: "audio-to-name", requestedKind: "input", reason: "missing-media" },
      { objectId: "gull", direction: "audio-to-name", requestedKind: "choice", reason: "missing-media" },
      { objectId: "gull", direction: "name-to-audio", requestedKind: "choice", reason: "missing-media" },
    ]);
  });

  it("gives input and choice variants distinct stable IDs", () => {
    const result = buildCourseQuestionSet({
      course,
      teachingStyle: "strict",
      directions: ["name-to-property"],
      requestedKinds: ["input", "choice"],
      random: fixed,
    });
    expect(new Set(result.questions.map((question) => question.id)).size).toBe(result.questions.length);
    expect(result.questions.every((question) => question.id.startsWith("birds:"))).toBe(true);
  });
});

describe("batch A acceptance: scope and distractors", () => {
  it("never makes objects outside the filtered scope the target in either mode", () => {
    const selections = [{ field: "#Habitat", values: ["Coast"] }];
    for (const teachingStyle of ["strict", "lenient"] as const) {
      const result = buildCourseQuestionSet({
        course,
        selections,
        teachingStyle,
        directions: ["name-to-property", "property-to-name", "image-to-name", "name-to-image"],
        requestedKinds: ["input", "choice"],
        random: fixed,
      });
      expect(result.questions.length).toBeGreaterThan(0);
      for (const question of result.questions) {
        // The target object must always come from the filtered scope (D-08 boundary).
        expect(question.objectId).toBe("gull");
      }
    }
  });

  it("draws lenient distractors from outside the filter but inside the course", () => {
    // Habitat=Coast keeps only gull in scope; the other birds are in the course but out of scope.
    const result = buildCourseQuestionSet({
      course,
      selections: [{ field: "#Habitat", values: ["Coast"] }],
      teachingStyle: "lenient",
      directions: ["image-to-name"],
      requestedKinds: ["choice"],
      random: fixed,
    });
    const question = result.questions.find((entry) => entry.kind === "choice");
    const optionObjects = new Set(question?.options?.map((option) => option.objectId) ?? []);
    expect(optionObjects.has("gull")).toBe(true);
    expect(["cuckoo", "tit", "oriole"].some((id) => optionObjects.has(id))).toBe(true);
  });

  it("keeps every choice single-answer with unique options", () => {
    const result = buildCourseQuestionSet({
      course,
      teachingStyle: "strict",
      directions: ["name-to-property", "property-to-name", "image-to-name", "name-to-image"],
      requestedKinds: ["choice"],
      random: fixed,
    });
    expect(result.questions.length).toBeGreaterThan(0);
    for (const question of result.questions) {
      expect(question.kind).toBe("choice");
      const options = question.options ?? [];
      expect(options.length).toBeGreaterThanOrEqual(3);
      const normalizedValues = options.map((option) => option.value.trim().replace(/\s+/gu, " ").toLowerCase());
      expect(new Set(normalizedValues).size).toBe(options.length);
      const correctOptions = options.filter((option) =>
        evaluateAnswer(question.acceptedAnswers, option.value).fullyCorrect);
      expect(correctOptions).toHaveLength(1);
    }
  });
});
