import { useState, useEffect, useCallback } from "react";

// ─── DEFAULT DATA (mirrors App.jsx) ────────────────────────────────────────────

const DEFAULT_BRAND = {
  company: "TopTools Brasil",
  line: "EXALTT",
  product: "Clever Mind – Drilling AI",
  mode: "Secure Local App",
  notebookEmail: "silvio@toptools.comn.br",
  onboardiaEndpoint: "/api/onboardia/pdf-agent",
  fallbackEndpoint: "/api/ai-report-agent",
};

const DEFAULT_MATERIALS = {
  "SAE 1020": { vc: 135, fn: 0.26, life: 1800, iso: "P", materialClass: "Aço carbono baixo carbono" },
  "SAE 1045": { vc: 125, fn: 0.22, life: 1500, iso: "P", materialClass: "Aço carbono médio carbono" },
  "SAE 4140": { vc: 115, fn: 0.24, life: 1200, iso: "P", materialClass: "Aço ligado beneficiado" },
  "SAE 8620": { vc: 86, fn: 0.19, life: 2300, iso: "P", materialClass: "Aço ligado para cementação" },
  "SAE 52100": { vc: 75, fn: 0.16, life: 950, iso: "P", materialClass: "Aço rolamento alto carbono/cromo" },
  "D2": { vc: 58, fn: 0.13, life: 720, iso: "H", materialClass: "Aço ferramenta alto cromo endurecido" },
  "VC131": { vc: 55, fn: 0.12, life: 680, iso: "H", materialClass: "Aço ferramenta similar D2 / alta dureza" },
  "Inox 304": { vc: 68, fn: 0.16, life: 850, iso: "M", materialClass: "Aço inoxidável austenítico" },
  "Inox 316": { vc: 62, fn: 0.15, life: 780, iso: "M", materialClass: "Aço inoxidável austenítico com molibdênio" },
  "Inox 410": { vc: 75, fn: 0.17, life: 900, iso: "M", materialClass: "Aço inoxidável martensítico" },
  "Inox 420": { vc: 65, fn: 0.14, life: 760, iso: "M", materialClass: "Aço inoxidável martensítico endurecível" },
  "Ferro Fundido Cinzento": { vc: 120, fn: 0.28, life: 1800, iso: "K", materialClass: "Ferro fundido cinzento" },
  "Ferro Fundido Nodular": { vc: 105, fn: 0.25, life: 1600, iso: "K", materialClass: "Ferro fundido nodular" },
  "Alumínio 6061": { vc: 220, fn: 0.30, life: 2400, iso: "N", materialClass: "Alumínio usinável série 6000" },
  "Alumínio 7075": { vc: 190, fn: 0.26, life: 2100, iso: "N", materialClass: "Alumínio aeronáutico alta resistência" },
  "Alumínio Fundido": { vc: 180, fn: 0.28, life: 2000, iso: "N", materialClass: "Alumínio fundido com silício" },
  "Cobre Eletrolítico": { vc: 120, fn: 0.18, life: 1500, iso: "N", materialClass: "Cobre puro de alta condutividade" },
  "Latão": { vc: 180, fn: 0.24, life: 2200, iso: "N", materialClass: "Liga cobre-zinco / brass" },
  "Bronze": { vc: 115, fn: 0.20, life: 1600, iso: "N", materialClass: "Liga cobre-estanho / bronze" },
  "Cobre Berílio": { vc: 95, fn: 0.16, life: 1250, iso: "N", materialClass: "Liga cobre-berílio alta resistência" },
  "Inconel 625": { vc: 32, fn: 0.08, life: 420, iso: "S", materialClass: "Superliga níquel resistente ao calor" },
  "Inconel 718": { vc: 28, fn: 0.07, life: 360, iso: "S", materialClass: "Superliga níquel endurecida por precipitação" },
  "Titânio Ti6Al4V": { vc: 45, fn: 0.10, life: 520, iso: "S", materialClass: "Liga de titânio aeroespacial" },
  "Aço Temperado 45 HRC": { vc: 48, fn: 0.10, life: 600, iso: "H", materialClass: "Aço endurecido até 45 HRC" },
  "Aço Temperado 55 HRC": { vc: 35, fn: 0.08, life: 430, iso: "H", materialClass: "Aço endurecido até 55 HRC" },
  "Aço Temperado 60 HRC": { vc: 28, fn: 0.06, life: 320, iso: "H", materialClass: "Aço endurecido até 60 HRC" },
};

const DEFAULT_ISO_CLASSES = {
  P: "ISO P — Aços",
  M: "ISO M — Aços inoxidáveis",
  K: "ISO K — Ferros fundidos",
  N: "ISO N — Não ferrosos",
  S: "ISO S — Superligas resistentes ao calor",
  H: "ISO H — Materiais endurecidos",
};

