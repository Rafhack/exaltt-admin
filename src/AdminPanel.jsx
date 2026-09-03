import { useState, useEffect, useCallback, useRef } from "react";
import { repository, buildDefaultConfig } from "./data/index.js";
import { AuthProvider, useAuth } from "./AuthContext.jsx";
import { storage } from "./firebase.js";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import LoginScreen from "./LoginScreen.jsx";
import UsersSection from "./UsersSection.jsx";
import ToolsSection from "./ToolsSection.jsx";
import {
  STANDARD_DIAMETERS,
  normalizeFn,
  resolveFnTable,
  emptyFnTable,
} from "./data/fnTable.js";

// ─── STORAGE: see src/data/index.js ──────────────────────────────────────────

// ─── HELPERS ───────────────────────────────────────────────────────────────────
// Base palette for known ISO keys; extras cycle through extended colors
const ISO_COLOR_PALETTE = {
  P: "#3b82f6",
  M: "#8b5cf6",
  K: "#f59e0b",
  N: "#10b981",
  S: "#ef4444",
  H: "#ec4899",
};
const EXTRA_COLORS = [
  "#06b6d4",
  "#f97316",
  "#84cc16",
  "#a78bfa",
  "#fb7185",
  "#34d399",
];

function buildIsoMeta(isoClasses) {
  const keys = Object.keys(isoClasses);
  const extraKeys = keys.filter((k) => !ISO_COLOR_PALETTE[k]);
  const colors = Object.fromEntries(
    keys.map((k) => [
      k,
      ISO_COLOR_PALETTE[k] ||
        EXTRA_COLORS[extraKeys.indexOf(k) % EXTRA_COLORS.length] ||
        "#64748b",
    ]),
  );
  return { isoOptions: keys, isoColors: colors };
}

