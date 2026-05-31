import { BaseRepository } from "../repository.js";
import { buildDefaultConfig } from "../defaults.js";

const STORAGE_KEY = "exaltt-admin-config";

export class LocalStorageAdapter extends BaseRepository {
  async getConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn("[LocalStorageAdapter] Failed to read config:", e);
    }
    return buildDefaultConfig();
  }

  async saveConfig(config) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      console.error("[LocalStorageAdapter] Failed to save config:", e);
      throw e;
    }
  }

  async saveSection(section, data) {
    const config = await this.getConfig();
    config[section] = data;
    await this.saveConfig(config);
  }

  async resetConfig() {
    localStorage.removeItem(STORAGE_KEY);
  }
}
