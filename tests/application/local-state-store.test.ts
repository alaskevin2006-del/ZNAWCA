import { describe, expect, it, vi } from "vitest";
import { LocalStateStore } from "../../src/application/state/local-state-store";
import { defaultLocalState } from "../../src/application/state/defaults";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe("application state owner", () => {
  it("does not overwrite unreadable data and replays edits after a successful retry", async () => {
    const saved = defaultLocalState();
    saved.settings.courseRoot = "existing-library";
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("access denied"))
      .mockResolvedValue(saved);
    const save = vi.fn().mockResolvedValue(undefined);
    const store = new LocalStateStore({ load, save });
    await store.initialize();
    store.updateSettings({ locale: "ru" });
    expect(store.getSnapshot()).toMatchObject({
      ready: false,
      saveStatus: "error",
    });
    expect(save).not.toHaveBeenCalled();
    store.retry();
    await store.initialize();
    await store.flush();
    expect(store.getSnapshot()).toMatchObject({
      ready: true,
      saveStatus: "idle",
    });
    expect(save).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        settings: expect.objectContaining({
          courseRoot: "existing-library",
          locale: "ru",
        }),
      }),
    );
  });

  it("serializes writes and keeps the latest setting after a slow save", async () => {
    const first = deferred<void>();
    const save = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValue(undefined);
    const store = new LocalStateStore({
      load: async () => defaultLocalState(),
      save,
    });
    await store.initialize();
    store.updateSettings({ locale: "pl" });
    store.updateSettings({ playerVolume: 0.3 });
    await Promise.resolve();
    expect(save).toHaveBeenCalledTimes(1);
    first.resolve();
    await store.flush();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0].settings).toMatchObject({
      locale: "pl",
      playerVolume: 0.3,
    });
    expect(store.getSnapshot().saveStatus).toBe("idle");
  });

  it("reports failure, retains in-memory edits, and retries the latest state", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("disk full"))
      .mockResolvedValue(undefined);
    const store = new LocalStateStore({
      load: async () => defaultLocalState(),
      save,
    });
    await store.initialize();
    store.updateSettings({ locale: "zh-CN" });
    await store.flush();
    expect(store.getSnapshot().saveStatus).toBe("error");
    expect(store.getSnapshot().state.settings.locale).toBe("zh-CN");
    store.retry();
    await store.flush();
    expect(store.getSnapshot().saveStatus).toBe("idle");
    expect(save.mock.calls[1][0].settings.locale).toBe("zh-CN");
  });

  it("replays edits made during loading over saved data without losing it", async () => {
    const load = deferred<ReturnType<typeof defaultLocalState>>();
    const saved = defaultLocalState();
    saved.settings.courseRoot = "saved-library";
    const save = vi.fn().mockResolvedValue(undefined);
    const store = new LocalStateStore({ load: () => load.promise, save });
    const loading = store.initialize();
    store.updateSettings({ locale: "ru" });
    expect(save).not.toHaveBeenCalled();
    load.resolve(saved);
    await loading;
    await store.flush();
    expect(store.getSnapshot().state.settings).toMatchObject({
      locale: "ru",
      courseRoot: "saved-library",
    });
  });
});
