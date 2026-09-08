import { describe, expect, it } from "vitest";
import type { Course, CourseColumn, CourseItem } from "../../src/core/course/types.js";
import {
  bidirectionalHeaderIssues,
  BidirectionalHeaderError,
  bidirectionalStems,
  columnRole,
} from "../../src/core/quiz/course-adapter.js";
import { generateQuestion } from "../../src/core/quiz/generator.js";
import { buildCourseQuestionSet } from "../../src/core/quiz/question-set.js";
import { evaluateAnswer } from "../../src/core/quiz/scoring.js";
import type { CourseObject, RandomSource } from "../../src/core/quiz/types.js";

const fixed: RandomSource = { next: () => 0 };

const NAME_HEADER = "Country / 国家";
const CAPITAL = "Capital / 首都";
const FLAG = "*Flag / 国旗";
const ANTHEM = "$Anthem / 国歌";
const CONTINENT = "#Continent";

function column(index: number, title: string, filterOnly = false): CourseColumn {
  return { index, title, displayTitle: filterOnly ? title.slice(1) : title, filterOnly };
}

interface Country {
  readonly id: string;
  readonly name: string;
  readonly capital: readonly string[];
  readonly continent: readonly string[];
  readonly flag: readonly string[];
  readonly anthem: readonly string[];
}

const countries: readonly Country[] = [
  { id: "china", name: "China/PRC", capital: ["Beijing"], continent: ["Asia"], flag: ["Five-star red flag"], anthem: ["March of the Volunteers"] },
  { id: "japan", name: "Japan", capital: ["Tokyo"], continent: ["Asia"], flag: ["Rising Sun flag"], anthem: ["Kimigayo"] },
  { id: "france", name: "France", capital: ["Paris"], continent: ["Europe"], flag: ["Tricolour"], anthem: ["La Marseillaise"] },
  { id: "italy", name: "Italy", capital: ["Rome"], continent: ["Europe"], flag: ["Tricolore"], anthem: ["Il Canto degli Italiani"] },
];

function itemOf(country: Country, overrides: Partial<Record<string, readonly string[]>> = {}): CourseItem {
  return {
    id: country.id,
    name: country.name,
    sourceRow: 2,
    values: {
      [CAPITAL]: country.capital,
      [FLAG]: country.flag,
      [ANTHEM]: country.anthem,
      [CONTINENT]: country.continent,
      ...overrides,
    },
    media: [{ kind: "image", path: `${country.id}.png`, extension: ".png", source: "standard" }],
  };
}

function v2Course(
  columns: readonly CourseColumn[],
  items: readonly CourseItem[],
  overrides: { nameHeader?: string } = {},
): Course {
  return {
    id: "countries_eng",
    title: "Countries",
    formatVersion: "v2",
    nameColumnIndex: 2,
    directory: "C:/courses/Countries",
    workbookPath: "C:/courses/Countries/Countries_Eng.xlsx",
    sheetName: "Sheet1",
    columns: [column(2, overrides.nameHeader ?? NAME_HEADER), ...columns, column(6, CONTINENT, true)],
    items,
  };
}

describe("D-19: bidirectional header parsing", () => {
  it("splits on the first slash into two required stems", () => {
    expect(bidirectionalStems("Capital / Country")).toEqual({ forward: "Capital", reverse: "Country" });
    expect(bidirectionalStems("A / B / C")).toEqual({ forward: "A", reverse: "B / C" });
    expect(bidirectionalStems("Capital / Country")).not.toBeUndefined();
  });

  it("returns no stems when the slash or either side is missing", () => {
    expect(bidirectionalStems("Capital")).toBeUndefined();
    expect(bidirectionalStems("Capital /")).toBeUndefined();
    expect(bidirectionalStems("/ Country")).toBeUndefined();
    expect(bidirectionalStems("/")).toBeUndefined();
  });

  it("parses stems and roles behind column markers (D-19 + D-21 combination)", () => {
    expect(bidirectionalStems("$Capital / Country")).toEqual({ forward: "Capital", reverse: "Country" });
    expect(bidirectionalStems("*Flag / Country flag")).toEqual({ forward: "Flag", reverse: "Country flag" });
    expect(columnRole("$Capital / Country")).toBe("question-only");
    expect(columnRole("*Flag / Country flag")).toBe("answer-only");
    expect(columnRole("Capital / Country")).toBeUndefined();
    expect(columnRole("#Continent")).toBeUndefined();
  });
});

