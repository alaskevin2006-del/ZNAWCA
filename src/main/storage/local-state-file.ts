import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { defaultLocalState } from "../../application/state/defaults.js";
import { parseLocalState } from "./parse.js";
import { type LocalState } from "../../contracts/local-state.js";

export async function readLocalState(file: string): Promise<LocalState> {
  try {
    return parseLocalState(await readFile(file, "utf8"));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return defaultLocalState();
    throw error;
  }
}

const pendingWrites = new Map<string, Promise<void>>();

export function writeLocalState(
  file: string,
  state: LocalState,
): Promise<void> {
  const target = resolve(file);
  const key = process.platform === "win32" ? target.toLowerCase() : target;
  const contents = JSON.stringify(state, null, 2);
  const previous = pendingWrites.get(key) ?? Promise.resolve();
  const write = previous
    .catch(() => undefined)
    .then(() => writeSnapshot(target, contents));
  pendingWrites.set(key, write);
  const release = () => {
    if (pendingWrites.get(key) === write) pendingWrites.delete(key);
  };
  void write.then(release, release);
  return write;
}

async function writeSnapshot(file: string, contents: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  await writeFile(temporary, contents, "utf8");
  await rename(temporary, file);
}
