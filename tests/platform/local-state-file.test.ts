import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { defaultLocalState } from "../../src/application/state/defaults.js";
import { readLocalState, writeLocalState } from "../../src/main/storage/local-state-file";

describe("desktop local state file", () => {
  it("does not disguise an unreadable destination as an empty new profile", async () => {
    const directory = await mkdtemp(join(tmpdir(), "znawca-state-directory-"));
    await expect(readLocalState(directory)).rejects.toThrow();
  });
  it("serializes concurrent saves to the same destination", async () => {
    const directory = await mkdtemp(join(tmpdir(), "znawca-concurrent-state-"));
    const file = join(directory, "state.json");
    const states = Array.from({ length: 12 }, (_, index) => {
      const state = defaultLocalState();
      state.settings.questionLimit = index + 1;
      return state;
    });
    await Promise.all(states.map((state) => writeLocalState(file, state)));
    expect(await readLocalState(file)).toEqual(states.at(-1));
  });
  it("returns defaults when the file does not exist", async () => {
    expect(await readLocalState(join(tmpdir(), `missing-${Date.now()}.json`))).toEqual(defaultLocalState());
  });

  it("writes valid state atomically and reads it back", async () => {
    const directory = await mkdtemp(join(tmpdir(), "znawca-state-"));
    const file = join(directory, "nested", "state.json");
    const state = defaultLocalState();
    state.settings.locale = "zh-CN";
    await writeLocalState(file, state);
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual(state);
    expect(await readLocalState(file)).toEqual(state);
  });
});
