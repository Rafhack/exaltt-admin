import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "./AuthContext.jsx";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

// ─── TOOL SCHEMA ──────────────────────────────────────────────────────────────
// A parsed tool object. All fields are derived from the tool's name/code.
//
// {
//   code:        string   — original tool code (e.g. "HPC-12-5XD-P")
//   brand:       string   — "EXALTT" | "OTHER"
//   line:        string   — product line (e.g. "HPC", "SPC")
//   diameter:    number   — nominal diameter in mm
//   depthRatio:  string   — depth-to-diameter ratio (e.g. "5xD", "8xD")
//   isoClasses:  string[] — applicable ISO material classes (e.g. ["P", "M"])
//   coating:     string   — coating type if present (e.g. "TiAlN", "none")
//   coolant:     string   — "internal" | "external" | "none"
//   flutes:      number   — number of flutes (0 = unknown)
//   raw:         Object   — all original CSV columns, unmodified
// }

// ─── MOCK PARSER ──────────────────────────────────────────────────────────────
// This function stands in for the real CSV parser until the actual file format
// is known. It receives the raw CSV text and returns an array of raw row objects
// (one per line, keyed by header), then maps each to a structured tool object.
//
// REPLACE `parseRow` and `parseHeaders` with the real logic once the CSV spec
// is available. Everything else (chunking, filtering, progress) stays the same.

const EXALTT_BRANDS = ["EXALTT", "HPC", "SPC", "XTA", "XTH", "XTS", "XTL"];
const DEPTH_RATIO_RE = /(\d+)\s*[xX×]\s*[dD]/;
const DIAMETER_RE = /[_\-\s](\d+(?:[.,]\d+)?)\s*(?:mm)?(?:[_\-\s]|$)/;
const FLUTES_RE = /(\d+)\s*FL/i;
const ISO_CLASS_RE = /\b([PMKNS H]{1})\b/g;
const COATING_KEYWORDS = ["TiAlN", "TiCN", "TiN", "AlCrN", "DLC", "nACo"];
const COOLANT_KEYWORDS_INT = ["IK", "INT", "IC", "KH"];
const COOLANT_KEYWORDS_EXT = ["EXT", "EC"];

function isExalttTool(row, headers) {
  // Heuristic until we know the real CSV structure.
  // Tries common column names for brand/supplier/description.
  const brandCols = ["brand", "marca", "supplier", "fabricante", "fornecedor"];
  const descCols  = ["description", "descricao", "descricao_completa", "nome", "code", "codigo", "item"];

  for (const col of brandCols) {
    const val = (row[col] ?? row[col.toUpperCase()] ?? "").toString().toUpperCase();
    if (EXALTT_BRANDS.some(b => val.includes(b))) return true;
  }
  for (const col of descCols) {
    const val = (row[col] ?? row[col.toUpperCase()] ?? "").toString().toUpperCase();
    if (EXALTT_BRANDS.some(b => val.includes(b))) return true;
  }
  return false;
}

function deriveToolProperties(row, headers) {
  // Build a string to scan from the most descriptive columns available.
  const nameStr = [
    row["description"] ?? row["descricao"] ?? row["nome"] ?? row["DESCRICAO"] ?? "",
    row["code"] ?? row["codigo"] ?? row["item"] ?? row["CODIGO"] ?? "",
    row["part_number"] ?? row["partnumber"] ?? "",
  ].join(" ").toUpperCase();

  // Diameter
  const diam = DIAMETER_RE.exec(nameStr);
  const diameter = diam ? Number(diam[1].replace(",", ".")) : 0;

  // Depth ratio
  const dr = DEPTH_RATIO_RE.exec(nameStr);
  const depthRatio = dr ? `${dr[1]}xD` : "5xD";

  // ISO classes
  const isoMatches = new Set();
  let m;
  while ((m = ISO_CLASS_RE.exec(nameStr)) !== null) {
    if ("PMKNSH".includes(m[1])) isoMatches.add(m[1]);
  }
  const isoClasses = isoMatches.size > 0 ? [...isoMatches] : ["P"];

  // Coating
  const coating = COATING_KEYWORDS.find(c => nameStr.includes(c.toUpperCase())) ?? "none";

  // Coolant
  const coolant = COOLANT_KEYWORDS_INT.some(k => nameStr.includes(k))
    ? "internal"
    : COOLANT_KEYWORDS_EXT.some(k => nameStr.includes(k))
    ? "external"
    : "none";

  // Flutes
  const fl = FLUTES_RE.exec(nameStr);
  const flutes = fl ? Number(fl[1]) : 0;

  // Line/code — use description or code column, fallback to first non-empty value
  const code = (row["code"] ?? row["codigo"] ?? row["item"] ?? row["CODIGO"] ?? Object.values(row).find(v => v) ?? "UNKNOWN").toString().trim();
  const line = EXALTT_BRANDS.find(b => nameStr.includes(b)) ?? "HPC";

  return { code, brand: "EXALTT", line, diameter, depthRatio, isoClasses, coating, coolant, flutes, raw: row };
}

