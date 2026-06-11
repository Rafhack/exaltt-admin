import { useState } from "react";
import { useAuth } from "./AuthContext.jsx";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#040810] px-4"
      style={{ fontFamily: "'IBM Plex Mono', 'Courier New', monospace" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&family=Syne:wght@800;900&display=swap');`}</style>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 mb-4">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[11px] font-black tracking-[0.2em] text-cyan-400 uppercase">EXALTT Admin</span>
          </div>
          <h1 className="text-2xl font-black text-white" style={{ fontFamily: "Syne, sans-serif" }}>
            Painel de Controle
          </h1>
          <p className="mt-1 text-xs text-slate-500">Acesso restrito a usuários autorizados</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-700/60 bg-[#0d1b2e] p-6 shadow-2xl">
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-black tracking-widest text-slate-400 uppercase">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmit(e)}
                className="w-full rounded-xl border border-slate-700/60 bg-[#070f1e] px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/10 placeholder:text-slate-600"
                placeholder="seu@email.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-black tracking-widest text-slate-400 uppercase">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmit(e)}
                className="w-full rounded-xl border border-slate-700/60 bg-[#070f1e] px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/10 placeholder:text-slate-600"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading || !email || !password}
              className="w-full rounded-xl bg-cyan-500 py-2.5 text-sm font-black text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-[10px] text-slate-600">
          Acesso apenas por convite. Contate um Super Admin.
        </p>
      </div>
    </div>
  );
}

function friendlyError(code) {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "E-mail ou senha incorretos.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Aguarde alguns minutos.";
    case "auth/network-request-failed":
      return "Erro de conexão. Verifique sua internet.";
    default:
      return "Erro ao entrar. Tente novamente.";
  }
}
