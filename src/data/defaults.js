export const DEFAULT_BRAND = {
  company: "TopTools Brasil",
  line: "EXALTT",
  product: "Clever Mind – Drilling AI",
  mode: "Secure Local App",
  notebookEmail: "silvio@toptools.comn.br",
  onboardiaEndpoint: "/api/onboardia/pdf-agent",
  fallbackEndpoint: "/api/ai-report-agent",
};

export const DEFAULT_MATERIALS = {
  "SAE 1020": { vc: 135, fn: 0.26, life: 1800, iso: "P", materialClass: "Aço carbono baixo carbono" },
  "SAE 1045": { vc: 125, fn: 0.22, life: 1500, iso: "P", materialClass: "Aço carbono médio carbono" },
  "SAE 4140": { vc: 115, fn: 0.24, life: 1200, iso: "P", materialClass: "Aço ligado beneficiado" },
  "SAE 8620": { vc: 86,  fn: 0.19, life: 2300, iso: "P", materialClass: "Aço ligado para cementação" },
  "SAE 52100": { vc: 75, fn: 0.16, life: 950,  iso: "P", materialClass: "Aço rolamento alto carbono/cromo" },
  "D2":        { vc: 58, fn: 0.13, life: 720,  iso: "H", materialClass: "Aço ferramenta alto cromo endurecido" },
  "VC131":     { vc: 55, fn: 0.12, life: 680,  iso: "H", materialClass: "Aço ferramenta similar D2 / alta dureza" },
  "Inox 304":  { vc: 68, fn: 0.16, life: 850,  iso: "M", materialClass: "Aço inoxidável austenítico" },
  "Inox 316":  { vc: 62, fn: 0.15, life: 780,  iso: "M", materialClass: "Aço inoxidável austenítico com molibdênio" },
  "Inox 410":  { vc: 75, fn: 0.17, life: 900,  iso: "M", materialClass: "Aço inoxidável martensítico" },
  "Inox 420":  { vc: 65, fn: 0.14, life: 760,  iso: "M", materialClass: "Aço inoxidável martensítico endurecível" },
  "Ferro Fundido Cinzento": { vc: 120, fn: 0.28, life: 1800, iso: "K", materialClass: "Ferro fundido cinzento" },
  "Ferro Fundido Nodular":  { vc: 105, fn: 0.25, life: 1600, iso: "K", materialClass: "Ferro fundido nodular" },
  "Alumínio 6061":   { vc: 220, fn: 0.30, life: 2400, iso: "N", materialClass: "Alumínio usinável série 6000" },
  "Alumínio 7075":   { vc: 190, fn: 0.26, life: 2100, iso: "N", materialClass: "Alumínio aeronáutico alta resistência" },
  "Alumínio Fundido":{ vc: 180, fn: 0.28, life: 2000, iso: "N", materialClass: "Alumínio fundido com silício" },
  "Cobre Eletrolítico": { vc: 120, fn: 0.18, life: 1500, iso: "N", materialClass: "Cobre puro de alta condutividade" },
  "Latão":           { vc: 180, fn: 0.24, life: 2200, iso: "N", materialClass: "Liga cobre-zinco / brass" },
  "Bronze":          { vc: 115, fn: 0.20, life: 1600, iso: "N", materialClass: "Liga cobre-estanho / bronze" },
  "Cobre Berílio":   { vc: 95,  fn: 0.16, life: 1250, iso: "N", materialClass: "Liga cobre-berílio alta resistência" },
  "Inconel 625":     { vc: 32,  fn: 0.08, life: 420,  iso: "S", materialClass: "Superliga níquel resistente ao calor" },
  "Inconel 718":     { vc: 28,  fn: 0.07, life: 360,  iso: "S", materialClass: "Superliga níquel endurecida por precipitação" },
  "Titânio Ti6Al4V": { vc: 45,  fn: 0.10, life: 520,  iso: "S", materialClass: "Liga de titânio aeroespacial" },
  "Aço Temperado 45 HRC": { vc: 48, fn: 0.10, life: 600, iso: "H", materialClass: "Aço endurecido até 45 HRC" },
  "Aço Temperado 55 HRC": { vc: 35, fn: 0.08, life: 430, iso: "H", materialClass: "Aço endurecido até 55 HRC" },
  "Aço Temperado 60 HRC": { vc: 28, fn: 0.06, life: 320, iso: "H", materialClass: "Aço endurecido até 60 HRC" },
};

