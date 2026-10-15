import { parseLocalState } from "./parse.js";
import { LocalState } from "../../contracts/local-state.js";

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export class LocalStateRepository {
  // Keep the original key so existing installations are migrated in place.
  static readonly key = "znawca.local-state.v1";
  constructor(private readonly store: KeyValueStore) {}
  load(): LocalState {
    return parseLocalState(this.store.getItem(LocalStateRepository.key));
  }
  save(state: LocalState): void {
    this.store.setItem(LocalStateRepository.key, JSON.stringify(state));
  }
}