describe("D-19 acceptance: missing or one-sided headers block question building with position", () => {
  const validColumns = [column(3, CAPITAL), column(4, FLAG), column(5, ANTHEM)];

  it("blocks a header without '/' and reports the exact header cell", () => {
    const course = v2Course([column(3, "Capital"), column(4, FLAG), column(5, ANTHEM)], countries.map((country) => itemOf(country)));
    const issues = bidirectionalHeaderIssues(course);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      severity: "error",
      code: "HEADER_BIDIRECTIONAL_MISSING",
      location: {
        file: "C:/courses/Countries/Countries_Eng.xlsx",
        sheet: "Sheet1",
        row: 1,
        column: 3,
        columnName: "Capital",
      },
    });
    expect(() => buildCourseQuestionSet({ course, teachingStyle: "strict" })).toThrowError(BidirectionalHeaderError);
    try {
      buildCourseQuestionSet({ course, teachingStyle: "strict" });
      expect.unreachable("buildCourseQuestionSet must throw");
    } catch (error) {
      expect(error).toBeInstanceOf(BidirectionalHeaderError);
      expect((error as BidirectionalHeaderError).issues[0]?.location.column).toBe(3);
    }
  });

  it("blocks a header with an empty side and names the empty side", () => {
    for (const [title, emptySide] of [["Capital /", "reverse"] as const, ["/ Country", "forward"] as const]) {
      const course = v2Course([column(3, title), column(4, FLAG), column(5, ANTHEM)], countries.map((country) => itemOf(country)));
      const issues = bidirectionalHeaderIssues(course);
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({ severity: "error", code: "HEADER_BIDIRECTIONAL_SIDE_EMPTY" });
      expect(issues[0]?.message).toContain(emptySide);
      expect(issues[0]?.location).toMatchObject({ row: 1, column: 3 });
    }
  });

  it("also blocks an invalid name column header (B1 is a bidirectional stem in V2)", () => {
    const course = v2Course(validColumns, countries.map((country) => itemOf(country)), { nameHeader: "Country" });
    expect(bidirectionalHeaderIssues(course).map((issue) => issue.location.column)).toEqual([2]);
  });

  it("accepts valid V2 headers and uses each side as the direction's stem", () => {
    const course = v2Course(validColumns, countries.map((country) => itemOf(country)));
    expect(bidirectionalHeaderIssues(course)).toEqual([]);
    const result = buildCourseQuestionSet({
      course,
      teachingStyle: "strict",
      directions: ["name-to-property", "property-to-name"],
      requestedKinds: ["input"],
      random: fixed,
    });
    const forward = result.questions.find((question) => question.field === CAPITAL && question.direction === "name-to-property");
    const reverse = result.questions.find((question) => question.field === CAPITAL && question.direction === "property-to-name");
    expect(forward?.prompt).toBe("China/PRC / Capital");
    expect(reverse?.prompt).toBe("Beijing / 首都");
  });

  it("keeps V1 courses with plain headers working unchanged (read-only compatibility)", () => {
    const course: Course = {
      id: "birds",
      title: "Birds",
      directory: "C:/birds",
      workbookPath: "C:/birds/Birds.xlsx",
      sheetName: "Birds",
      columns: [
        { index: 1, title: "Name", displayTitle: "Name", filterOnly: false },
        { index: 2, title: "Food", displayTitle: "Food", filterOnly: false },
      ],
      items: [
        { id: "gull", name: "Gull", sourceRow: 2, values: { Food: ["fish"] }, media: [] },
        { id: "tit", name: "Tit", sourceRow: 3, values: { Food: ["seeds"] }, media: [] },
      ],
    };
    expect(bidirectionalHeaderIssues(course)).toEqual([]);
    const result = buildCourseQuestionSet({
      course,
      teachingStyle: "strict",
      directions: ["name-to-property", "property-to-name"],
      requestedKinds: ["input"],
      random: fixed,
    });
    expect(result.questions.length).toBeGreaterThan(0);
    expect(result.questions.find((question) => question.direction === "name-to-property")?.prompt).toBe("Gull / Food");
    expect(result.questions.find((question) => question.direction === "property-to-name")?.prompt).toBe("fish");
  });
});

