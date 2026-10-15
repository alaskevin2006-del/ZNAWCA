export interface CourseOrganizationSummary {
  readonly sourceDirectory: string;
  readonly organizedDirectory: string;
  readonly workbookCount: number;
  readonly copiedMediaCount: number;
  readonly unmatchedMediaCount: number;
}
