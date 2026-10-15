import type { LocalState } from "../../contracts/local-state.js";
import { defaultLocalState } from "./defaults.js";

export interface StatePersistence {
  load(): Promise<LocalState>;
  save(state: LocalState): Promise<void>;
}

type Update = (state: LocalState) => LocalState;
export interface StateSnapshot {
  readonly state: LocalState;
  readonly ready: boolean;
  readonly saveStatus: "idle" | "saving" | "error";
}

/** Owns local state and serializes complete snapshots through an injected adapter. */
export class LocalStateStore {
  private snapshot: StateSnapshot = {
    state: defaultLocalState(),
    ready: false,
    saveStatus: "idle",
  };
  private readonly listeners = new Set<() => void>();
  private loading?: Promise<void>;
  private pending: Update[] = [];
  private writes = Promise.resolve();
  private revision = 0;

  constructor(private readonly persistence: StatePersistence) {}

  getSnapshot = (): StateSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  initialize(): Promise<void> {
    if (this.loading) return this.loading;
    this.loading = this.persistence
      .load()
      .then((loaded) => {
        const hadEdits = this.pending.length > 0;
        const state = this.pending.reduce(
          (current, update) => update(current),
          loaded,
        );
        this.pending = [];
        this.publish({ state, ready: true, saveStatus: "idle" });
        if (hadEdits) this.enqueue(state);
      })
      .catch(() => {
        this.loading = undefined;
        this.publish({ ...this.snapshot, saveStatus: "error" });
      });
    return this.loading;
  }

  update = (update: Update): void => {
    const state = update(this.snapshot.state);
    if (!this.snapshot.ready) this.pending.push(update);
    this.publish({ ...this.snapshot, state });
    if (this.snapshot.ready) this.enqueue(state);
  };

  updateSettings = (patch: Partial<LocalState["settings"]>): void => {
    this.update((state) => ({
      ...state,
      settings: { ...state.settings, ...patch },
    }));
  };

  retry = (): void => {
    if (!this.snapshot.ready) void this.initialize();
    else this.enqueue(this.snapshot.state);
  };

  flush(): Promise<void> {
    return this.writes;
  }

  private enqueue(state: LocalState): void {
    const revision = ++this.revision;
    this.publish({ ...this.snapshot, saveStatus: "saving" });
    this.writes = this.writes
      .then(() => this.persistence.save(state))
      .then(
        () => {
          if (revision === this.revision)
            this.publish({ ...this.snapshot, saveStatus: "idle" });
        },
        () => {
          if (revision === this.revision)
            this.publish({ ...this.snapshot, saveStatus: "error" });
        },
      );
  }

  private publish(snapshot: StateSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
}
