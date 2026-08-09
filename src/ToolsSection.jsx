/**
 * ToolsSection — Admin panel section for importing EXALTT tools from an XLSX file.
 *
 * The XLSX is a TopTools ERP export with the format shown in:
 *   Relatorio_lista_de_produtos_EXALTT_sample.xlsx
 *
 * Relevant columns (headers have trailing spaces — trimmed on read):
 *   [0] Codigo       — tool code, e.g. EX0300-03002-01
 *   [1] Descricao    — description, e.g. BRP MD 2C RI D3X16XD6X52L
 *   [4] Grupo        — product group
 *   [5] Preco Lista  — list price
 *   [12] Desc Grupo  — group description
 *   [16] Nome Empresa — company (always "TOP TOOLS" for EXALTT tools)
 *
 * EXALTT tools are identified by codes that start with "EX".
 * The ERP export may contain duplicate rows (one per Filial/branch) — deduped by code.
 *
 * Code format: EX0300-03002-01
 *   Segment 0: EX<model>    — "EX" prefix + 4-digit model number
 *   Segment 1: <diam><flutes>  — 4-digit diameter (÷100 = mm) + 1-digit flute count
 *   Segment 2: <revision>   — ignored for now
 *
 * Description format: BRP MD 2C RI D3X16XD6X52L
 *   D<n>       — nominal diameter in mm
 *   XD<n>      — depth-to-diameter ratio (XD6 = 6xD)
 *   <n>C       — number of cutting edges
 *   RI / RE    — internal / external coolant
 *   X<n>L      — total length in mm
 */

import { useState, useRef, useCallback } from "react";
import { useAuth } from "./AuthContext.jsx";
import * as XLSX from "xlsx";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

// ─── CODE PARSER ─────────────────────────────────────────────────────────────
// Format: EX0300-03002-01
const CODE_RE = /^(EX[A-Z0-9]{2})([A-Z0-9]{2})-(\d{3})(\d{2})-([A-Z0-9]+)$/i;

function parseToolCode(rawCode) {
  const code = rawCode.trim().toUpperCase();
  const m = CODE_RE.exec(code);
  if (!m) return null;

  const [, series, material, diamRaw, depthRatio] = m;
  const diameter = Number(diamRaw) / 10;
  const depth = `${Number(depthRatio)}xD`;

  return { code, series, material, diameter, depth };
}

// ─── DESCRIPTION PARSER ──────────────────────────────────────────────────────
// Format: BRP MD 2C RI D3X16XD6X52L
function parseDescription(desc) {
  const s = (desc ?? "").toUpperCase();

  const shankDiamMatch = s.match(/XD(\d+)X?/);
  const lengthMatch = s.match(/X(\d+)L/);

  const coolant = /\bRI\b/.test(s)
    ? "internal"
    : /\bRE\b/.test(s)
      ? "external"
      : "none";

  return {
    shankDiam: shankDiamMatch ? Number(shankDiamMatch[1]) : null,
    totalLength: lengthMatch ? Number(lengthMatch[1]) : null,
    coolant,
  };
}

// ─── XLSX COLUMN INDICES (from the real ERP export) ──────────────────────────
const COL = {
  code: 0, // Codigo
  desc: 1, // Descricao
  listPrice: 5, // Preco Lista
};

// ─── ASYNC XLSX PARSER ───────────────────────────────────────────────────────
// SheetJS reads the whole file synchronously, but we process rows in async
// chunks so the progress bar updates and the UI stays responsive.

const CHUNK_SIZE = 500;

