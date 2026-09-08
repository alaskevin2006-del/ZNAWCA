import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { defaultLocalState } from "../../src/core/persistence";
import { readLocalState, writeLocalState } from "../../src/main/local-state-file";

describe("desktop local state file", () => {
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
