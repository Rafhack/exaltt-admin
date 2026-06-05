import { BaseRepository } from "../repository.js";
import { buildDefaultConfig } from "../defaults.js";

/**
 * REST API adapter
 *
 * Expects a backend with these endpoints:
 *   GET    /api/config              → { ...config }
 *   PUT    /api/config              → full config replace
 *   PATCH  /api/config/:section     → partial section update
 *   DELETE /api/config              → reset to defaults
 *
 * Set VITE_API_BASE_URL in your .env file:
 *   VITE_API_BASE_URL=https://your-api.com
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `[RestApiAdapter] ${options.method ?? "GET"} ${path} → ${res.status} ${body}`,
    );
  }
  // 204 No Content
  if (res.status === 204) return null;
  return res.json();
}

export class RestApiAdapter extends BaseRepository {
  async getConfig() {
    try {
      return await request("/api/config");
    } catch (e) {
      console.error(e);
      return buildDefaultConfig();
    }
  }

  async saveConfig(config) {
    await request("/api/config", {
      method: "PUT",
      body: JSON.stringify(config),
    });
  }

  async saveSection(section, data) {
    await request(`/api/config/${section}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async resetConfig() {
    await request("/api/config", { method: "DELETE" });
  }
}