const DEFAULT_GEOMETRIES = {
  XTA: { code: "XTA", name: "Geometria para Aços", application: "Aplicar em aços carbono, baixa liga e aços ligados ISO P.", iso: ["P"] },
  XTH: { code: "XTH", name: "Geometria para Ferro Fundido", application: "Aplicar em ferro fundido cinzento e nodular ISO K.", iso: ["K"] },
  XTS: { code: "XTS", name: "Geometria para Não Ferrosos", application: "Aplicar em não ferrosos ISO N, inclusive alumínio, cobre e ligas de cobre.", iso: ["N"] },
  XTL: { code: "XTL", name: "Geometria para Inox e Superligas", application: "Aplicar em aços inoxidáveis ISO M, titânio, Inconel e superligas resistentes ao calor ISO S.", iso: ["M", "S"] },
};

const DEFAULT_DEPTHS = {
  "3xD": { vc: 1.05, fn: 1.03, life: 1.08, risk: 99 },
  "5xD": { vc: 1.00, fn: 1.00, life: 1.00, risk: 98 },
  "8xD": { vc: 0.92, fn: 0.94, life: 0.88, risk: 91 },
  "12xD": { vc: 0.84, fn: 0.88, life: 0.76, risk: 84 },
};

const DEFAULT_MACHINES = {
  "Romi D800": { vc: 1.00, fn: 1.00, stability: 98 },
  "HASS VF-5-50XT": { vc: 1.03, fn: 1.02, stability: 97 },
  "Fanuc Robodrill D14Mi": { vc: 1.03, fn: 1.02, stability: 97 },
  "Fanuc Robodrill D21Mi": { vc: 1.04, fn: 1.03, stability: 98 },
  "Brother Speedio R450-X": { vc: 1.06, fn: 1.04, stability: 99 },
  "Brother Speedio R650-X": { vc: 1.06, fn: 1.04, stability: 99 },
  "Mazak VTC 200C": { vc: 1.03, fn: 1.02, stability: 97 },
  "Mazak VTC-EZ30": { vc: 1.04, fn: 1.03, stability: 98 },
  "Heller H4000": { vc: 1.05, fn: 1.04, stability: 99 },
  "Heller H8000": { vc: 1.06, fn: 1.05, stability: 99 },
  "Okuma MB-4000H": { vc: 1.04, fn: 1.03, stability: 98 },
  "Okuma MB-5000HII": { vc: 1.05, fn: 1.04, stability: 99 },
  "Deckel Maho DMU50": { vc: 1.02, fn: 1.01, stability: 97 },
};

// ─── STORAGE KEY ───────────────────────────────────────────────────────────────
const STORAGE_KEY = "exaltt-admin-config";

function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveConfig(config) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch {
    return false;
  }
}

function buildDefaultConfig() {
  return {
    brand: { ...DEFAULT_BRAND },
    materials: { ...DEFAULT_MATERIALS },
    isoClasses: { ...DEFAULT_ISO_CLASSES },
    geometries: JSON.parse(JSON.stringify(DEFAULT_GEOMETRIES)),
    depths: JSON.parse(JSON.stringify(DEFAULT_DEPTHS)),
    machines: { ...DEFAULT_MACHINES },
  };
}

// ─── HELPERS ───────────────────────────────────────────────────────────────────
// Base palette for known ISO keys; extras cycle through extended colors
const ISO_COLOR_PALETTE = {
  P: "#3b82f6", M: "#8b5cf6", K: "#f59e0b",
  N: "#10b981", S: "#ef4444", H: "#ec4899",
};
const EXTRA_COLORS = ["#06b6d4", "#f97316", "#84cc16", "#a78bfa", "#fb7185", "#34d399"];

function buildIsoMeta(isoClasses) {
  const keys = Object.keys(isoClasses);
  const extraKeys = keys.filter(k => !ISO_COLOR_PALETTE[k]);
  const colors = Object.fromEntries(
    keys.map(k => [k, ISO_COLOR_PALETTE[k] || EXTRA_COLORS[extraKeys.indexOf(k) % EXTRA_COLORS.length] || "#64748b"])
  );
  return { isoOptions: keys, isoColors: colors };
}