async function parseXLSXAsync(file, onProgress) {
  // 1. Read the file as an ArrayBuffer
  const buffer = await file.arrayBuffer();

  // 2. Parse with SheetJS — dense mode gives us a flat array per row
  const wb = XLSX.read(buffer, { type: "array", dense: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  if (rows.length < 2) throw new Error("Arquivo vazio ou sem dados.");

  // 3. Skip header row; collect data rows
  const dataRows = rows.slice(1);
  const total = dataRows.length;
  const seenCodes = new Set();
  const tools = [];
  let processed = 0;

  for (let i = 0; i < dataRows.length; i += CHUNK_SIZE) {
    const chunk = dataRows.slice(i, i + CHUNK_SIZE);

    for (const row of chunk) {
      const rawCode = String(row[COL.code] ?? "").trim();
      processed++;

      // Filter: must start with "EX"
      if (!rawCode.toUpperCase().startsWith("EX")) continue;

      // Deduplicate: ERP exports the same product once per Filial (branch)
      const normCode = rawCode.toUpperCase();
      if (seenCodes.has(normCode)) continue;
      seenCodes.add(normCode);

      // Parse the code
      const parsed = parseToolCode(rawCode);
      if (!parsed) {
        console.log(`Failed to parse ${rawCode}`);
        continue;
      }

      // Parse the description for richer properties
      const rawDesc = String(row[COL.desc] ?? "").trim();
      const fromDesc = parseDescription(rawDesc);

      tools.push({
        code: parsed.code,
        series: parsed.series,
        diameter: parsed.diameter,
        material: parsed.material,
        depthRatio: parsed.depth ?? "—",
        totalLength: fromDesc.totalLength ?? null,
        coolant: fromDesc.coolant,
        description: rawDesc,
        listPrice: String(row[COL.listPrice] ?? "").trim(),
      });
    }

    onProgress(Math.min(99, Math.round((processed / total) * 100)));
    await new Promise((r) => setTimeout(r, 0));
  }

  onProgress(100);
  return { tools, totalRows: total };
}

// ─── UI HELPERS ──────────────────────────────────────────────────────────────
const COOLANT_LABELS = {
  internal: "Interna",
  external: "Externa",
  none: "Sem refrigeração",
};
const COOLANT_COLORS = {
  internal: "#3b82f6",
  external: "#10b981",
  none: "#475569",
};

function CoolantBadge({ coolant }) {
  const color = COOLANT_COLORS[coolant] ?? COOLANT_COLORS.none;
  const label = COOLANT_LABELS[coolant] ?? "—";
  return (
    <span
      style={{
        background: color + "22",
        color,
        border: `1px solid ${color}55`,
      }}
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black tracking-wider"
    >
      {label}
    </span>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function ToolsSection() {
  const { token } = useAuth();

  const [phase, setPhase] = useState("idle"); // idle|parsing|done|saving|saved
  const [progress, setProgress] = useState(0);
  const [parseError, setParseError] = useState("");
  const [fileName, setFileName] = useState("");
  const [rawCount, setRawCount] = useState(0);
  const [tools, setTools] = useState([]);

  const [search, setSearch] = useState("");
  const [filterDepth, setFilterDepth] = useState("ALL");
  const [filterCoolant, setFilterCoolant] = useState("ALL");
  const [filterMaterial, setFilterMaterial] = useState("ALL");
  const [sortField, setSortField] = useState("diameter");
  const [sortDir, setSortDir] = useState("asc");

  const [saveError, setSaveError] = useState("");
  const [savedCount, setSavedCount] = useState(0);

  const fileInputRef = useRef(null);

  const handleFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) {
      setParseError("Apenas arquivos .xlsx são suportados.");
      return;
    }

    setFileName(file.name);
    setPhase("parsing");
    setProgress(0);
    setParseError("");
    setTools([]);
    setRawCount(0);
    setSaveError("");

    try {
      const { tools: parsed, totalRows } = await parseXLSXAsync(
        file,
        setProgress,
      );
      setRawCount(totalRows);
      setTools(parsed);
      setPhase("done");
    } catch (err) {
      setParseError(err.message ?? "Erro ao processar o arquivo.");
      setPhase("idle");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleSave = async () => {
    if (!tools.length) return;
    setPhase("saving");
    setSaveError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/tools`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ tools }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const { count } = await res.json();
      setSavedCount(count ?? tools.length);
      setPhase("saved");
    } catch (err) {
      setSaveError(err.message);
      setPhase("done");
    }
  };

  const handleReset = () => {
    setPhase("idle");
    setTools([]);
    setFileName("");
    setRawCount(0);
    setProgress(0);
    setParseError("");
    setSaveError("");
    setSavedCount(0);
    setSearch("");
    setFilterDepth("ALL");
    setFilterCoolant("ALL");
    setFilterMaterial("ALL");
  };

  // Derived filter options
  const depthOptions = [
    ...new Set(tools.map((t) => t.depthRatio).filter((d) => d && d !== "—")),
  ].sort((a, b) => {
    return Number(a) - Number(b);
  });
  const materialOptions = [...new Set(tools.map((t) => t.material))].sort(
    (a, b) => {
      return Number(a) - Number(b);
    },
  );
  const coolantOptions = [...new Set(tools.map((t) => t.coolant))].sort();

  const filtered = tools.filter((t) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      t.code.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q);
    const matchDepth = filterDepth === "ALL" || t.depthRatio === filterDepth;
    const matchCoolant = filterCoolant === "ALL" || t.coolant === filterCoolant;
    const matchMaterial =
      filterMaterial === "ALL" || t.material === filterMaterial;
    return matchSearch && matchDepth && matchCoolant && matchMaterial;
  });

  const sorted = [...filtered].sort((a, b) => {
    let av = a[sortField] ?? "",
      bv = b[sortField] ?? "";
    if (typeof av === "number" && typeof bv === "number")
      return sortDir === "asc" ? av - bv : bv - av;
    return sortDir === "asc"
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av));
  });

  const toggleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortTh = ({ field, children }) => (
    <th
      onClick={() => toggleSort(field)}
      className="px-3 py-2.5 text-left text-[10px] font-black tracking-widest text-slate-500 uppercase cursor-pointer hover:text-slate-300 transition select-none whitespace-nowrap"
    >
      {children}
      {sortField === field ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
    </th>
  );

  const inputCls =
    "w-full rounded-xl border border-slate-700/60 bg-[#070f1e] px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/10 placeholder:text-slate-600";
  const isActive = phase !== "idle";
  const formatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    trailingZero: "stripIfInteger",
  });

  return (
    <div className="space-y-5">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pb-2 border-b border-slate-800/60">
        <span className="text-2xl">🔧</span>
        <div className="flex-1 min-w-0">
          <h2 className="font-black text-white tracking-tight">
            Ferramentas EXALTT
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Importe o relatório XLSX do ERP. Apenas ferramentas com código{" "}
            <code className="text-cyan-400 font-mono">EX…</code> são importadas.
            Duplicatas por filial são removidas automaticamente.
          </p>
        </div>
        {isActive && (
          <button
            onClick={handleReset}
            className="shrink-0 rounded-xl border border-slate-700/60 bg-slate-800/60 px-3 py-1.5 text-xs font-black text-slate-300 hover:bg-slate-700 transition"
          >
            Nova importação
          </button>
        )}
      </div>

      {/* ── UPLOAD ZONE ───────────────────────────────────────────────────── */}
      {!isActive && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={handleFile}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-2xl border-2 border-dashed border-slate-700/60 bg-[#070f1e] px-6 py-12 text-center transition hover:border-cyan-500/40 hover:bg-cyan-500/5 group"
          >
            <div className="text-4xl mb-3">📂</div>
            <p className="font-black text-white group-hover:text-cyan-300 transition">
              Clique para selecionar o arquivo XLSX
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Relatório ERP —{" "}
              <span className="font-mono">
                Relatorio_lista_de_produtos_EXALTT.xlsx
              </span>
              <br />
              Arquivos grandes são processados de forma assíncrona.
            </p>
          </button>
          {parseError && (
            <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400">
              {parseError}
            </p>
          )}
        </div>
      )}

      {/* ── PARSING PROGRESS ──────────────────────────────────────────────── */}
      {phase === "parsing" && (
        <div className="rounded-2xl border border-slate-800 bg-[#070f1e] p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin shrink-0" />
            <div>
              <p className="font-black text-white">{fileName}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Lendo planilha e filtrando ferramentas EXALTT…
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-cyan-500 transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-right text-[11px] text-slate-500 font-mono">
              {progress}%
            </p>
          </div>
        </div>
      )}

      {/* ── RESULT ────────────────────────────────────────────────────────── */}
      {(phase === "done" || phase === "saving" || phase === "saved") && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0 rounded-xl border border-slate-800 bg-[#070f1e] px-4 py-3">
              <p className="text-xs text-slate-400 leading-relaxed">
                <span className="font-bold text-slate-200">{fileName}</span>
                {" · "}
                {rawCount.toLocaleString("pt-BR")} linhas no arquivo
                {" · "}
                <span className="text-cyan-300 font-black">
                  {tools.length.toLocaleString("pt-BR")} ferramentas EXALTT
                  únicas
                </span>
                {filtered.length !== tools.length && (
                  <>
                    {" "}
                    ·{" "}
                    <span className="text-amber-300 font-black">
                      {filtered.length.toLocaleString("pt-BR")}
                    </span>{" "}
                    exibidas
                  </>
                )}
              </p>
            </div>

            {phase === "saved" ? (
              <div className="shrink-0 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-black text-emerald-400">
                ✓ {savedCount.toLocaleString("pt-BR")} ferramentas salvas
              </div>
            ) : (
              <button
                onClick={handleSave}
                disabled={phase === "saving" || !tools.length}
                className="shrink-0 rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-black text-black hover:bg-cyan-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {phase === "saving"
                  ? "Salvando…"
                  : `Salvar ${tools.length.toLocaleString("pt-BR")} ferramentas`}
              </button>
            )}
          </div>

          {saveError && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-400">
              Erro ao salvar: {saveError}
            </p>
          )}

          {/* Filters */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className={inputCls + " flex-1"}
              placeholder="Buscar por código ou descrição…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className={inputCls + " sm:w-36"}
              value={filterDepth}
              onChange={(e) => setFilterDepth(e.target.value)}
            >
              <option value="ALL">Todos L/D</option>
              {depthOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select
              className={inputCls + " sm:w-56"}
              value={filterCoolant}
              onChange={(e) => setFilterCoolant(e.target.value)}
            >
              <option value="ALL">Todas refrigerações</option>
              {coolantOptions.map((c) => (
                <option key={c} value={c}>
                  {COOLANT_LABELS[c] ?? c}
                </option>
              ))}
            </select>
            <select
              className={inputCls + " sm:w-46"}
              value={filterMaterial}
              onChange={(e) => setFilterMaterial(e.target.value)}
            >
              <option value="ALL">Todos materiais</option>
              {materialOptions.map((d) => (
                <option key={d} value={d}>
                  {d == "00" ? "N/A" : d}
                </option>
              ))}
            </select>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-[#070f1e]">
                  <SortTh field="code">Código</SortTh>
                  <SortTh field="diameter">Ø (mm)</SortTh>
                  <SortTh field="material">Material</SortTh>
                  <SortTh field="depthRatio">L/D</SortTh>
                  <SortTh field="totalLength">Comp. (mm)</SortTh>
                  <th className="px-3 py-2.5 text-left text-[10px] font-black tracking-widest text-slate-500 uppercase">
                    Refrig.
                  </th>
                  <SortTh field="listPrice">Preço</SortTh>
                </tr>
              </thead>
              <tbody>
                {sorted.slice(0, 500).map((t, i) => (
                  <tr
                    key={t.code + i}
                    className="border-b border-slate-800/40 hover:bg-slate-800/30 transition"
                  >
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <p className="font-bold text-cyan-300 font-mono text-xs">
                        {t.code}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                        {t.description}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-slate-200 font-mono">
                      {t.diameter.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-300 text-center">
                      {t.material == "00" ? "N/A" : t.material}
                    </td>
                    <td className="px-3 py-2.5 text-slate-300">
                      {t.depthRatio}
                    </td>
                    <td className="px-3 py-2.5 text-slate-400 font-mono">
                      {t.totalLength ?? "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <CoolantBadge coolant={t.coolant} />
                    </td>
                    <td className="px-3 py-2.5 text-slate-300 font-mono text-xs">
                      {formatter.format(t.listPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sorted.length === 0 && (
              <p className="py-10 text-center text-slate-600 text-sm">
                Nenhuma ferramenta encontrada com esses filtros.
              </p>
            )}
            {sorted.length > 500 && (
              <p className="py-3 text-center text-xs text-slate-600">
                Mostrando 500 de {sorted.length.toLocaleString("pt-BR")}{" "}
                resultados. Use os filtros para refinar.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