describe("D-21 acceptance: column role markers constrain question directions", () => {
  const course = v2Course([column(3, CAPITAL), column(4, FLAG), column(5, ANTHEM)], countries.map((country) => itemOf(country)));

  it("generates no reverse question that uses an answer-only (*) column as its stem", () => {
    const result = buildCourseQuestionSet({
      course,
      teachingStyle: "strict",
      directions: ["name-to-property", "property-to-name"],
      requestedKinds: ["input"],
      random: fixed,
    });
    expect(result.questions.some((question) => question.field === FLAG && question.direction === "property-to-name")).toBe(false);
    expect(result.questions.some((question) => question.field === FLAG && question.direction === "name-to-property")).toBe(true);
  });

  it("generates no forward question that uses a question-only ($) column as its answer", () => {
    const result = buildCourseQuestionSet({
      course,
      teachingStyle: "strict",
      directions: ["name-to-property", "property-to-name"],
      requestedKinds: ["input"],
      random: fixed,
    });
    expect(result.questions.some((question) => question.field === ANTHEM && question.direction === "name-to-property")).toBe(false);
    expect(result.questions.some((question) => question.field === ANTHEM && question.direction === "property-to-name")).toBe(true);
  });

  it("leaves unmarked columns with both directions", () => {
    const result = buildCourseQuestionSet({
      course,
      teachingStyle: "strict",
      directions: ["name-to-property", "property-to-name"],
      requestedKinds: ["input"],
      random: fixed,
    });
    expect(result.questions.some((question) => question.field === CAPITAL && question.direction === "name-to-property")).toBe(true);
    expect(result.questions.some((question) => question.field === CAPITAL && question.direction === "property-to-name")).toBe(true);
  });

  it("does not replace the D-01 ambiguity skip for marked question-only columns", () => {
    // Two countries share the same anthem: the $-marked reverse question stays
    // subject to the existing ambiguity rejection instead of being forced out.
    const shared = countries.map((country, index) =>
      itemOf(country, index < 2 ? { [ANTHEM]: ["Shared March"] } : {}),
    );
    const ambiguous = v2Course([column(3, CAPITAL), column(4, FLAG), column(5, ANTHEM)], shared);
    const result = buildCourseQuestionSet({
      course: ambiguous,
      teachingStyle: "strict",
      directions: ["property-to-name"],
      requestedKinds: ["input"],
      random: fixed,
    });
    expect(result.questions.some((question) => question.field === ANTHEM && (question.objectId === "china" || question.objectId === "japan"))).toBe(false);
    expect(result.questions.some((question) => question.field === ANTHEM && question.objectId === "france")).toBe(true);
    expect(result.skipped).toContainEqual({
      objectId: "china",
      field: ANTHEM,
      direction: "property-to-name",
      requestedKind: "input",
      reason: "ambiguous-reverse-question",
    });
  });
});

describe("D-20 acceptance: aliases are displayed as declared in questions", () => {
  const objects: CourseObject[] = countries.map((country) => ({
    id: country.id,
    name: country.name,
    attributes: {
      [CAPITAL]: country.id === "china" ? ["Beijing/Pekin"] : country.capital,
    },
    media: { image: [`${country.id}.png`] },
  }));

  it("shows a slash alias group verbatim as the choice option", () => {
    const question = generateQuestion({
      target: objects[0]!,
      field: CAPITAL,
      direction: "name-to-property",
      requestedKind: "choice",
      filteredObjects: objects,
      allCourseObjects: objects,
      teachingStyle: "strict",
      random: fixed,
    });
    const correct = question.options?.find((option) => option.objectId === "china");
    expect(correct?.label).toBe("Beijing/Pekin");
    expect(question.acceptedAnswers).toEqual(["Beijing/Pekin"]);
    // Selecting the displayed option itself is correct, and so is one alias.
    expect(evaluateAnswer(question.acceptedAnswers, correct!.value).fullyCorrect).toBe(true);
    expect(evaluateAnswer(question.acceptedAnswers, "Pekin").fullyCorrect).toBe(true);
    expect(evaluateAnswer(question.acceptedAnswers, "Tokyo").fullyCorrect).toBe(false);
  });

  it("accepts any declared name alias for a reverse question about the name", () => {
    const question = generateQuestion({
      target: objects[0]!,
      field: CAPITAL,
      direction: "property-to-name",
      requestedKind: "input",
      filteredObjects: objects,
      allCourseObjects: objects,
      teachingStyle: "strict",
      random: fixed,
    });
    expect(question.prompt).toBe("Beijing/Pekin / 首都");
    expect(question.acceptedAnswers).toEqual(["China/PRC"]);
    expect(evaluateAnswer(question.acceptedAnswers, "PRC").fullyCorrect).toBe(true);
    expect(evaluateAnswer(question.acceptedAnswers, "China").fullyCorrect).toBe(true);
  });

  it("shows the name alias verbatim as a media-to-name choice option", () => {
    const question = generateQuestion({
      target: objects[0]!,
      direction: "image-to-name",
      requestedKind: "choice",
      filteredObjects: objects,
      allCourseObjects: objects,
      teachingStyle: "strict",
      random: fixed,
    });
    const correct = question.options?.find((option) => option.objectId === "china");
    expect(correct?.label).toBe("China/PRC");
    expect(evaluateAnswer(question.acceptedAnswers, correct!.value).fullyCorrect).toBe(true);
  });
});