function IsoBadge({ iso, isoColors }) {
  const color =
    (isoColors && isoColors[iso]) || ISO_COLOR_PALETTE[iso] || "#64748b";
  return (
    <span
      style={{
        background: color + "22",
        color,
        border: `1px solid ${color}55`,
      }}
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-black tracking-wider"
    >
      {iso}
    </span>
  );
}

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2800);
    return () => clearTimeout(t);
  }, [onClose]);
  const colors =
    type === "success"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
      : "border-red-500/40 bg-red-500/10 text-red-200";
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border px-5 py-3 text-sm font-bold shadow-2xl ${colors}`}
      style={{ backdropFilter: "blur(12px)" }}
    >
      <span>{type === "success" ? "✓" : "✕"}</span>
      {message}
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ background: "rgba(4,8,20,0.82)", backdropFilter: "blur(6px)" }}
    >
      <div
        className={`w-full ${wide ? "max-w-3xl" : "max-w-lg"} rounded-2xl border border-slate-700/60 bg-[#0d1b2e] shadow-2xl max-h-[90vh] overflow-y-auto`}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4 sticky top-0 bg-[#0d1b2e]">
          <h3 className="font-black text-white tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── FIELD COMPONENTS ─────────────────────────────────────────────────────────
function FormField({ label, children, hint }) {
  const wrapRef = useRef(null);
  const textRef = useRef(null);
  const [overflowPx, setOverflowPx] = useState(0);

  useEffect(() => {
    const measure = () => {
      if (!wrapRef.current || !textRef.current) return;
      const diff = textRef.current.scrollWidth - wrapRef.current.clientWidth;
      setOverflowPx(diff > 0 ? diff : 0);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [label]);

  return (
    <label className="field-label block">
      <span
        ref={wrapRef}
        className="mb-1.5 block overflow-hidden whitespace-nowrap text-[11px] font-black tracking-widest text-slate-400 uppercase"
        style={{ "--field-label-overflow": `-${overflowPx}px` }}
      >
        <span
          ref={textRef}
          className={`field-label-inner inline-block ${overflowPx > 0 ? "field-label-scrollable" : ""}`}
        >
          {label}
        </span>
      </span>
      {children}
      {hint && <p className="mt-1 text-[10px] text-slate-600">{hint}</p>}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-slate-700/60 bg-[#070f1e] px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/10 placeholder:text-slate-600";

// ─── SECTIONS ─────────────────────────────────────────────────────────────────

function BrandSection({ brand, onChange }) {
  const normalizeBrand = (brand) => ({
    ...brand,
    logo1: brand.logo1 ?? {
      logoUrl: brand.logoUrl ?? "",
      logoStoragePath: brand.logoStoragePath ?? "",
    },
    logo2: brand.logo2 ?? {
      logoUrl: "",
      logoStoragePath: "",
    },
  });

  const [local, setLocal] = useState(() => normalizeBrand(brand));

  useEffect(() => {
    setLocal(normalizeBrand(brand));
  }, [brand]);

  const set = (k, v) => setLocal((p) => ({ ...p, [k]: v }));

  // ── Logo upload state ──────────────────────────────────────────────────────
  const [uploadProgress, setUploadProgress] = useState({
    logo1: null,
    logo2: null,
  });

  const [uploadError, setUploadError] = useState({
    logo1: "",
    logo2: "",
  });

  const [removing, setRemoving] = useState({
    logo1: false,
    logo2: false,
  });

  const fileInputRefs = {
    logo1: useRef(null),
    logo2: useRef(null),
  };

  // ── Image trimming ─────────────────────────────────────────────────────────
  const trimTransparentPixels = (file) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);

        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const ctx = canvas.getContext("2d", {
          willReadFrequently: true,
        });

        ctx.drawImage(img, 0, 0);

        const { width, height } = canvas;
        const imageData = ctx.getImageData(0, 0, width, height);
        const pixels = imageData.data;

        let minX = width;
        let minY = height;
        let maxX = -1;
        let maxY = -1;

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const alpha = pixels[(y * width + x) * 4 + 3];

            if (alpha > 0) {
              minX = Math.min(minX, x);
              minY = Math.min(minY, y);
              maxX = Math.max(maxX, x);
              maxY = Math.max(maxY, y);
            }
          }
        }

        // Completely transparent image
        if (maxX === -1) {
          resolve(file);
          return;
        }

        const trimmedCanvas = document.createElement("canvas");
        trimmedCanvas.width = maxX - minX + 1;
        trimmedCanvas.height = maxY - minY + 1;

        trimmedCanvas
          .getContext("2d")
          .drawImage(
            canvas,
            minX,
            minY,
            trimmedCanvas.width,
            trimmedCanvas.height,
            0,
            0,
            trimmedCanvas.width,
            trimmedCanvas.height,
          );

        trimmedCanvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Failed to trim image"));
            return;
          }

          resolve(
            new File([blob], file.name, {
              type: "image/png",
              lastModified: file.lastModified,
            }),
          );
        }, "image/png");
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Failed to load image"));
      };

      img.src = objectUrl;
    });

  // ── Logo upload ────────────────────────────────────────────────────────────
  const handleLogoChange = async (logoKey, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

    if (!allowed.includes(file.type)) {
      setUploadError((p) => ({
        ...p,
        [logoKey]: "Formato não suportado. Use PNG, JPG, SVG ou WebP.",
      }));
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setUploadError((p) => ({
        ...p,
        [logoKey]: "Arquivo muito grande. Máximo 2 MB.",
      }));
      return;
    }

    setUploadError((p) => ({
      ...p,
      [logoKey]: "",
    }));

    setUploadProgress((p) => ({
      ...p,
      [logoKey]: 0,
    }));

    try {
      // SVG is kept as SVG because rendering it through canvas would
      // rasterize it. Raster formats are trimmed and converted to PNG.
      const processedFile =
        file.type === "image/svg+xml"
          ? file
          : await trimTransparentPixels(file);

      const storageRef = ref(
        storage,
        `brand/${logoKey}_${Date.now()}_${processedFile.name}`,
      );

      const task = uploadBytesResumable(storageRef, processedFile);

      task.on(
        "state_changed",
        (snap) => {
          setUploadProgress((p) => ({
            ...p,
            [logoKey]: Math.round(
              (snap.bytesTransferred / snap.totalBytes) * 100,
            ),
          }));
        },
        (err) => {
          setUploadError((p) => ({
            ...p,
            [logoKey]: err.message,
          }));

          setUploadProgress((p) => ({
            ...p,
            [logoKey]: null,
          }));
        },
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);

          // Delete the old logo from storage if it was also uploaded by us.
          const oldLogo = local[logoKey];

          if (oldLogo?.logoStoragePath) {
            try {
              await deleteObject(ref(storage, oldLogo.logoStoragePath));
            } catch {}
          }

          const updated = {
            ...local,
            [logoKey]: {
              logoUrl: url,
              logoStoragePath: task.snapshot.ref.fullPath,
            },
          };

          setLocal(updated);
          onChange(updated);

          setUploadProgress((p) => ({
            ...p,
            [logoKey]: null,
          }));
        },
      );
    } catch (err) {
      setUploadError((p) => ({
        ...p,
        [logoKey]: err.message || "Erro ao processar imagem.",
      }));

      setUploadProgress((p) => ({
        ...p,
        [logoKey]: null,
      }));
    }
  };

  // ── Logo removal ────────────────────────────────────────────────────────────
  const handleRemoveLogo = async (logoKey) => {
    setRemoving((p) => ({
      ...p,
      [logoKey]: true,
    }));

    const logo = local[logoKey];

    if (logo?.logoStoragePath) {
      try {
        await deleteObject(ref(storage, logo.logoStoragePath));
      } catch {}
    }

    const updated = {
      ...local,
      [logoKey]: {
        logoUrl: "",
        logoStoragePath: "",
      },
    };

    setLocal(updated);
    onChange(updated);

    setRemoving((p) => ({
      ...p,
      [logoKey]: false,
    }));
  };

  const handleSave = () => onChange(local);

  const renderLogo = (logoKey, label) => {
    const logo = local[logoKey];
    const progress = uploadProgress[logoKey];
    const error = uploadError[logoKey];
    const isRemoving = removing[logoKey];

    return (
      <div className="flex-1 min-w-[260px] rounded-xl border border-slate-700/40 bg-[#070f1e] p-4 space-y-3">
        <p className="text-[11px] font-black tracking-widest text-slate-400 uppercase">
          {label}
        </p>

        <div className="flex flex-wrap items-center gap-4">
          {logo?.logoUrl ? (
            <div className="relative flex-shrink-0 bg-[#E3CE3D] rounded-xl">
              <img
                src={logo.logoUrl}
                alt={label}
                className="h-16 max-w-[160px] rounded-xl border border-slate-700/60 object-contain p-2"
                style={{ filter: "brightness(0)" }}
              />
            </div>
          ) : (
            <div className="flex h-16 w-32 flex-shrink-0 items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/40 text-xs text-slate-600">
              Sem logo
            </div>
          )}

          <div className="flex flex-shrink-0 flex-col gap-2">
            <input
              ref={fileInputRefs[logoKey]}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={(e) => handleLogoChange(logoKey, e)}
            />

            <button
              onClick={() => fileInputRefs[logoKey].current?.click()}
              disabled={progress !== null || isRemoving}
              className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-black text-cyan-400 hover:bg-cyan-500/20 transition disabled:opacity-50"
            >
              {progress !== null
                ? `Enviando… ${progress}%`
                : logo?.logoUrl
                  ? "Trocar logo"
                  : "Enviar logo"}
            </button>

            {logo?.logoUrl && (
              <button
                onClick={() => handleRemoveLogo(logoKey)}
                disabled={isRemoving || progress !== null}
                className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs font-black text-red-400 hover:bg-red-500/20 transition disabled:opacity-50"
              >
                {isRemoving ? "Removendo…" : "Remover logo"}
              </button>
            )}
          </div>
        </div>

        <div className="text-xs leading-relaxed text-slate-600">
          PNG, JPG, SVG ou WebP
          <br />
          Máximo 2 MB
          <br />
          Fundo transparente recomendado
        </div>

        {progress !== null && (
          <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-cyan-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        icon="🏷️"
        title="Identidade da Marca"
        subtitle="Nome, linha, produto e configurações de endpoint"
      />

      {/* Logos */}
      <div className="rounded-xl border border-slate-700/40 bg-[#070f1e] p-4 space-y-4">
        <p className="text-[11px] font-black tracking-widest text-slate-400 uppercase">
          Logotipos
        </p>

        <div className="flex flex-wrap gap-4">
          {renderLogo("logo1", "Logo 1")}
          {renderLogo("logo2", "Logo 2")}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Empresa">
          <input
            className={inputCls}
            value={local.company}
            onChange={(e) => set("company", e.target.value)}
          />
        </FormField>

        <FormField label="Linha">
          <input
            className={inputCls}
            value={local.line}
            onChange={(e) => set("line", e.target.value)}
          />
        </FormField>

        <FormField label="Produto">
          <input
            className={inputCls}
            value={local.product}
            onChange={(e) => set("product", e.target.value)}
          />
        </FormField>

        <FormField label="Modo">
          <input
            className={inputCls}
            value={local.mode}
            onChange={(e) => set("mode", e.target.value)}
          />
        </FormField>
      </div>

      <SaveButton onClick={handleSave} />
    </div>
  );
}

function FnTableEditor({ fn, onChange, materials, currentMaterialName }) {
  const normalized = normalizeFn(fn);

  const otherMaterials = Object.keys(materials)
    .filter((n) => n !== currentMaterialName)
    .sort();

  const setMode = (mode) => {
    if (mode === "table") {
      onChange({ mode: "table", table: emptyFnTable() });
    } else {
      onChange({
        mode: "proportion",
        proportionOf: otherMaterials[0] ?? "",
        proportionPct: 100,
      });
    }
  };

  const setTableValue = (diameter, value) => {
    const table = {
      ...normalized.table,
      [String(diameter)]: value === "" ? null : Number(value),
    };
    onChange({ mode: "table", table });
  };

  const setProportionOf = (name) =>
    onChange({ ...normalized, proportionOf: name });
  const setProportionPct = (pct) =>
    onChange({ ...normalized, proportionPct: pct === "" ? "" : Number(pct) });

  // Live preview of resolved values when in proportion mode
  const previewTable =
    normalized.mode === "proportion"
      ? resolveFnTable("__preview__", {
          ...materials,
          __preview__: { fn: normalized },
        })
      : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-black tracking-widest text-slate-400 uppercase">
          fn (mm/rev) por diâmetro
        </span>
        <div className="flex gap-1 rounded-lg border border-slate-700/60 p-0.5">
          <button
            type="button"
            onClick={() => setMode("table")}
            className={`rounded-md px-3 py-1 text-[11px] font-black transition ${normalized.mode === "table" ? "bg-cyan-500 text-black" : "text-slate-400 hover:text-white"}`}
          >
            Tabela
          </button>
          <button
            type="button"
            onClick={() => setMode("proportion")}
            className={`rounded-md px-3 py-1 text-[11px] font-black transition ${normalized.mode === "proportion" ? "bg-cyan-500 text-black" : "text-slate-400 hover:text-white"}`}
          >
            Proporção
          </button>
        </div>
      </div>

      {normalized.mode === "table" ? (
        <div className="overflow-x-auto rounded-xl border border-slate-700/40 bg-[#070f1e] p-3">
          <div className="flex gap-2 min-w-max">
            {STANDARD_DIAMETERS.map((d) => (
              <div
                key={d}
                className="flex flex-col items-center gap-1 w-20 flex-shrink-0"
              >
                <span className="text-[12px] font-black text-slate-400">
                  {d}mm
                </span>
                <input
                  type="number"
                  step="0.001"
                  placeholder="—"
                  className="w-full rounded-lg border border-slate-700/60 bg-[#0b1728] px-1.5 py-1.5 text-center text-xs text-white outline-none focus:border-cyan-500/60"
                  value={normalized.table[String(d)] ?? ""}
                  onChange={(e) => setTableValue(d, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-700/40 bg-[#070f1e] p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Material de referência">
              <select
                className={inputCls}
                value={normalized.proportionOf}
                onChange={(e) => setProportionOf(e.target.value)}
              >
                {otherMaterials.length === 0 && (
                  <option value="">Nenhum outro material cadastrado</option>
                )}
                {otherMaterials.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              label="Proporção (%)"
              hint="100% = valores idênticos ao material de referência"
            >
              <input
                className={inputCls}
                type="number"
                step="1"
                value={normalized.proportionPct}
                onChange={(e) => setProportionPct(e.target.value)}
              />
            </FormField>
          </div>
          {previewTable && (
            <div>
              <p className="text-[10px] font-black tracking-widest text-slate-500 uppercase mb-1.5">
                Prévia calculada
              </p>
              <div className="overflow-x-auto">
                <div className="flex gap-2 min-w-max">
                  {STANDARD_DIAMETERS.map((d) => (
                    <div
                      key={d}
                      className="flex flex-col items-center gap-1 w-16 flex-shrink-0"
                    >
                      <span className="text-[10px] font-black text-slate-500">
                        {d}mm
                      </span>
                      <div className="w-full rounded-lg border border-slate-800 bg-[#0b1728] px-1.5 py-1.5 text-center text-xs text-cyan-300 font-mono">
                        {previewTable[String(d)] ?? "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MaterialsSection({ materials, isoClasses, onChange }) {
  const { isoOptions, isoColors } = buildIsoMeta(isoClasses);
  const [search, setSearch] = useState("");
  const [filterIso, setFilterIso] = useState("ALL");
  const [editing, setEditing] = useState(null); // { name, ...fields } or null
  const [origName, setOrigName] = useState(null);
  const [isNew, setIsNew] = useState(false);

  const filtered = Object.entries(materials)
    .filter(([name, m]) => {
      const matchSearch =
        name.toLowerCase().includes(search.toLowerCase()) ||
        m.materialClass.toLowerCase().includes(search.toLowerCase());
      const matchIso = filterIso === "ALL" || m.iso === filterIso;
      return matchSearch && matchIso;
    })
    .sort((a, b) => {
      const aName = a[1].iso + a[1].materialClass;
      const bName = b[1].iso + b[1].materialClass;
      if (aName < bName) {
        return -1;
      }
      if (aName > bName) {
        return 1;
      }
      return 0;
    });

  const openNew = () => {
    setEditing({
      name: "",
      vc: 100,
      fn: { mode: "table", table: emptyFnTable() },
      life: 1000,
      iso: "P",
      materialClass: "",
    });
    setOrigName(null);
    setIsNew(true);
  };
  const openEdit = (name) => {
    setEditing({
      name,
      ...materials[name],
      fn: normalizeFn(materials[name].fn),
    });
    setOrigName(name);
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
    if (!isNew && origName) delete next[origName];
    next[name] = {
      vc: Number(fields.vc),
      fn: fields.fn,
      life: Number(fields.life),
      iso: fields.iso,
      materialClass: fields.materialClass,
    };
    onChange(next);
    setEditing(null);
  };

  // Helper for the table preview column — shows a representative fn value (8mm, the most common reference)
  const previewFn = (m) => {
    const table = resolveFnTable("__row__", { ...materials, __row__: m });
    return table["8"] ?? Object.values(table).find((v) => v != null) ?? "—";
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        icon="⚙️"
        title="Materiais"
        subtitle={`${Object.keys(materials).length} materiais cadastrados`}
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className={inputCls + " flex-1"}
          placeholder="Buscar material..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-1 flex-wrap">
          {["ALL", ...isoOptions].map((iso) => (
            <button
              key={iso}
              onClick={() => setFilterIso(iso)}
              className={`rounded-lg px-3 py-2 text-[11px] font-black transition ${filterIso === iso ? "bg-cyan-500 text-black" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
            >
              {iso}
            </button>
          ))}
        </div>
        <button
          onClick={openNew}
          className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-black text-black hover:bg-cyan-400 transition whitespace-nowrap"
        >
          + Novo
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-[#070f1e]">
              <Th>Material</Th>
              <Th>ISO</Th>
              <Th>Vc</Th>
              <Th>fn (8mm)</Th>
              <Th>Vida</Th>
              <Th>Classe</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(([name, m]) => (
              <tr
                key={name}
                className="border-b border-slate-800/40 hover:bg-slate-800/30 transition"
              >
                <td className="px-3 py-2.5 font-bold text-white">{name}</td>
                <td className="px-3 py-2.5">
                  <IsoBadge iso={m.iso} isoColors={isoColors} />
                </td>
                <td className="px-3 py-2.5 text-cyan-300 font-mono">{m.vc}</td>
                <td className="px-3 py-2.5 text-cyan-300 font-mono">
                  {previewFn(m)}
                  {normalizeFn(m.fn).mode === "proportion" && (
                    <span
                      className="ml-1.5 text-[9px] font-black text-amber-400 align-middle"
                      title={`Proporçaão de ${Number(m.fn.proportionPct).toFixed(3)}% de ${m.fn.proportionOf}`}
                    >
                      %
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-slate-300 font-mono">
                  {m.life}
                </td>
                <td
                  className="px-3 py-2.5 text-slate-400 text-xs max-w-[200px] truncate"
                  title={m.materialClass}
                >
                  {m.materialClass}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1 justify-end">
                    <ActionBtn onClick={() => openEdit(name)} color="blue">
                      Editar
                    </ActionBtn>
                    <ActionBtn onClick={() => deleteMat(name)} color="red">
                      Del
                    </ActionBtn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="py-8 text-center text-slate-600 text-sm">
            Nenhum material encontrado.
          </p>
        )}
      </div>

      {editing && (
        <Modal
          wide
          title={isNew ? "Novo Material" : `Editar: ${editing.name}`}
          onClose={() => setEditing(null)}
        >
          <div className="space-y-4">
            <FormField label="Nome do material">
              <input
                className={inputCls}
                value={editing.name}
                onChange={(e) =>
                  setEditing((p) => ({ ...p, name: e.target.value }))
                }
              />
            </FormField>
            <div className="grid grid-cols-3 gap-3">
              <FormField label="Vc (m/min)">
                <input
                  className={inputCls}
                  type="number"
                  value={editing.vc}
                  onChange={(e) =>
                    setEditing((p) => ({ ...p, vc: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="Vida útil (furos)">
                <input
                  className={inputCls}
                  type="number"
                  value={editing.life}
                  onChange={(e) =>
                    setEditing((p) => ({ ...p, life: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="Classe ISO">
                <select
                  className={inputCls}
                  value={editing.iso}
                  onChange={(e) =>
                    setEditing((p) => ({ ...p, iso: e.target.value }))
                  }
                >
                  {isoOptions.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </FormField>
            </div>

            <FnTableEditor
              fn={editing.fn}
              onChange={(fn) => setEditing((p) => ({ ...p, fn }))}
              materials={materials}
              currentMaterialName={origName}
            />
            <FormField label="Classe do material">
              <input
                className={inputCls}
                value={editing.materialClass}
                onChange={(e) =>
                  setEditing((p) => ({ ...p, materialClass: e.target.value }))
                }
              />
            </FormField>
            <div className="flex gap-2 pt-2">
              <button
                onClick={save}
                className="flex-1 rounded-xl bg-cyan-500 py-2.5 text-sm font-black text-black hover:bg-cyan-400 transition"
              >
                Salvar
              </button>
              <button
                onClick={() => setEditing(null)}
                className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm font-bold text-slate-300 hover:bg-slate-700 transition"
              >
                Cancelar
              </button>
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
    setLocal((p) => ({ ...p, [key]: newLabel.trim() }));
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
      <SectionHeader
        icon="📋"
        title="Classes ISO"
        subtitle="Descrições das classes de materiais ISO"
      />
      <div className="space-y-3">
        {Object.entries(local).map(([key, label]) => (
          <div key={key} className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-black text-sm"
              style={{
                background: (isoColors[key] || "#64748b") + "22",
                color: isoColors[key] || "#64748b",
                border: `1px solid ${isoColors[key] || "#64748b"}44`,
              }}
            >
              {key}
            </div>
            <input
              className={inputCls}
              value={label}
              onChange={(e) =>
                setLocal((p) => ({ ...p, [key]: e.target.value }))
              }
            />
            <button
              onClick={() => deleteEntry(key)}
              className="shrink-0 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-[11px] font-bold text-red-400 hover:bg-red-500/20 transition"
            >
              Del
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-[#070f1e] p-4 space-y-3">
        <p className="text-[11px] font-black tracking-widest text-slate-400 uppercase">
          Nova classe ISO
        </p>
        <div className="flex gap-2">
          <input
            className={inputCls + " flex-1"}
            placeholder="Descrição da classe..."
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
          <input
            className={inputCls + " w-20 text-center font-black uppercase"}
            placeholder="Ex: Q"
            maxLength={4}
            value={newKey}
            onChange={(e) => setNewKey(e.target.value.toUpperCase())}
          />
          <button
            onClick={addEntry}
            disabled={!newKey.trim() || !newLabel.trim()}
            className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-black text-black hover:bg-cyan-400 transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
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
    setEditing({
      code: "",
      name: "",
      application: "",
      iso: [],
      materialCode: "",
      coating: "",
    });
    setIsNew(true);
  };
  const save = () => {
    if (!editing.code.trim()) return;
    const next = {
      ...geometries,
      [editing.code]: {
        code: editing.code,
        name: editing.name,
        application: editing.application,
        iso: editing.iso,
        materialCode: (editing.materialCode ?? "").trim().toUpperCase(),
        coating: (editing.coating ?? "").trim().toUpperCase(),
      },
    };
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
      <SectionHeader
        icon="🔩"
        title="Geometrias EXALTT"
        subtitle="Códigos de geometria e suas aplicações"
      />
      <div className="flex justify-end">
        <button
          onClick={openNew}
          className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-black text-black hover:bg-cyan-400 transition"
        >
          + Nova geometria
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.values(geometries).map((g) => (
          <div
            key={g.code}
            className="rounded-xl border border-slate-700/50 bg-[#070f1e] p-4 space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-black text-cyan-300 text-lg">
                  {g.code}
                </span>
                <p className="text-sm font-bold text-white mt-0.5">{g.name}</p>
              </div>
              <div className="flex gap-1">
                <ActionBtn
                  onClick={() => {
                    setEditing({ ...g, iso: [...g.iso] });
                    setIsNew(false);
                  }}
                  color="blue"
                >
                  Editar
                </ActionBtn>
                <ActionBtn onClick={() => del(g.code)} color="red">
                  Del
                </ActionBtn>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {g.application}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {g.iso.map((i) => (
                <IsoBadge key={i} iso={i} isoColors={isoColors} />
              ))}
              /
              {g.materialCode && (
                <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-black text-amber-300">
                  {g.materialCode}
                </span>
              )}
              {g.coating && (
                <span className="rounded-full bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 text-[10px] font-black text-purple-300">
                  Rev: {g.coating}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <Modal
          title={isNew ? "Nova Geometria" : `Editar: ${editing.code}`}
          onClose={() => setEditing(null)}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Código">
                <input
                  className={inputCls}
                  value={editing.code}
                  onChange={(e) =>
                    setEditing((p) => ({ ...p, code: e.target.value }))
                  }
                  disabled={!isNew}
                />
              </FormField>
              <FormField label="Nome">
                <input
                  className={inputCls}
                  value={editing.name}
                  onChange={(e) =>
                    setEditing((p) => ({ ...p, name: e.target.value }))
                  }
                />
              </FormField>
            </div>
            <FormField label="Aplicação">
              <textarea
                className={inputCls + " resize-none h-20"}
                value={editing.application}
                onChange={(e) =>
                  setEditing((p) => ({ ...p, application: e.target.value }))
                }
              />
            </FormField>
            <FormField label="Classes ISO aplicáveis">
              <div className="flex flex-wrap gap-2 mt-1">
                {isoOptions.map((iso) => (
                  <button
                    key={iso}
                    type="button"
                    onClick={() =>
                      setEditing((p) => ({
                        ...p,
                        iso: p.iso.includes(iso)
                          ? p.iso.filter((x) => x !== iso)
                          : [...p.iso, iso],
                      }))
                    }
                    className={`rounded-lg px-3 py-1.5 text-xs font-black transition`}
                    style={
                      editing.iso.includes(iso)
                        ? {
                            background: (isoColors[iso] || "#64748b") + "33",
                            color: isoColors[iso] || "#64748b",
                            border: `1px solid ${isoColors[iso] || "#64748b"}66`,
                          }
                        : {
                            background: "#1e293b",
                            color: "#64748b",
                            border: "1px solid #334155",
                          }
                    }
                  >
                    {iso}
                  </button>
                ))}
              </div>
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Código de material"
                hint="2 letras no código (ex: ST, AL)"
              >
                <select
                  className={inputCls}
                  value={editing.materialCode ?? ""}
                  onChange={(e) =>
                    setEditing((p) => ({ ...p, materialCode: e.target.value }))
                  }
                >
                  <option value="">— Não mapeado —</option>
                  <option value="ST">ST</option>
                  <option value="AL">AL</option>
                  <option value="CT">CT</option>
                  <option value="TN">TN</option>
                  <option value="DT">DT</option>
                  <option value="GN">GN</option>
                  <option value="GR">GR</option>
                  <option value="PL">PL</option>
                </select>
              </FormField>

              <FormField
                label="Revestimento / Revisão"
                hint="Ex: 00, 01, A, etc."
              >
                <input
                  className={inputCls}
                  value={editing.coating ?? ""}
                  maxLength={2}
                  onChange={(e) =>
                    setEditing((p) => ({ ...p, coating: e.target.value }))
                  }
                />
              </FormField>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={save}
                className="flex-1 rounded-xl bg-cyan-500 py-2.5 text-sm font-black text-black hover:bg-cyan-400 transition"
              >
                Salvar
              </button>
              <button
                onClick={() => setEditing(null)}
                className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm font-bold text-slate-300 hover:bg-slate-700 transition"
              >
                Cancelar
              </button>
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
    setEditing({ key: "", vc: 1.0, fn: 1.0, life: 1.0, limiter: 1, risk: 95 });
    setIsNew(true);
  };
  const save = () => {
    if (!editing.key.trim()) return;
    const { key, ...fields } = editing;
    const next = {
      ...depths,
      [key]: {
        vc: Number(fields.vc),
        fn: Number(fields.fn),
        life: Number(fields.life),
        limiter: Number(fields.limiter),
        risk: Number(fields.risk),
      },
    };
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
      <SectionHeader
        icon="📏"
        title="Fatores de Profundidade"
        subtitle="Multiplicadores por relação L/D"
      />
      <div className="flex justify-end">
        <button
          onClick={openNew}
          className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-black text-black hover:bg-cyan-400 transition"
        >
          + Nova profundidade
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-800/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-[#070f1e]">
              <Th>Relação L/D</Th>
              <Th>Fator Vc</Th>
              <Th>Fator fn</Th>
              <Th>Fator Vida</Th>
              <Th>Fator Limitador</Th>
              <Th>Risco (%)</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(depths).map(([key, d]) => (
              <tr
                key={key}
                className="border-b border-slate-800/40 hover:bg-slate-800/30 transition"
              >
                <td className="px-3 py-2.5 font-black text-cyan-300">{key}</td>
                <td className="px-3 py-2.5 font-mono text-slate-200">{d.vc}</td>
                <td className="px-3 py-2.5 font-mono text-slate-200">{d.fn}</td>
                <td className="px-3 py-2.5 font-mono text-slate-200">
                  {d.life}
                </td>
                <td className="px-3 py-2.5 font-mono text-slate-200">
                  {d.limiter}
                </td>
                <td className="px-3 py-2.5">
                  <RiskBar value={d.risk} />
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1 justify-end">
                    <ActionBtn
                      onClick={() => {
                        setEditing({ key, ...d });
                        setIsNew(false);
                      }}
                      color="blue"
                    >
                      Editar
                    </ActionBtn>
                    <ActionBtn onClick={() => del(key)} color="red">
                      Del
                    </ActionBtn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal
          title={isNew ? "Nova Profundidade" : `Editar: ${editing.key}`}
          onClose={() => setEditing(null)}
        >
          <div className="space-y-3">
            <FormField label="Relação L/D (ex: 5xD)">
              <input
                className={inputCls}
                value={editing.key}
                onChange={(e) => {
                  const inferredLimit = Number(
                    e.target.value.toLowerCase().split("x")[0],
                  );
                  return setEditing((p) => ({
                    ...p,
                    key: e.target.value,
                    limiter:
                      Number.isFinite(inferredLimit) && inferredLimit >= 0
                        ? inferredLimit
                        : p.limiter,
                  }));
                }}
                disabled={!isNew}
              />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Fator Vc">
                <input
                  className={inputCls}
                  type="number"
                  step="0.01"
                  value={editing.vc}
                  onChange={(e) =>
                    setEditing((p) => ({ ...p, vc: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="Fator fn">
                <input
                  className={inputCls}
                  type="number"
                  step="0.01"
                  value={editing.fn}
                  onChange={(e) =>
                    setEditing((p) => ({ ...p, fn: e.target.value }))
                  }
                />
              </FormField>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <FormField label="Fator Vida">
                <input
                  className={inputCls}
                  type="number"
                  step="0.01"
                  value={editing.life}
                  onChange={(e) =>
                    setEditing((p) => ({ ...p, life: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="Fator Limitador">
                <input
                  className={inputCls}
                  type="number"
                  step="1"
                  value={editing.limiter}
                  onChange={(e) =>
                    setEditing((p) => ({ ...p, limiter: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="Risco (0-100)">
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  max="100"
                  value={editing.risk}
                  onChange={(e) =>
                    setEditing((p) => ({ ...p, risk: e.target.value }))
                  }
                />
              </FormField>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={save}
                className="flex-1 rounded-xl bg-cyan-500 py-2.5 text-sm font-black text-black hover:bg-cyan-400 transition"
              >
                Salvar
              </button>
              <button
                onClick={() => setEditing(null)}
                className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm font-bold text-slate-300 hover:bg-slate-700 transition"
              >
                Cancelar
              </button>
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
    name.toLowerCase().includes(search.toLowerCase()),
  );

  const openNew = () => {
    setEditing({ name: "", vc: 1.0, fn: 1.0, stability: 97 });
    setIsNew(true);
  };
  const openEdit = (name) => {
    setEditing({ name, ...machines[name] });
    setIsNew(false);
  };
  const del = (name) => {
    const n = { ...machines };
    delete n[name];
    onChange(n);
  };
  const save = () => {
    if (!editing.name.trim()) return;
    const { name, ...fields } = editing;
    const next = {
      ...machines,
      [name]: {
        vc: Number(fields.vc),
        fn: Number(fields.fn),
        stability: Number(fields.stability),
      },
    };
    onChange(next);
    setEditing(null);
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        icon="🏭"
        title="Máquinas"
        subtitle={`${Object.keys(machines).length} máquinas cadastradas`}
      />
      <div className="flex gap-2">
        <input
          className={inputCls + " flex-1"}
          placeholder="Buscar máquina..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          onClick={openNew}
          className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-black text-black hover:bg-cyan-400 transition whitespace-nowrap"
        >
          + Nova
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-800/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-[#070f1e]">
              <Th>Máquina</Th>
              <Th>Fator Vc</Th>
              <Th>Fator fn</Th>
              <Th>Estabilidade (%)</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(([name, m]) => (
              <tr
                key={name}
                className="border-b border-slate-800/40 hover:bg-slate-800/30 transition"
              >
                <td className="px-3 py-2.5 font-bold text-white">{name}</td>
                <td className="px-3 py-2.5 font-mono text-cyan-300">{m.vc}</td>
                <td className="px-3 py-2.5 font-mono text-cyan-300">{m.fn}</td>
                <td className="px-3 py-2.5">
                  <RiskBar value={m.stability} />
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1 justify-end">
                    <ActionBtn onClick={() => openEdit(name)} color="blue">
                      Editar
                    </ActionBtn>
                    <ActionBtn onClick={() => del(name)} color="red">
                      Del
                    </ActionBtn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="py-8 text-center text-slate-600 text-sm">
            Nenhuma máquina encontrada.
          </p>
        )}
      </div>

      {editing && (
        <Modal
          title={isNew ? "Nova Máquina" : `Editar: ${editing.name}`}
          onClose={() => setEditing(null)}
        >
          <div className="space-y-3">
            <FormField label="Nome da máquina">
              <input
                className={inputCls}
                value={editing.name}
                onChange={(e) =>
                  setEditing((p) => ({ ...p, name: e.target.value }))
                }
                disabled={!isNew}
              />
            </FormField>
            <div className="grid grid-cols-3 gap-3">
              <FormField label="Fator Vc">
                <input
                  className={inputCls}
                  type="number"
                  step="0.01"
                  value={editing.vc}
                  onChange={(e) =>
                    setEditing((p) => ({ ...p, vc: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="Fator fn">
                <input
                  className={inputCls}
                  type="number"
                  step="0.01"
                  value={editing.fn}
                  onChange={(e) =>
                    setEditing((p) => ({ ...p, fn: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="Estabilidade">
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  max="100"
                  value={editing.stability}
                  onChange={(e) =>
                    setEditing((p) => ({ ...p, stability: e.target.value }))
                  }
                />
              </FormField>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={save}
                className="flex-1 rounded-xl bg-cyan-500 py-2.5 text-sm font-black text-black hover:bg-cyan-400 transition"
              >
                Salvar
              </button>
              <button
                onClick={() => setEditing(null)}
                className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm font-bold text-slate-300 hover:bg-slate-700 transition"
              >
                Cancelar
              </button>
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
      <SectionHeader
        icon="💾"
        title="Exportar / Importar"
        subtitle="Backup e restore da configuração completa"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <ActionCard
          icon="⬇️"
          title="Exportar JSON"
          desc="Baixe o arquivo de configuração completo"
          action="Download JSON"
          onClick={exportJson}
          color="cyan"
        />
        <ActionCard
          icon="📋"
          title="Copiar JSON"
          desc="Copie a configuração para a área de transferência"
          action="Copiar"
          onClick={copyJson}
          color="blue"
        />
        <ActionCard
          icon="🔄"
          title="Resetar padrão"
          desc="Restaurar todos os dados para os valores originais"
          action="Resetar"
          onClick={onReset}
          color="red"
        />
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-[#070f1e] p-4 space-y-3">
        <p className="text-[11px] font-black tracking-widest text-slate-400 uppercase">
          Importar configuração
        </p>
        <textarea
          className={inputCls + " h-36 font-mono text-xs resize-none"}
          placeholder="Cole aqui o JSON exportado anteriormente..."
          value={importText}
          onChange={(e) => {
            setImportText(e.target.value);
            setImportError("");
          }}
        />
        {importError && <p className="text-xs text-red-400">{importError}</p>}
        <button
          onClick={handleImport}
          disabled={!importText.trim()}
          className="w-full rounded-xl bg-slate-700 py-2.5 text-sm font-black text-white hover:bg-slate-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Importar
        </button>
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-[#070f1e] p-4">
        <p className="text-[11px] font-black tracking-widest text-slate-400 uppercase mb-3">
          Preview da configuração atual
        </p>
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
        {subtitle && (
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function SaveButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl bg-cyan-500 py-2.5 text-sm font-black text-black hover:bg-cyan-400 transition"
    >
      Salvar alterações
    </button>
  );
}

function Th({ children }) {
  return (
    <th className="px-3 py-2.5 text-left text-[10px] font-black tracking-widest text-slate-500 uppercase">
      {children}
    </th>
  );
}

function ActionBtn({ onClick, color, children }) {
  const cls =
    color === "red"
      ? "bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/20"
      : "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-blue-500/20";
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition ${cls}`}
    >
      {children}
    </button>
  );
}

function RiskBar({ value }) {
  const color = value >= 97 ? "#10b981" : value >= 90 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
      <span className="text-xs font-mono" style={{ color }}>
        {value}%
      </span>
    </div>
  );
}

function ActionCard({ icon, title, desc, action, onClick, color }) {
  const cls =
    color === "red"
      ? "border-red-500/20 hover:border-red-500/40 hover:bg-red-500/5"
      : color === "cyan"
        ? "border-cyan-500/20 hover:border-cyan-500/40 hover:bg-cyan-500/5"
        : "border-blue-500/20 hover:border-blue-500/40 hover:bg-blue-500/5";
  const btnCls =
    color === "red"
      ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
      : color === "cyan"
        ? "bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25"
        : "bg-blue-500/15 text-blue-400 hover:bg-blue-500/25";
  return (
    <div
      className={`rounded-xl border bg-[#070f1e] p-4 transition cursor-pointer ${cls}`}
      onClick={onClick}
    >
      <div className="text-2xl mb-2">{icon}</div>
      <p className="font-bold text-white text-sm">{title}</p>
      <p className="text-xs text-slate-500 mt-1 mb-3">{desc}</p>
      <span
        className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-black transition ${btnCls}`}
      >
        {action}
      </span>
    </div>
  );
}

// ─── NAV ITEMS ────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "brand", icon: "🏷️", label: "Marca" },
  { id: "materials", icon: "⚙️", label: "Materiais" },
  { id: "iso", icon: "📋", label: "Classes ISO" },
  { id: "geometries", icon: "🔩", label: "Geometrias" },
  { id: "depths", icon: "📏", label: "Profundidades" },
  { id: "machines", icon: "🏭", label: "Máquinas" },
  { id: "export", icon: "💾", label: "Export/Import" },
  { id: "users", icon: "👥", label: "Usuários" },
  { id: "tools", icon: "🔧", label: "Ferramentas" },
];

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
function AdminPanelInner() {
  const { currentUser, role, signOut } = useAuth();
  const [config, setConfig] = useState(null); // null = loading

  // Bootstrap: load config from active adapter on mount
  useEffect(() => {
    repository
      .getConfig()
      .then(setConfig)
      .catch(() => setConfig(buildDefaultConfig()));
  }, []);

  const [activeTab, setActiveTab] = useState("brand");
  const [toast, setToast] = useState(null);
  const [navOpen, setNavOpen] = useState(false);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
  }, []);

  const persistAndUpdate = useCallback(
    async (newConfig) => {
      setConfig(newConfig);
      try {
        await repository.saveConfig(newConfig);
        showToast("Configuração salva com sucesso.", "success");
      } catch {
        showToast("Erro ao salvar. Verifique o armazenamento.", "error");
      }
    },
    [showToast],
  );

  const updateSection = useCallback(
    (section) => async (value) => {
      const newConfig = { ...config, [section]: value };
      setConfig(newConfig);
      try {
        await repository.saveSection(section, value);
        showToast("Configuração salva com sucesso.", "success");
      } catch {
        showToast("Erro ao salvar. Verifique o armazenamento.", "error");
      }
    },
    [config, showToast],
  );

  const handleReset = async () => {
    if (
      window.confirm(
        "Tem certeza que deseja restaurar os dados padrão? Todas as alterações serão perdidas.",
      )
    ) {
      try {
        await repository.resetConfig();
        const defaults = buildDefaultConfig();
        setConfig(defaults);
        showToast("Dados restaurados para o padrão.", "success");
      } catch {
        showToast("Erro ao resetar configuração.", "error");
      }
    }
  };

  const handleImport = (imported) => {
    const merged = { ...buildDefaultConfig(), ...imported };
    persistAndUpdate(merged);
    showToast("Configuração importada com sucesso.", "success");
  };

  if (!config) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#040810]">
        <div className="text-center space-y-3">
          <div className="mx-auto h-8 w-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin" />
          <p className="text-xs font-black tracking-widest text-slate-500 uppercase">
            Carregando configuração...
          </p>
        </div>
      </div>
    );
  }

  const statCounts = [
    {
      label: "Materiais",
      value: Object.keys(config.materials).length,
      color: "#3b82f6",
    },
    {
      label: "Máquinas",
      value: Object.keys(config.machines).length,
      color: "#10b981",
    },
    {
      label: "Geometrias",
      value: Object.keys(config.geometries).length,
      color: "#f59e0b",
    },
    {
      label: "Profundidades",
      value: Object.keys(config.depths).length,
      color: "#8b5cf6",
    },
  ];

  return (
    <div
      className="min-h-screen bg-[#040810] text-white"
      style={{ fontFamily: "'IBM Plex Mono', 'Courier New', monospace" }}
    >
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
        .field-label-inner { transition: transform 0.2s ease; }
        .field-label-scrollable.field-label-inner { transform: translateX(0); }
        .field-label:focus-within .field-label-scrollable {
          animation: field-label-marquee 5s linear 0.5s infinite;
        }
        @keyframes field-label-marquee {
          0%, 15%  { transform: translateX(0); }
          50%, 65% { transform: translateX(var(--field-label-overflow, 0)); }
          100%     { transform: translateX(0); }
        }
      `}</style>

      {/* Top bar */}
      <header
        className="sticky top-0 z-30 border-b border-slate-800/60 bg-[#04080f]/90"
        style={{ backdropFilter: "blur(16px)" }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              className="sm:hidden text-slate-400 hover:text-white text-xl"
              onClick={() => setNavOpen((o) => !o)}
            >
              ☰
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-[10px] font-black tracking-[0.2em] text-cyan-400 uppercase syne">
                  EXALTT Admin
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 hidden sm:block">
                Painel de Configuração · {config.brand.company}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {statCounts.map((s) => (
              <div
                key={s.label}
                className="hidden sm:flex flex-col items-center"
              >
                <span
                  className="text-lg font-black syne"
                  style={{ color: s.color }}
                >
                  {s.value}
                </span>
                <span className="text-[9px] text-slate-600 uppercase tracking-wider">
                  {s.label}
                </span>
              </div>
            ))}
            <div className="hidden sm:flex flex-col items-end gap-1">
              <span className="text-[10px] text-slate-400 truncate max-w-[140px]">
                {currentUser?.email}
              </span>
              <span
                className={`text-[9px] font-black tracking-wider uppercase ${role === "super_admin" ? "text-amber-400" : "text-blue-400"}`}
              >
                {role === "super_admin" ? "Super Admin" : "Admin"}
              </span>
            </div>
            <button
              onClick={signOut}
              className="rounded-xl border border-slate-700/60 bg-slate-800/60 px-3 py-1.5 text-[11px] font-black text-slate-300 hover:bg-slate-700 hover:text-white transition"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        {/* Sidebar */}
        <aside
          className={`fixed sm:sticky top-[53px] z-20 h-[calc(100vh-53px)] w-56 shrink-0 overflow-y-auto border-r border-slate-800/60 bg-[#04080f] transition-transform duration-200 sm:translate-x-0 ${navOpen ? "translate-x-0" : "-translate-x-full"}`}
          style={{ backdropFilter: "blur(12px)" }}
        >
          <div className="scanline absolute inset-0 pointer-events-none" />
          <nav className="p-3 space-y-0.5">
            <p className="px-3 py-2 text-[9px] font-black tracking-[0.25em] text-slate-600 uppercase">
              Configurações
            </p>
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setNavOpen(false);
                }}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                  activeTab === item.id
                    ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-white border border-transparent"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span className="font-bold">{item.label}</span>
                {activeTab === item.id && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-400" />
                )}
              </button>
            ))}
          </nav>

          <div className="mx-3 mt-4 rounded-xl border border-slate-800/60 p-3 bg-[#070f1e]">
            <p className="text-[9px] font-black tracking-widest text-slate-600 uppercase mb-2">
              Contagem
            </p>
            {statCounts.map((s) => (
              <div
                key={s.label}
                className="flex items-center justify-between py-1"
              >
                <span className="text-[11px] text-slate-500">{s.label}</span>
                <span className="text-xs font-black" style={{ color: s.color }}>
                  {s.value}
                </span>
              </div>
            ))}
          </div>
        </aside>

        {/* Backdrop for mobile nav */}
        {navOpen && (
          <div
            className="fixed inset-0 z-10 bg-black/60 sm:hidden"
            onClick={() => setNavOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 p-4 sm:p-6">
          <div className="mx-auto max-w-4xl">
            {activeTab === "brand" && (
              <BrandSection
                brand={config.brand}
                onChange={updateSection("brand")}
              />
            )}
            {activeTab === "materials" && (
              <MaterialsSection
                materials={config.materials}
                isoClasses={config.isoClasses}
                onChange={updateSection("materials")}
              />
            )}
            {activeTab === "iso" && (
              <IsoClassesSection
                isoClasses={config.isoClasses}
                onChange={updateSection("isoClasses")}
              />
            )}
            {activeTab === "geometries" && (
              <GeometriesSection
                geometries={config.geometries}
                isoClasses={config.isoClasses}
                onChange={updateSection("geometries")}
              />
            )}
            {activeTab === "depths" && (
              <DepthsSection
                depths={config.depths}
                onChange={updateSection("depths")}
              />
            )}
            {activeTab === "machines" && (
              <MachinesSection
                machines={config.machines}
                onChange={updateSection("machines")}
              />
            )}
            {activeTab === "export" && (
              <ExportSection
                config={config}
                onImport={handleImport}
                onReset={handleReset}
              />
            )}
            {activeTab === "users" && <UsersSection />}
            {activeTab === "tools" && <ToolsSection />}
          </div>
        </main>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

export default function AdminPanel() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

function AuthGate() {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#040810]">
        <div className="text-center space-y-3">
          <div className="mx-auto h-8 w-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin" />
          <p className="text-xs font-black tracking-widest text-slate-500 uppercase">
            Verificando sessão...
          </p>
        </div>
      </div>
    );
  }

  if (!currentUser) return <LoginScreen />;
  return <AdminPanelInner />;
}
