import { BaseRepository } from "../repository.js";
import { buildDefaultConfig } from "../defaults.js";
import { getToken } from "../../auth.js";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

async function request(path, options = {}) {
  const token = await getToken();
  const { headers: extraHeaders, ...rest } = options;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...extraHeaders,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export class RestApiAdapter extends BaseRepository {
  async getConfig() {
    try {
      const res = await fetch(`${BASE_URL}/api/config`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (e) {
      console.error(
        "[RestApiAdapter] getConfig failed, using fallback:",
        e.message,
      );
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
