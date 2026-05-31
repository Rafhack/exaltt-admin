/**
 * Data layer entry point
 *
 * Import everything from here — never import adapters directly in UI code.
 *
 *   import { repository } from "./data"
 *   const config = await repository.getConfig()
 *
 * To switch adapters, change VITE_DATA_ADAPTER in your .env:
 *
 *   VITE_DATA_ADAPTER=localstorage   ← default, works offline
 *   VITE_DATA_ADAPTER=rest           ← requires a running API (see restApiAdapter.js)
 */

import { LocalStorageAdapter } from "./adapters/localStorageAdapter.js";
import { RestApiAdapter }      from "./adapters/restApiAdapter.js";

const ADAPTER = import.meta.env.VITE_DATA_ADAPTER ?? "localstorage";

function createRepository() {
  switch (ADAPTER) {
    case "rest":         return new RestApiAdapter();
    case "localstorage": return new LocalStorageAdapter();
    default:
      console.warn(`[data] Unknown adapter "${ADAPTER}", falling back to localStorage`);
      return new LocalStorageAdapter();
  }
}

export const repository = createRepository();

// Re-export defaults so the UI doesn't need to know where they live
export { buildDefaultConfig } from "./defaults.js";