// Parse CSV text into array of { [header]: value } objects.
function parseHeaders(firstLine) {
  return firstLine.split(",").map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ""));
}

function parseRow(line, headers) {
  // Simple RFC-4180-style parser: handle quoted fields with commas.
  const values = [];
  let cur = "", inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && (i === 0 || line[i - 1] !== "\\")) {
      inQuote = !inQuote;
    } else if (ch === "," && !inQuote) {
      values.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  values.push(cur.trim());
  const row = {};
  headers.forEach((h, i) => { row[h] = (values[i] ?? "").replace(/^["']|["']$/g, ""); });
  return row;
}

// Async chunked parser — yields control back to the browser every CHUNK_SIZE rows
// so the UI stays responsive on massive files.
const CHUNK_SIZE = 200;

async function parseCSVAsync(text, onProgress) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = parseHeaders(lines[0]);
  const total = lines.length - 1;
  const allTools = [];
  let processed = 0;

  for (let i = 1; i < lines.length; i += CHUNK_SIZE) {
    const chunk = lines.slice(i, i + CHUNK_SIZE);
    for (const line of chunk) {
      if (!line.trim()) continue;
      const row = parseRow(line, headers);
      if (isExalttTool(row, headers)) {
        allTools.push(deriveToolProperties(row, headers));
      }
      processed++;
    }
    onProgress(Math.min(100, Math.round((processed / total) * 100)));
    // Yield to the browser event loop between chunks
    await new Promise(r => setTimeout(r, 0));
  }

  return allTools;
}

// ─── ISO COLOR MAP ────────────────────────────────────────────────────────────
const ISO_COLORS = { P: "#3b82f6", M: "#8b5cf6", K: "#f59e0b", N: "#10b981", S: "#ef4444", H: "#ec4899" };
function IsoBadge({ iso }) {
  const color = ISO_COLORS[iso] ?? "#64748b";
  return (
    <span style={{ background: color + "22", color, border: `1px solid ${color}55` }}
      className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-black">
      {iso}
    </span>
  );
}

// ─── TOOLS SECTION ────────────────────────────────────────────────────────────
export default function ToolsSection() {
  const { token } = useAuth();

  // Upload + parsing state
  const [phase, setPhase]         = useState("idle"); // idle | parsing | done | saving | saved
  const [progress, setProgress]   = useState(0);
  const [parseError, setParseError] = useState("");
  const [fileName, setFileName]   = useState("");
  const [rawCount, setRawCount]   = useState(0);   // total CSV rows before filtering
  const [tools, setTools]         = useState([]);   // parsed EXALTT tools

  // Table state
  const [search, setSearch]       = useState("");
  const [filterIso, setFilterIso] = useState("ALL");
  const [filterLine, setFilterLine] = useState("ALL");
  const [sortField, setSortField] = useState("diameter");
  const [sortDir, setSortDir]     = useState("asc");

  // Save state
  const [saveError, setSaveError] = useState("");
  const [savedCount, setSavedCount] = useState(0);

  const fileInputRef = useRef(null);

  const handleFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.match(/\.csv$/i)) {
      setParseError("Apenas arquivos .csv são suportados.");
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
      const text = await file.text();
      const lineCount = text.split(/\r?\n/).filter(l => l.trim()).length - 1;
      setRawCount(lineCount);

      const parsed = await parseCSVAsync(text, setProgress);

      setTools(parsed);
      setPhase("done");
    } catch (err) {
      setParseError(err.message ?? "Erro ao processar o arquivo.");
      setPhase("idle");
    }

    // Reset the file input so the same file can be re-uploaded if needed
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
      setPhase("done"); // let them retry
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
    setFilterIso("ALL");
    setFilterLine("ALL");
  };

  // Derived table data
  const lines = [...new Set(tools.map(t => t.line))].sort();
  const isoOptions = [...new Set(tools.flatMap(t => t.isoClasses))].sort();

  const filtered = tools.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !q || t.code.toLowerCase().includes(q) || t.line.toLowerCase().includes(q);
    const matchIso = filterIso === "ALL" || t.isoClasses.includes(filterIso);
    const matchLine = filterLine === "ALL" || t.line === filterLine;
    return matchSearch && matchIso && matchLine;
  });

  const sorted = [...filtered].sort((a, b) => {
    let av = a[sortField] ?? "", bv = b[sortField] ?? "";
    if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
    return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortTh = ({ field, children }) => (
    <th onClick={() => toggleSort(field)}
      className="px-3 py-2.5 text-left text-[10px] font-black tracking-widest text-slate-500 uppercase cursor-pointer hover:text-slate-300 transition select-none">
      {children} {sortField === field ? (sortDir === "asc" ? "↑" : "↓") : ""}
    </th>
  );

  const inputCls = "w-full rounded-xl border border-slate-700/60 bg-[#070f1e] px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/10 placeholder:text-slate-600";

  return (
    <div className="space-y-5">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pb-2 border-b border-slate-800/60">
        <span className="text-2xl">🔧</span>
        <div className="flex-1 min-w-0">
          <h2 className="font-black text-white tracking-tight">Ferramentas EXALTT</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Importe um CSV com o catálogo completo de ferramentas e salve apenas as EXALTT.
          </p>
        </div>
        {phase !== "idle" && (
          <button onClick={handleReset}
            className="shrink-0 rounded-xl border border-slate-700/60 bg-slate-800/60 px-3 py-1.5 text-xs font-black text-slate-300 hover:bg-slate-700 transition">
            Nova importação
          </button>
        )}
      </div>

      {/* ── UPLOAD ZONE ────────────────────────────────────────────────────── */}
      {phase === "idle" && (
        <div>
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          <button onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-2xl border-2 border-dashed border-slate-700/60 bg-[#070f1e] px-6 py-12 text-center transition hover:border-cyan-500/40 hover:bg-cyan-500/5 group">
            <div className="text-4xl mb-3">📂</div>
            <p className="font-black text-white group-hover:text-cyan-300 transition">
              Clique para selecionar o arquivo CSV
            </p>
            <p className="mt-1 text-xs text-slate-500">
              O arquivo pode ser grande — o processamento é feito de forma assíncrona para não travar a tela.
            </p>
          </button>
          {parseError && (
            <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-400">
              {parseError}
            </p>
          )}
        </div>
      )}

      {/* ── PARSING PROGRESS ───────────────────────────────────────────────── */}
      {phase === "parsing" && (
        <div className="rounded-2xl border border-slate-800 bg-[#070f1e] p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin shrink-0" />
            <div>
              <p className="font-black text-white">Processando {fileName}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {rawCount > 0 && `${rawCount.toLocaleString("pt-BR")} linhas detectadas · `}Filtrando ferramentas EXALTT…
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full rounded-full bg-cyan-500 transition-all duration-200"
                style={{ width: `${progress}%` }} />
            </div>
            <p className="text-right text-[11px] text-slate-500 font-mono">{progress}%</p>
          </div>
        </div>
      )}

      {/* ── RESULT SUMMARY & FILTERS ───────────────────────────────────────── */}
      {(phase === "done" || phase === "saving" || phase === "saved") && (
        <div className="space-y-4">

          {/* Summary bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0 rounded-xl border border-slate-800 bg-[#070f1e] px-4 py-3">
              <p className="text-xs text-slate-500">
                Arquivo: <span className="text-slate-300 font-bold">{fileName}</span>
                {" · "}
                Total de linhas: <span className="text-slate-300 font-bold">{rawCount.toLocaleString("pt-BR")}</span>
                {" · "}
                Ferramentas EXALTT encontradas:{" "}
                <span className="text-cyan-300 font-black">{tools.length.toLocaleString("pt-BR")}</span>
                {filtered.length !== tools.length && (
                  <> · Exibindo: <span className="text-amber-300 font-black">{filtered.length}</span></>
                )}
              </p>
            </div>

            {phase === "saved" ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-black text-emerald-400">
                ✓ {savedCount} ferramentas salvas
              </div>
            ) : (
              <button onClick={handleSave} disabled={phase === "saving" || !tools.length}
                className="shrink-0 rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-black text-black hover:bg-cyan-400 transition disabled:opacity-50 disabled:cursor-not-allowed">
                {phase === "saving" ? "Salvando…" : `Salvar ${tools.length.toLocaleString("pt-BR")} ferramentas`}
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
            <input className={inputCls + " flex-1"} placeholder="Buscar por código ou linha…"
              value={search} onChange={e => setSearch(e.target.value)} />
            <div className="flex gap-1 flex-wrap">
              {["ALL", ...isoOptions].map(iso => (
                <button key={iso} onClick={() => setFilterIso(iso)}
                  className={`rounded-lg px-3 py-2 text-[11px] font-black transition
                    ${filterIso === iso ? "bg-cyan-500 text-black" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>
                  {iso}
                </button>
              ))}
            </div>
            <select className={inputCls + " sm:w-40"} value={filterLine} onChange={e => setFilterLine(e.target.value)}>
              <option value="ALL">Todas as linhas</option>
              {lines.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-[#070f1e]">
                  <SortTh field="code">Código</SortTh>
                  <SortTh field="line">Linha</SortTh>
                  <SortTh field="diameter">Ø (mm)</SortTh>
                  <SortTh field="depthRatio">L/D</SortTh>
                  <th className="px-3 py-2.5 text-left text-[10px] font-black tracking-widest text-slate-500 uppercase">ISO</th>
                  <SortTh field="coolant">Refrig.</SortTh>
                  <SortTh field="coating">Coating</SortTh>
                  <SortTh field="flutes">Flutes</SortTh>
                </tr>
              </thead>
              <tbody>
                {sorted.slice(0, 500).map((t, i) => (
                  <tr key={t.code + i} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition">
                    <td className="px-3 py-2.5 font-bold text-cyan-300 font-mono text-xs">{t.code}</td>
                    <td className="px-3 py-2.5 text-slate-300">{t.line}</td>
                    <td className="px-3 py-2.5 text-slate-200 font-mono">{t.diameter || "—"}</td>
                    <td className="px-3 py-2.5 text-slate-300">{t.depthRatio}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1 flex-wrap">
                        {t.isoClasses.map(iso => <IsoBadge key={iso} iso={iso} />)}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-400 text-xs">{t.coolant}</td>
                    <td className="px-3 py-2.5 text-slate-400 text-xs">{t.coating}</td>
                    <td className="px-3 py-2.5 text-slate-400 text-xs">{t.flutes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sorted.length === 0 && (
              <p className="py-10 text-center text-slate-600 text-sm">Nenhuma ferramenta encontrada com esses filtros.</p>
            )}
            {sorted.length > 500 && (
              <p className="py-3 text-center text-xs text-slate-600">
                Mostrando 500 de {sorted.length.toLocaleString("pt-BR")} ferramentas. Use os filtros para refinar.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
