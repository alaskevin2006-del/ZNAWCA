import type { Course } from "../course/types.js";
import { applyFilters, findNonDiscriminatingFields } from "./filter.js";
import type { CourseObject, FilterSelection, MediaKind } from "./types.js";

export function courseObjects(course: Course): CourseObject[] {
  const filterFields = new Set(course.columns.filter((column) => column.filterOnly).map((column) => column.title));
  return course.items.map((item) => {
    const attributes: Record<string, readonly string[]> = {};
    const filters: Record<string, readonly string[]> = {};
    for (const [field, values] of Object.entries(item.values)) {
      (filterFields.has(field) ? filters : attributes)[field] = values;
    }
    const media: Partial<Record<MediaKind, string[]>> = {};
    for (const asset of item.media) (media[asset.kind] ??= []).push(asset.path);
    return { id: item.id, name: item.name, attributes, filters, media };
  });
}

export function filterOptions(course: Course): Readonly<Record<string, readonly string[]>> {
  const result: Record<string, string[]> = {};
  for (const column of course.columns.filter((entry) => entry.filterOnly)) {
    result[column.title] = [...new Set(course.items.flatMap((item) => item.values[column.title] ?? []))]
      .sort((left, right) => left.localeCompare(right));
  }
  return result;
}

export function filteredCourseObjects(course: Course, selections: readonly FilterSelection[]): CourseObject[] {
  return applyFilters(courseObjects(course), selections.filter((selection) => selection.values.length > 0));
}

export function skippedQuestionFields(course: Course, selections: readonly FilterSelection[]): string[] {
  const objects = filteredCourseObjects(course, selections);
  const nameColumnIndex = course.nameColumnIndex ?? 1;
  const questionFields = course.columns
    .filter((column) => column.index > nameColumnIndex && !column.filterOnly)
    .map((column) => column.title);
  return findNonDiscriminatingFields(objects, questionFields);
}