function IsoBadge({ iso, isoColors }) {
  const color = (isoColors && isoColors[iso]) || ISO_COLOR_PALETTE[iso] || "#64748b";
  return (
    <span style={{ background: color + "22", color, border: `1px solid ${color}55` }}
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-black tracking-wider">
      {iso}
    </span>
  );
}

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2800);
    return () => clearTimeout(t);
  }, [onClose]);
  const colors = type === "success"
    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
    : "border-red-500/40 bg-red-500/10 text-red-200";
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border px-5 py-3 text-sm font-bold shadow-2xl ${colors}`}
      style={{ backdropFilter: "blur(12px)" }}>
      <span>{type === "success" ? "✓" : "✕"}</span>
      {message}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ background: "rgba(4,8,20,0.82)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-lg rounded-2xl border border-slate-700/60 bg-[#0d1b2e] shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h3 className="font-black text-white tracking-tight">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── FIELD COMPONENTS ─────────────────────────────────────────────────────────
function FormField({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-black tracking-widest text-slate-400 uppercase">{label}</span>
      {children}
      {hint && <p className="mt-1 text-[10px] text-slate-600">{hint}</p>}
    </label>
  );
}

const inputCls = "w-full rounded-xl border border-slate-700/60 bg-[#070f1e] px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/10 placeholder:text-slate-600";

// ─── SECTIONS ─────────────────────────────────────────────────────────────────

function BrandSection({ brand, onChange, onSave }) {
  const [local, setLocal] = useState({ ...brand });
  useEffect(() => setLocal({ ...brand }), [brand]);
  const set = (k, v) => setLocal(p => ({ ...p, [k]: v }));
  const handleSave = () => onChange(local);

  return (
    <div className="space-y-4">
      <SectionHeader icon="🏷️" title="Identidade da Marca" subtitle="Nome, linha, produto e configurações de endpoint" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Empresa"><input className={inputCls} value={local.company} onChange={e => set("company", e.target.value)} /></FormField>
        <FormField label="Linha"><input className={inputCls} value={local.line} onChange={e => set("line", e.target.value)} /></FormField>
        <FormField label="Produto"><input className={inputCls} value={local.product} onChange={e => set("product", e.target.value)} /></FormField>
        <FormField label="Modo"><input className={inputCls} value={local.mode} onChange={e => set("mode", e.target.value)} /></FormField>
      </div>
      <div className="mt-2 rounded-xl border border-slate-700/40 bg-[#070f1e] p-4 space-y-3">
        <p className="text-[11px] font-black tracking-widest text-slate-400 uppercase">Configurações de E-mail e API</p>
        <FormField label="E-mail autorizado do notebook" hint="E-mail vinculado ao envio automático do PDF">
          <input className={inputCls} value={local.notebookEmail} onChange={e => set("notebookEmail", e.target.value)} />
        </FormField>
        <FormField label="Endpoint OnboardIA" hint="Endpoint primário de envio do agente">
          <input className={inputCls} value={local.onboardiaEndpoint} onChange={e => set("onboardiaEndpoint", e.target.value)} />
        </FormField>
        <FormField label="Endpoint de Fallback" hint="Usado quando o endpoint primário falha">
          <input className={inputCls} value={local.fallbackEndpoint} onChange={e => set("fallbackEndpoint", e.target.value)} />
        </FormField>
      </div>
      <SaveButton onClick={handleSave} />
    </div>
  );
}

function MaterialsSection({ materials, isoClasses, onChange }) {
  const { isoOptions, isoColors } = buildIsoMeta(isoClasses);
  const [search, setSearch] = useState("");
  const [filterIso, setFilterIso] = useState("ALL");
  const [editing, setEditing] = useState(null); // { name, ...fields } or null
  const [isNew, setIsNew] = useState(false);

  const filtered = Object.entries(materials).filter(([name, m]) => {
    const matchSearch = name.toLowerCase().includes(search.toLowerCase()) ||
      m.materialClass.toLowerCase().includes(search.toLowerCase());
    const matchIso = filterIso === "ALL" || m.iso === filterIso;
    return matchSearch && matchIso;
  });

  const openNew = () => {
    setEditing({ name: "", vc: 100, fn: 0.2, life: 1000, iso: "P", materialClass: "" });
    setIsNew(true);
  };
  const openEdit = (name) => {
    setEditing({ name, ...materials[name] });
    setIsNew(false);
  };
  const deleteMat = (name) => {
    const next = { ...materials };
    delete next[name];
    onChange(next);
  };
  const save = () => {
    if (!editing.name.trim()) return;
    const { name, ...fields } = editing;
    const next = { ...materials };
    if (!isNew) delete next[editing._origName || name];
    next[name] = { vc: Number(fields.vc), fn: Number(fields.fn), life: Number(fields.life), iso: fields.iso, materialClass: fields.materialClass };
    onChange(next);
    setEditing(null);
  };

  return (
    <div className="space-y-4">
      <SectionHeader icon="⚙️" title="Materiais" subtitle={`${Object.keys(materials).length} materiais cadastrados`} />

      <div className="flex flex-col gap-2 sm:flex-row">
        <input className={inputCls + " flex-1"} placeholder="Buscar material..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex gap-1 flex-wrap">
          {["ALL", ...isoOptions].map(iso => (
            <button key={iso} onClick={() => setFilterIso(iso)}
              className={`rounded-lg px-3 py-2 text-[11px] font-black transition ${filterIso === iso ? "bg-cyan-500 text-black" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>
              {iso}
            </button>
          ))}
        </div>
        <button onClick={openNew} className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-black text-black hover:bg-cyan-400 transition whitespace-nowrap">+ Novo</button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-[#070f1e]">
              <Th>Material</Th><Th>ISO</Th><Th>Vc</Th><Th>fn</Th><Th>Vida</Th><Th>Classe</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(([name, m]) => (
              <tr key={name} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition">
                <td className="px-3 py-2.5 font-bold text-white">{name}</td>
                <td className="px-3 py-2.5"><IsoBadge iso={m.iso} isoColors={isoColors} /></td>
                <td className="px-3 py-2.5 text-cyan-300 font-mono">{m.vc}</td>
                <td className="px-3 py-2.5 text-cyan-300 font-mono">{m.fn}</td>
                <td className="px-3 py-2.5 text-slate-300 font-mono">{m.life}</td>
                <td className="px-3 py-2.5 text-slate-400 text-xs max-w-[200px] truncate">{m.materialClass}</td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1 justify-end">
                    <ActionBtn onClick={() => openEdit(name)} color="blue">Editar</ActionBtn>
                    <ActionBtn onClick={() => deleteMat(name)} color="red">Del</ActionBtn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="py-8 text-center text-slate-600 text-sm">Nenhum material encontrado.</p>}
      </div>

      {editing && (
        <Modal title={isNew ? "Novo Material" : `Editar: ${editing.name}`} onClose={() => setEditing(null)}>
          <div className="space-y-3">
            <FormField label="Nome do material">
              <input className={inputCls} value={editing.name} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Vc (m/min)"><input className={inputCls} type="number" value={editing.vc} onChange={e => setEditing(p => ({ ...p, vc: e.target.value }))} /></FormField>
              <FormField label="fn (mm/rev)"><input className={inputCls} type="number" step="0.01" value={editing.fn} onChange={e => setEditing(p => ({ ...p, fn: e.target.value }))} /></FormField>
              <FormField label="Vida útil (furos)"><input className={inputCls} type="number" value={editing.life} onChange={e => setEditing(p => ({ ...p, life: e.target.value }))} /></FormField>
              <FormField label="Classe ISO">
                <select className={inputCls} value={editing.iso} onChange={e => setEditing(p => ({ ...p, iso: e.target.value }))}>
                  {isoOptions.map(o => <option key={o}>{o}</option>)}
                </select>
              </FormField>
            </div>
            <FormField label="Classe do material">
              <input className={inputCls} value={editing.materialClass} onChange={e => setEditing(p => ({ ...p, materialClass: e.target.value }))} />
            </FormField>
            <div className="flex gap-2 pt-2">
              <button onClick={save} className="flex-1 rounded-xl bg-cyan-500 py-2.5 text-sm font-black text-black hover:bg-cyan-400 transition">Salvar</button>
              <button onClick={() => setEditing(null)} className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm font-bold text-slate-300 hover:bg-slate-700 transition">Cancelar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function IsoClassesSection({ isoClasses, onChange }) {
  const [local, setLocal] = useState({ ...isoClasses });
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  useEffect(() => setLocal({ ...isoClasses }), [isoClasses]);
  const { isoColors } = buildIsoMeta(local);

  const addEntry = () => {
    const key = newKey.trim().toUpperCase();
    if (!key || !newLabel.trim() || local[key]) return;
    setLocal(p => ({ ...p, [key]: newLabel.trim() }));
    setNewKey("");
    setNewLabel("");
  };

  const deleteEntry = (key) => {
    const next = { ...local };
    delete next[key];
    setLocal(next);
  };

  return (
    <div className="space-y-4">
      <SectionHeader icon="📋" title="Classes ISO" subtitle="Descrições das classes de materiais ISO" />
      <div className="space-y-3">
        {Object.entries(local).map(([key, label]) => (
          <div key={key} className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-black text-sm"
              style={{ background: (isoColors[key] || "#64748b") + "22", color: isoColors[key] || "#64748b", border: `1px solid ${(isoColors[key] || "#64748b")}44` }}>
              {key}
            </div>
            <input className={inputCls} value={label}
              onChange={e => setLocal(p => ({ ...p, [key]: e.target.value }))} />
            <button onClick={() => deleteEntry(key)}
              className="shrink-0 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-[11px] font-bold text-red-400 hover:bg-red-500/20 transition">
              Del
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-[#070f1e] p-4 space-y-3">
        <p className="text-[11px] font-black tracking-widest text-slate-400 uppercase">Nova classe ISO</p>
        <div className="flex gap-2">
          <input className={inputCls + " flex-1 text-center font-black uppercase"} placeholder="Ex: Q"
            maxLength={4} value={newKey} onChange={e => setNewKey(e.target.value.toUpperCase())} />
          <input className={inputCls + " flex-1"} placeholder="Descrição da classe..."
            value={newLabel} onChange={e => setNewLabel(e.target.value)} />
          <button onClick={addEntry} disabled={!newKey.trim() || !newLabel.trim()}
            className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-black text-black hover:bg-cyan-400 transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
            + Adicionar
          </button>
        </div>
      </div>

      <SaveButton onClick={() => onChange(local)} />
    </div>
  );
}

function GeometriesSection({ geometries, isoClasses, onChange }) {
  const { isoOptions, isoColors } = buildIsoMeta(isoClasses);
  const [editing, setEditing] = useState(null);
  const [isNew, setIsNew] = useState(false);

  const openNew = () => {
    setEditing({ code: "", name: "", application: "", iso: [] });
    setIsNew(true);
  };
  const save = () => {
    if (!editing.code.trim()) return;
    const next = { ...geometries, [editing.code]: { code: editing.code, name: editing.name, application: editing.application, iso: editing.iso } };
    onChange(next);
    setEditing(null);
  };
  const del = (code) => {
    const next = { ...geometries };
    delete next[code];
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <SectionHeader icon="🔩" title="Geometrias EXALTT" subtitle="Códigos de geometria e suas aplicações" />
      <div className="flex justify-end">
        <button onClick={openNew} className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-black text-black hover:bg-cyan-400 transition">+ Nova geometria</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.values(geometries).map(g => (
          <div key={g.code} className="rounded-xl border border-slate-700/50 bg-[#070f1e] p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-black text-cyan-300 text-lg">{g.code}</span>
                <p className="text-sm font-bold text-white mt-0.5">{g.name}</p>
              </div>
              <div className="flex gap-1">
                <ActionBtn onClick={() => { setEditing({ ...g, iso: [...g.iso] }); setIsNew(false); }} color="blue">Editar</ActionBtn>
                <ActionBtn onClick={() => del(g.code)} color="red">Del</ActionBtn>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{g.application}</p>
            <div className="flex gap-1 flex-wrap">
              {g.iso.map(i => <IsoBadge key={i} iso={i} isoColors={isoColors} />)}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <Modal title={isNew ? "Nova Geometria" : `Editar: ${editing.code}`} onClose={() => setEditing(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Código"><input className={inputCls} value={editing.code} onChange={e => setEditing(p => ({ ...p, code: e.target.value }))} disabled={!isNew} /></FormField>
              <FormField label="Nome"><input className={inputCls} value={editing.name} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} /></FormField>
            </div>
            <FormField label="Aplicação">
              <textarea className={inputCls + " resize-none h-20"} value={editing.application} onChange={e => setEditing(p => ({ ...p, application: e.target.value }))} />
            </FormField>
            <FormField label="Classes ISO aplicáveis">
              <div className="flex flex-wrap gap-2 mt-1">
                {isoOptions.map(iso => (
                  <button key={iso} type="button"
                    onClick={() => setEditing(p => ({ ...p, iso: p.iso.includes(iso) ? p.iso.filter(x => x !== iso) : [...p.iso, iso] }))}
                    className={`rounded-lg px-3 py-1.5 text-xs font-black transition`}
                    style={editing.iso.includes(iso)
                      ? { background: (isoColors[iso] || "#64748b") + "33", color: isoColors[iso] || "#64748b", border: `1px solid ${(isoColors[iso] || "#64748b")}66` }
                      : { background: "#1e293b", color: "#64748b", border: "1px solid #334155" }}>
                    {iso}
                  </button>
                ))}
              </div>
            </FormField>
            <div className="flex gap-2 pt-2">
              <button onClick={save} className="flex-1 rounded-xl bg-cyan-500 py-2.5 text-sm font-black text-black hover:bg-cyan-400 transition">Salvar</button>
              <button onClick={() => setEditing(null)} className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm font-bold text-slate-300 hover:bg-slate-700 transition">Cancelar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function DepthsSection({ depths, onChange }) {
  const [editing, setEditing] = useState(null);
  const [isNew, setIsNew] = useState(false);

  const openNew = () => {
    setEditing({ key: "", vc: 1.0, fn: 1.0, life: 1.0, risk: 95 });
    setIsNew(true);
  };
  const save = () => {
    if (!editing.key.trim()) return;
    const { key, ...fields } = editing;
    const next = { ...depths, [key]: { vc: Number(fields.vc), fn: Number(fields.fn), life: Number(fields.life), risk: Number(fields.risk) } };
    onChange(next);
    setEditing(null);
  };
  const del = (key) => {
    const next = { ...depths };
    delete next[key];
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <SectionHeader icon="📏" title="Fatores de Profundidade" subtitle="Multiplicadores por relação L/D" />
      <div className="flex justify-end">
        <button onClick={openNew} className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-black text-black hover:bg-cyan-400 transition">+ Nova profundidade</button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-800/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-[#070f1e]">
              <Th>Relação L/D</Th><Th>Fator Vc</Th><Th>Fator fn</Th><Th>Fator Vida</Th><Th>Risco (%)</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(depths).map(([key, d]) => (
              <tr key={key} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition">
                <td className="px-3 py-2.5 font-black text-cyan-300">{key}</td>
                <td className="px-3 py-2.5 font-mono text-slate-200">{d.vc}</td>
                <td className="px-3 py-2.5 font-mono text-slate-200">{d.fn}</td>
                <td className="px-3 py-2.5 font-mono text-slate-200">{d.life}</td>
                <td className="px-3 py-2.5">
                  <RiskBar value={d.risk} />
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1 justify-end">
                    <ActionBtn onClick={() => { setEditing({ key, ...d }); setIsNew(false); }} color="blue">Editar</ActionBtn>
                    <ActionBtn onClick={() => del(key)} color="red">Del</ActionBtn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={isNew ? "Nova Profundidade" : `Editar: ${editing.key}`} onClose={() => setEditing(null)}>
          <div className="space-y-3">
            <FormField label="Relação L/D (ex: 5xD)">
              <input className={inputCls} value={editing.key} onChange={e => setEditing(p => ({ ...p, key: e.target.value }))} disabled={!isNew} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Fator Vc"><input className={inputCls} type="number" step="0.01" value={editing.vc} onChange={e => setEditing(p => ({ ...p, vc: e.target.value }))} /></FormField>
              <FormField label="Fator fn"><input className={inputCls} type="number" step="0.01" value={editing.fn} onChange={e => setEditing(p => ({ ...p, fn: e.target.value }))} /></FormField>
              <FormField label="Fator Vida"><input className={inputCls} type="number" step="0.01" value={editing.life} onChange={e => setEditing(p => ({ ...p, life: e.target.value }))} /></FormField>
              <FormField label="Risco (0-100)"><input className={inputCls} type="number" min="0" max="100" value={editing.risk} onChange={e => setEditing(p => ({ ...p, risk: e.target.value }))} /></FormField>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={save} className="flex-1 rounded-xl bg-cyan-500 py-2.5 text-sm font-black text-black hover:bg-cyan-400 transition">Salvar</button>
              <button onClick={() => setEditing(null)} className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm font-bold text-slate-300 hover:bg-slate-700 transition">Cancelar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function MachinesSection({ machines, onChange }) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [isNew, setIsNew] = useState(false);

  const filtered = Object.entries(machines).filter(([name]) =>
    name.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => { setEditing({ name: "", vc: 1.0, fn: 1.0, stability: 97 }); setIsNew(true); };
  const openEdit = (name) => { setEditing({ name, ...machines[name] }); setIsNew(false); };
  const del = (name) => { const n = { ...machines }; delete n[name]; onChange(n); };
  const save = () => {
    if (!editing.name.trim()) return;
    const { name, ...fields } = editing;
    const next = { ...machines, [name]: { vc: Number(fields.vc), fn: Number(fields.fn), stability: Number(fields.stability) } };
    onChange(next);
    setEditing(null);
  };

  return (
    <div className="space-y-4">
      <SectionHeader icon="🏭" title="Máquinas" subtitle={`${Object.keys(machines).length} máquinas cadastradas`} />
      <div className="flex gap-2">
        <input className={inputCls + " flex-1"} placeholder="Buscar máquina..." value={search} onChange={e => setSearch(e.target.value)} />
        <button onClick={openNew} className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-black text-black hover:bg-cyan-400 transition whitespace-nowrap">+ Nova</button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-800/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-[#070f1e]">
              <Th>Máquina</Th><Th>Fator Vc</Th><Th>Fator fn</Th><Th>Estabilidade (%)</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(([name, m]) => (
              <tr key={name} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition">
                <td className="px-3 py-2.5 font-bold text-white">{name}</td>
                <td className="px-3 py-2.5 font-mono text-cyan-300">{m.vc}</td>
                <td className="px-3 py-2.5 font-mono text-cyan-300">{m.fn}</td>
                <td className="px-3 py-2.5"><RiskBar value={m.stability} /></td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1 justify-end">
                    <ActionBtn onClick={() => openEdit(name)} color="blue">Editar</ActionBtn>
                    <ActionBtn onClick={() => del(name)} color="red">Del</ActionBtn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="py-8 text-center text-slate-600 text-sm">Nenhuma máquina encontrada.</p>}
      </div>

      {editing && (
        <Modal title={isNew ? "Nova Máquina" : `Editar: ${editing.name}`} onClose={() => setEditing(null)}>
          <div className="space-y-3">
            <FormField label="Nome da máquina">
              <input className={inputCls} value={editing.name} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} disabled={!isNew} />
            </FormField>
            <div className="grid grid-cols-3 gap-3">
              <FormField label="Fator Vc"><input className={inputCls} type="number" step="0.01" value={editing.vc} onChange={e => setEditing(p => ({ ...p, vc: e.target.value }))} /></FormField>
              <FormField label="Fator fn"><input className={inputCls} type="number" step="0.01" value={editing.fn} onChange={e => setEditing(p => ({ ...p, fn: e.target.value }))} /></FormField>
              <FormField label="Estabilidade"><input className={inputCls} type="number" min="0" max="100" value={editing.stability} onChange={e => setEditing(p => ({ ...p, stability: e.target.value }))} /></FormField>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={save} className="flex-1 rounded-xl bg-cyan-500 py-2.5 text-sm font-black text-black hover:bg-cyan-400 transition">Salvar</button>
              <button onClick={() => setEditing(null)} className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm font-bold text-slate-300 hover:bg-slate-700 transition">Cancelar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ExportSection({ config, onImport, onReset }) {
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");

  const exportJson = () => {
    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "exaltt-config.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importText);
      onImport(parsed);
      setImportText("");
      setImportError("");
    } catch {
      setImportError("JSON inválido. Verifique o formato e tente novamente.");
    }
  };

  const copyJson = () => {
    navigator.clipboard?.writeText(JSON.stringify(config, null, 2));
  };

  return (
    <div className="space-y-6">
      <SectionHeader icon="💾" title="Exportar / Importar" subtitle="Backup e restore da configuração completa" />

      <div className="grid gap-4 sm:grid-cols-3">
        <ActionCard icon="⬇️" title="Exportar JSON" desc="Baixe o arquivo de configuração completo" action="Download JSON" onClick={exportJson} color="cyan" />
        <ActionCard icon="📋" title="Copiar JSON" desc="Copie a configuração para a área de transferência" action="Copiar" onClick={copyJson} color="blue" />
        <ActionCard icon="🔄" title="Resetar padrão" desc="Restaurar todos os dados para os valores originais" action="Resetar" onClick={onReset} color="red" />
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-[#070f1e] p-4 space-y-3">
        <p className="text-[11px] font-black tracking-widest text-slate-400 uppercase">Importar configuração</p>
        <textarea
          className={inputCls + " h-36 font-mono text-xs resize-none"}
          placeholder='Cole aqui o JSON exportado anteriormente...'
          value={importText}
          onChange={e => { setImportText(e.target.value); setImportError(""); }}
        />
        {importError && <p className="text-xs text-red-400">{importError}</p>}
        <button onClick={handleImport} disabled={!importText.trim()}
          className="w-full rounded-xl bg-slate-700 py-2.5 text-sm font-black text-white hover:bg-slate-600 transition disabled:opacity-40 disabled:cursor-not-allowed">
          Importar
        </button>
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-[#070f1e] p-4">
        <p className="text-[11px] font-black tracking-widest text-slate-400 uppercase mb-3">Preview da configuração atual</p>
        <pre className="text-[10px] text-slate-400 font-mono overflow-auto max-h-48 leading-relaxed">
          {JSON.stringify(config, null, 2)}
        </pre>
      </div>
    </div>
  );
}

// ─── SMALL REUSABLE COMPONENTS ────────────────────────────────────────────────

function SectionHeader({ icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-3 pb-2 border-b border-slate-800/60">
      <span className="text-2xl">{icon}</span>
      <div>
        <h2 className="font-black text-white tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function SaveButton({ onClick }) {
  return (
    <button onClick={onClick} className="w-full rounded-xl bg-cyan-500 py-2.5 text-sm font-black text-black hover:bg-cyan-400 transition">
      Salvar alterações
    </button>
  );
}

function Th({ children }) {
  return <th className="px-3 py-2.5 text-left text-[10px] font-black tracking-widest text-slate-500 uppercase">{children}</th>;
}

function ActionBtn({ onClick, color, children }) {
  const cls = color === "red"
    ? "bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/20"
    : "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-blue-500/20";
  return (
    <button onClick={onClick} className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition ${cls}`}>
      {children}
    </button>
  );
}

function RiskBar({ value }) {
  const color = value >= 97 ? "#10b981" : value >= 90 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-slate-800 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-xs font-mono" style={{ color }}>{value}%</span>
    </div>
  );
}

function ActionCard({ icon, title, desc, action, onClick, color }) {
  const cls = color === "red"
    ? "border-red-500/20 hover:border-red-500/40 hover:bg-red-500/5"
    : color === "cyan"
    ? "border-cyan-500/20 hover:border-cyan-500/40 hover:bg-cyan-500/5"
    : "border-blue-500/20 hover:border-blue-500/40 hover:bg-blue-500/5";
  const btnCls = color === "red"
    ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
    : color === "cyan"
    ? "bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25"
    : "bg-blue-500/15 text-blue-400 hover:bg-blue-500/25";
  return (
    <div className={`rounded-xl border bg-[#070f1e] p-4 transition cursor-pointer ${cls}`} onClick={onClick}>
      <div className="text-2xl mb-2">{icon}</div>
      <p className="font-bold text-white text-sm">{title}</p>
      <p className="text-xs text-slate-500 mt-1 mb-3">{desc}</p>
      <span className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-black transition ${btnCls}`}>{action}</span>
    </div>
  );
}

// ─── NAV ITEMS ────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "brand",      icon: "🏷️",  label: "Marca" },
  { id: "materials",  icon: "⚙️",  label: "Materiais" },
  { id: "iso",        icon: "📋",  label: "Classes ISO" },
  { id: "geometries", icon: "🔩",  label: "Geometrias" },
  { id: "depths",     icon: "📏",  label: "Profundidades" },
  { id: "machines",   icon: "🏭",  label: "Máquinas" },
  { id: "export",     icon: "💾",  label: "Export/Import" },
];

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function AdminPanel() {
  const [config, setConfig] = useState(() => {
    const saved = loadConfig();
    return saved || buildDefaultConfig();
  });
  const [activeTab, setActiveTab] = useState("brand");
  const [toast, setToast] = useState(null);
  const [navOpen, setNavOpen] = useState(false);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
  }, []);

  const persistAndUpdate = useCallback((newConfig) => {
    setConfig(newConfig);
    const ok = saveConfig(newConfig);
    showToast(ok ? "Configuração salva com sucesso." : "Erro ao salvar. Verifique o armazenamento.", ok ? "success" : "error");
  }, [showToast]);

  const updateSection = useCallback((section) => (value) => {
    persistAndUpdate({ ...config, [section]: value });
  }, [config, persistAndUpdate]);

  const handleReset = () => {
    if (window.confirm("Tem certeza que deseja restaurar os dados padrão? Todas as alterações serão perdidas.")) {
      const defaults = buildDefaultConfig();
      persistAndUpdate(defaults);
      showToast("Dados restaurados para o padrão.", "success");
    }
  };

  const handleImport = (imported) => {
    const merged = { ...buildDefaultConfig(), ...imported };
    persistAndUpdate(merged);
    showToast("Configuração importada com sucesso.", "success");
  };

  const statCounts = [
    { label: "Materiais", value: Object.keys(config.materials).length, color: "#3b82f6" },
    { label: "Máquinas", value: Object.keys(config.machines).length, color: "#10b981" },
    { label: "Geometrias", value: Object.keys(config.geometries).length, color: "#f59e0b" },
    { label: "Profundidades", value: Object.keys(config.depths).length, color: "#8b5cf6" },
  ];

  return (
    <div className="min-h-screen bg-[#040810] text-white" style={{ fontFamily: "'IBM Plex Mono', 'Courier New', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=Syne:wght@700;800;900&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; background: #040810; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #070f1e; }
        ::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 4px; }
        .syne { font-family: 'Syne', sans-serif !important; }
        .scanline {
          background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,200,255,0.015) 2px, rgba(0,200,255,0.015) 4px);
          pointer-events: none;
        }
      `}</style>

      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/60 bg-[#04080f]/90"
        style={{ backdropFilter: "blur(16px)" }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button className="sm:hidden text-slate-400 hover:text-white text-xl" onClick={() => setNavOpen(o => !o)}>☰</button>
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-[10px] font-black tracking-[0.2em] text-cyan-400 uppercase syne">EXALTT Admin</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 hidden sm:block">Painel de Configuração · {config.brand.company}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {statCounts.map(s => (
              <div key={s.label} className="hidden sm:flex flex-col items-center">
                <span className="text-lg font-black syne" style={{ color: s.color }}>{s.value}</span>
                <span className="text-[9px] text-slate-600 uppercase tracking-wider">{s.label}</span>
              </div>
            ))}
            <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-black text-emerald-400 tracking-wider">
              LOCAL STORAGE
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        {/* Sidebar */}
        <aside className={`fixed sm:sticky top-[53px] z-20 h-[calc(100vh-53px)] w-56 shrink-0 overflow-y-auto border-r border-slate-800/60 bg-[#04080f] transition-transform duration-200 sm:translate-x-0 ${navOpen ? "translate-x-0" : "-translate-x-full"}`}
          style={{ backdropFilter: "blur(12px)" }}>
          <div className="scanline absolute inset-0 pointer-events-none" />
          <nav className="p-3 space-y-0.5">
            <p className="px-3 py-2 text-[9px] font-black tracking-[0.25em] text-slate-600 uppercase">Configurações</p>
            {NAV_ITEMS.map(item => (
              <button key={item.id}
                onClick={() => { setActiveTab(item.id); setNavOpen(false); }}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${activeTab === item.id
                  ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-white border border-transparent"
                }`}>
                <span className="text-base">{item.icon}</span>
                <span className="font-bold">{item.label}</span>
                {activeTab === item.id && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-400" />}
              </button>
            ))}
          </nav>

          <div className="mx-3 mt-4 rounded-xl border border-slate-800/60 p-3 bg-[#070f1e]">
            <p className="text-[9px] font-black tracking-widest text-slate-600 uppercase mb-2">Contagem</p>
            {statCounts.map(s => (
              <div key={s.label} className="flex items-center justify-between py-1">
                <span className="text-[11px] text-slate-500">{s.label}</span>
                <span className="text-xs font-black" style={{ color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* Backdrop for mobile nav */}
        {navOpen && <div className="fixed inset-0 z-10 bg-black/60 sm:hidden" onClick={() => setNavOpen(false)} />}

        {/* Main content */}
        <main className="flex-1 min-w-0 p-4 sm:p-6">
          <div className="mx-auto max-w-4xl">
            {activeTab === "brand" && (
              <BrandSection brand={config.brand} onChange={updateSection("brand")} />
            )}
            {activeTab === "materials" && (
              <MaterialsSection materials={config.materials} isoClasses={config.isoClasses} onChange={updateSection("materials")} />
            )}
            {activeTab === "iso" && (
              <IsoClassesSection isoClasses={config.isoClasses} onChange={updateSection("isoClasses")} />
            )}
            {activeTab === "geometries" && (
              <GeometriesSection geometries={config.geometries} isoClasses={config.isoClasses} onChange={updateSection("geometries")} />
            )}
            {activeTab === "depths" && (
              <DepthsSection depths={config.depths} onChange={updateSection("depths")} />
            )}
            {activeTab === "machines" && (
              <MachinesSection machines={config.machines} onChange={updateSection("machines")} />
            )}
            {activeTab === "export" && (
              <ExportSection config={config} onImport={handleImport} onReset={handleReset} />
            )}
          </div>
        </main>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}