export const DEFAULT_ISO_CLASSES = {
  P: "ISO P — Aços",
  M: "ISO M — Aços inoxidáveis",
  K: "ISO K — Ferros fundidos",
  N: "ISO N — Não ferrosos",
  S: "ISO S — Superligas resistentes ao calor",
  H: "ISO H — Materiais endurecidos",
};

export const DEFAULT_GEOMETRIES = {
  XTA: { code: "XTA", name: "Geometria para Aços",        application: "Aplicar em aços carbono, baixa liga e aços ligados ISO P.", iso: ["P"] },
  XTH: { code: "XTH", name: "Geometria para Ferro Fundido", application: "Aplicar em ferro fundido cinzento e nodular ISO K.", iso: ["K"] },
  XTS: { code: "XTS", name: "Geometria para Não Ferrosos", application: "Aplicar em não ferrosos ISO N, inclusive alumínio, cobre e ligas de cobre.", iso: ["N"] },
  XTL: { code: "XTL", name: "Geometria para Inox e Superligas", application: "Aplicar em aços inoxidáveis ISO M, titânio, Inconel e superligas resistentes ao calor ISO S.", iso: ["M", "S"] },
};

export const DEFAULT_DEPTHS = {
  "3xD":  { vc: 1.05, fn: 1.03, life: 1.08, risk: 99 },
  "5xD":  { vc: 1.00, fn: 1.00, life: 1.00, risk: 98 },
  "8xD":  { vc: 0.92, fn: 0.94, life: 0.88, risk: 91 },
  "12xD": { vc: 0.84, fn: 0.88, life: 0.76, risk: 84 },
};

export const DEFAULT_MACHINES = {
  "Romi D800":              { vc: 1.00, fn: 1.00, stability: 98 },
  "HASS VF-5-50XT":         { vc: 1.03, fn: 1.02, stability: 97 },
  "Fanuc Robodrill D14Mi":  { vc: 1.03, fn: 1.02, stability: 97 },
  "Fanuc Robodrill D21Mi":  { vc: 1.04, fn: 1.03, stability: 98 },
  "Brother Speedio R450-X": { vc: 1.06, fn: 1.04, stability: 99 },
  "Brother Speedio R650-X": { vc: 1.06, fn: 1.04, stability: 99 },
  "Mazak VTC 200C":         { vc: 1.03, fn: 1.02, stability: 97 },
  "Mazak VTC-EZ30":         { vc: 1.04, fn: 1.03, stability: 98 },
  "Heller H4000":           { vc: 1.05, fn: 1.04, stability: 99 },
  "Heller H8000":           { vc: 1.06, fn: 1.05, stability: 99 },
  "Okuma MB-4000H":         { vc: 1.04, fn: 1.03, stability: 98 },
  "Okuma MB-5000HII":       { vc: 1.05, fn: 1.04, stability: 99 },
  "Deckel Maho DMU50":      { vc: 1.02, fn: 1.01, stability: 97 },
};

export function buildDefaultConfig() {
  return {
    brand:      { ...DEFAULT_BRAND },
    materials:  { ...DEFAULT_MATERIALS },
    isoClasses: { ...DEFAULT_ISO_CLASSES },
    geometries: JSON.parse(JSON.stringify(DEFAULT_GEOMETRIES)),
    depths:     JSON.parse(JSON.stringify(DEFAULT_DEPTHS)),
    machines:   { ...DEFAULT_MACHINES },
  };
}
