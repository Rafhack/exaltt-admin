import { getToken } from "./auth.js";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

async function request(path, options = {}) {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

// ─── Users API ────────────────────────────────────────────────────────────────
export const usersApi = {
  list:       ()                          => request("/api/users"),
  create:     (body)                      => request("/api/users", { method: "POST", body: JSON.stringify(body) }),
  updateRole: (uid, role)                 => request(`/api/users/${uid}/role`, { method: "PATCH", body: JSON.stringify({ role }) }),
  delete:     (uid)                       => request(`/api/users/${uid}`, { method: "DELETE" }),
};
