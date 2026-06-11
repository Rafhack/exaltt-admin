import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext.jsx";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

const ROLE_STYLES = {
  super_admin: {
    bg: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    label: "Super Admin",
  },
  admin: {
    bg: "bg-blue-500/10  border-blue-500/30  text-blue-300",
    label: "Admin",
  },
};

function RoleBadge({ role }) {
  const s = ROLE_STYLES[role] ?? {
    bg: "bg-slate-700 text-slate-300 border-slate-600",
    label: role,
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-black tracking-wider ${s.bg}`}
    >
      {s.label}
    </span>
  );
}

export default function UsersSection() {
  const { currentUser, role: myRole, token } = useAuth();
  const isSuperAdmin = myRole === "super_admin";

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    displayName: "",
    role: "admin",
  });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Build headers from the stable token string, not a new object each render
  const authHeaders = useCallback(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token],
  );

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/users`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setUsers(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  // Only fires when token changes (i.e. once on mount, and if token refreshes)
  useEffect(() => {
    if (token) fetchUsers();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleChangeRole(uid, newRole) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${uid}/role`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, role: newRole } : u)),
      );
      showToast("Role atualizado com sucesso.");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleDelete(uid, email) {
    if (!window.confirm(`Tem certeza que deseja excluir o usuário ${email}?`))
      return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${uid}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok && res.status !== 204)
        throw new Error((await res.json()).error);
      setUsers((prev) => prev.filter((u) => u.uid !== uid));
      showToast("Usuário excluído.");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleCreate() {
    setFormError("");
    if (!form.email || !form.password) {
      setFormError("E-mail e senha são obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/users`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUsers((prev) => [...prev, data]);
      setCreating(false);
      setForm({ email: "", password: "", displayName: "", role: "admin" });
      showToast("Usuário criado com sucesso.");
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-slate-700/60 bg-[#070f1e] px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/10 placeholder:text-slate-600";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <span className="text-2xl">👥</span>
          <div>
            <h2 className="font-black text-white tracking-tight">Usuários</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {users.length} usuário{users.length !== 1 ? "s" : ""} cadastrado
              {users.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        {isSuperAdmin && (
          <button
            onClick={() => setCreating(true)}
            className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-black text-black hover:bg-cyan-400 transition"
          >
            + Novo usuário
          </button>
        )}
      </div>

      {/* Logged in as */}
      <div className="rounded-xl border border-slate-700/40 bg-[#070f1e] px-4 py-2.5 text-xs text-slate-400 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Logado como{" "}
        <span className="font-bold text-white">{currentUser?.email}</span>
        <RoleBadge role={myRole} />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-7 w-7 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-[#070f1e]">
                {["Usuário", "Role", "Criado em", "Criado por", ""].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2.5 text-left text-[10px] font-black tracking-widest text-slate-500 uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.uid}
                  className={`border-b border-slate-800/40 hover:bg-slate-800/30 transition ${u.uid === currentUser?.uid ? "bg-cyan-500/5" : ""}`}
                >
                  <td className="px-3 py-3">
                    <p className="font-bold text-white">
                      {u.displayName || "—"}
                    </p>
                    <p className="text-xs text-slate-400">{u.email}</p>
                    {u.uid === currentUser?.uid && (
                      <span className="text-[10px] text-cyan-400 font-black">
                        você
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {isSuperAdmin && u.uid !== currentUser?.uid ? (
                      <select
                        value={u.role}
                        onChange={(e) =>
                          handleChangeRole(u.uid, e.target.value)
                        }
                        className="rounded-lg border border-slate-700/60 bg-[#070f1e] px-2 py-1 text-xs font-bold text-white outline-none focus:border-cyan-500/60 cursor-pointer"
                      >
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super Admin</option>
                      </select>
                    ) : (
                      <RoleBadge role={u.role} />
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-400">
                    {u.createdAt
                      ? new Date(u.createdAt).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-400 font-mono">
                    {u.createdBy === "bootstrap" ? (
                      <span className="text-slate-600">bootstrap</span>
                    ) : u.createdBy ? (
                      u.createdBy.slice(0, 8) + "…"
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {isSuperAdmin && u.uid !== currentUser?.uid && (
                      <button
                        onClick={() => handleDelete(u.uid, u.email)}
                        className="rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-[11px] font-bold text-red-400 hover:bg-red-500/20 transition"
                      >
                        Excluir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-10 text-center text-sm text-slate-600"
                  >
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create user modal */}
      {creating && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          style={{
            background: "rgba(4,8,20,0.82)",
            backdropFilter: "blur(6px)",
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-700/60 bg-[#0d1b2e] shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <h3 className="font-black text-white">Novo Usuário</h3>
              <button
                onClick={() => {
                  setCreating(false);
                  setFormError("");
                }}
                className="text-slate-400 hover:text-white text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="mb-1.5 block text-[11px] font-black tracking-widest text-slate-400 uppercase">
                  E-mail *
                </label>
                <input
                  className={inputCls}
                  type="email"
                  placeholder="usuario@email.com"
                  value={form.email}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, email: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-black tracking-widest text-slate-400 uppercase">
                  Senha *
                </label>
                <input
                  className={inputCls}
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={form.password}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, password: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-black tracking-widest text-slate-400 uppercase">
                  Nome (opcional)
                </label>
                <input
                  className={inputCls}
                  placeholder="Nome do usuário"
                  value={form.displayName}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, displayName: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-black tracking-widest text-slate-400 uppercase">
                  Role
                </label>
                <select
                  className={inputCls}
                  value={form.role}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, role: e.target.value }))
                  }
                >
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              {formError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                  {formError}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleCreate}
                  disabled={saving}
                  className="flex-1 rounded-xl bg-cyan-500 py-2.5 text-sm font-black text-black hover:bg-cyan-400 transition disabled:opacity-50"
                >
                  {saving ? "Criando..." : "Criar usuário"}
                </button>
                <button
                  onClick={() => {
                    setCreating(false);
                    setFormError("");
                  }}
                  className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm font-bold text-slate-300 hover:bg-slate-700 transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border px-5 py-3 text-sm font-bold shadow-2xl ${
            toast.type === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : "border-red-500/40 bg-red-500/10 text-red-200"
          }`}
          style={{ backdropFilter: "blur(12px)" }}
        >
          {toast.type === "success" ? "✓" : "✕"} {toast.msg}
        </div>
      )}
    </div>
  );
}
