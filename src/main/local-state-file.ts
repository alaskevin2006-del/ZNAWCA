import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { defaultLocalState, parseLocalState, type LocalState } from "../core/persistence/index.js";

export async function readLocalState(file: string): Promise<LocalState> {
  try {
    return parseLocalState(await readFile(file, "utf8"));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return defaultLocalState();
    return defaultLocalState();
  }
}

export async function writeLocalState(file: string, state: LocalState): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  await writeFile(temporary, JSON.stringify(state, null, 2), "utf8");
  await rename(temporary, file);
}
