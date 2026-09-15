import { realpath } from "node:fs/promises";
import path from "node:path";

export async function resolveLibraryCourseDirectory(
  rootDirectory: string,
  courseDirectory: string,
): Promise<string | undefined> {
  const root = await realpath(path.resolve(rootDirectory));
  const course = await realpath(path.resolve(courseDirectory));
  return isPathInsideOrEqual(course, root) ? course : undefined;
}

export function isPathInsideOrEqual(target: string, rootDirectory: string): boolean {
  const relative = path.relative(rootDirectory, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
