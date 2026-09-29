/** PLAT-009 — rezolvare vizual vehicul pe marcă + model (fără monogramă 2 litere). */

export type VehicleBodyStyle =
  | "hatch"
  | "sedan"
  | "estate"
  | "suv"
  | "van"
  | "truck"
  | "trailer"
  | "bus"
  | "generic";

export type VehicleVisualTier = "photo" | "model" | "brand" | "type" | "generic";

export type VehicleVisualResolved = {
  tier: VehicleVisualTier;
  /** URL foto reală (upload sau stock). */
  src: string | null;
  body: VehicleBodyStyle;
  /** Culoare caroserie ilustrație (hex). */
  paint: string;
  label: string;
  alt: string;
};

const BRAND_ALIASES: Record<string, string> = {
  vw: "volkswagen",
  "volks wagen": "volkswagen",
  merc: "mercedes",
  "mercedes-benz": "mercedes",
  "mercedes benz": "mercedes",
  mb: "mercedes",
  bmw: "bmw",
  "citroën": "citroen",
  "citroen": "citroen",
  "škoda": "skoda",
  skoda: "skoda",
  "land rover": "landrover",
  "range rover": "landrover",
};

const BRAND_PAINT: Record<string, string> = {
  dacia: "#5B8C2A",
  ford: "#1B4F9C",
  bmw: "#1C69D4",
  mercedes: "#333333",
  volkswagen: "#1A1A1A",
  renault: "#FFCC33",
  toyota: "#EB0A1E",
  skoda: "#4BA82E",
  peugeot: "#1D1D1B",
  citroen: "#E4002B",
  opel: "#F7FF00",
  fiat: "#AD1818",
  iveco: "#003399",
  man: "#FFCC00",
  scania: "#1A1A1A",
  volvo: "#003057",
  hyundai: "#002C5F",
  kia: "#05141F",
  nissan: "#C3002F",
  audi: "#BB0A30",
  porsche: "#000000",
  seat: "#EE1C25",
  cupra: "#7A1F1F",
};

/** Modele cunoscute → siluetă (bibliotecă curată RO/EU flote). */
const MODEL_BODY: Array<{ brand: string; modelIncludes: string[]; body: VehicleBodyStyle }> = [
  { brand: "dacia", modelIncludes: ["logan", "sandero", "jogger"], body: "sedan" },
  { brand: "dacia", modelIncludes: ["duster"], body: "suv" },
  { brand: "dacia", modelIncludes: ["dokker", "lodgy", "express"], body: "van" },
  { brand: "dacia", modelIncludes: ["spring"], body: "hatch" },
  { brand: "ford", modelIncludes: ["fiesta", "focus", "puma"], body: "hatch" },
  { brand: "ford", modelIncludes: ["mondeo"], body: "sedan" },
  { brand: "ford", modelIncludes: ["kuga", "explorer", "edge"], body: "suv" },
  { brand: "ford", modelIncludes: ["transit", "custom", "courier", "connect"], body: "van" },
  { brand: "bmw", modelIncludes: ["seria 1", "series 1", "116", "118", "120", "m135"], body: "hatch" },
  { brand: "bmw", modelIncludes: ["seria 3", "series 3", "318", "320", "330", "m340"], body: "sedan" },
  { brand: "bmw", modelIncludes: ["seria 5", "series 5", "520", "530", "540", "m550"], body: "sedan" },
  { brand: "bmw", modelIncludes: ["seria 7", "series 7"], body: "sedan" },
  { brand: "bmw", modelIncludes: ["x1", "x2", "x3", "x4", "x5", "x6", "x7"], body: "suv" },
  { brand: "mercedes", modelIncludes: ["a-class", "clasa a", "a180", "a200"], body: "hatch" },
  { brand: "mercedes", modelIncludes: ["c-class", "clasa c", "c180", "c200", "c220"], body: "sedan" },
  { brand: "mercedes", modelIncludes: ["e-class", "clasa e", "e200", "e220", "e300"], body: "sedan" },
  { brand: "mercedes", modelIncludes: ["gla", "glb", "glc", "gle", "gls"], body: "suv" },
  { brand: "mercedes", modelIncludes: ["sprinter", "vito", "vito", "v-class", "citan"], body: "van" },
  { brand: "mercedes", modelIncludes: ["actros", "atego"], body: "truck" },
  { brand: "volkswagen", modelIncludes: ["polo", "golf", "up", "id.3", "id3"], body: "hatch" },
  { brand: "volkswagen", modelIncludes: ["passat", "arteon", "jetta"], body: "sedan" },
  { brand: "volkswagen", modelIncludes: ["tiguan", "touareg", "t-roc", "troc", "t-cross"], body: "suv" },
  { brand: "volkswagen", modelIncludes: ["transporter", "multivan", "crafter", "caddy", "id.buzz"], body: "van" },
  { brand: "renault", modelIncludes: ["clio", "megane", "zoe", "twingo"], body: "hatch" },
  { brand: "renault", modelIncludes: ["talisman", "latitude"], body: "sedan" },
  { brand: "renault", modelIncludes: ["captur", "kadjar", "austral", "koleos", "arkana"], body: "suv" },
  { brand: "renault", modelIncludes: ["trafic", "master", "kangoo"], body: "van" },
  { brand: "skoda", modelIncludes: ["fabia", "scala", "rapid"], body: "hatch" },
  { brand: "skoda", modelIncludes: ["octavia", "superb"], body: "estate" },
  { brand: "skoda", modelIncludes: ["kamiq", "karoq", "kodiaq", "elroq"], body: "suv" },
  { brand: "toyota", modelIncludes: ["yaris", "corolla", "aygo"], body: "hatch" },
  { brand: "toyota", modelIncludes: ["camry", "avensis"], body: "sedan" },
  { brand: "toyota", modelIncludes: ["rav4", "c-hr", "chr", "highlander", "land cruiser"], body: "suv" },
  { brand: "toyota", modelIncludes: ["hilux", "proace", "hiace"], body: "van" },
  { brand: "peugeot", modelIncludes: ["208", "308", "108"], body: "hatch" },
  { brand: "peugeot", modelIncludes: ["508"], body: "sedan" },
  { brand: "peugeot", modelIncludes: ["2008", "3008", "5008"], body: "suv" },
  { brand: "peugeot", modelIncludes: ["partner", "expert", "boxer", "rifter"], body: "van" },
  { brand: "iveco", modelIncludes: ["daily", "eurocargo", "s-way", "stralis"], body: "truck" },
  { brand: "man", modelIncludes: ["tge", "tgx", "tgs"], body: "truck" },
  { brand: "scania", modelIncludes: ["r ", "s ", "p ", "g "], body: "truck" },
];

const TYPE_BODY: Record<string, VehicleBodyStyle> = {
  car: "sedan",
  van: "van",
  truck: "truck",
  tractor_unit: "truck",
  trailer: "trailer",
  semi_trailer: "trailer",
  bus: "bus",
  other: "generic",
};

export function normalizeBrandKey(brand: string | null | undefined): string {
  const raw = (brand ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!raw) return "";
  return BRAND_ALIASES[raw] ?? raw.replace(/[^a-z0-9]+/g, "");
}

export function normalizeModelKey(model: string | null | undefined): string {
  return (model ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function bodyFromModel(brandKey: string, modelKey: string): VehicleBodyStyle | null {
  if (!brandKey || !modelKey) return null;
  for (const row of MODEL_BODY) {
    if (row.brand !== brandKey) continue;
    if (row.modelIncludes.some((m) => modelKey.includes(m))) return row.body;
  }
  return null;
}

function bodyFromType(type: string | null | undefined): VehicleBodyStyle {
  if (!type) return "generic";
  return TYPE_BODY[type] ?? "generic";
}

function paintFor(brandKey: string, body: VehicleBodyStyle): string {
  if (brandKey && BRAND_PAINT[brandKey]) return BRAND_PAINT[brandKey];
  switch (body) {
    case "van":
      return "#4B5563";
    case "truck":
      return "#374151";
    case "trailer":
      return "#6B7280";
    case "suv":
      return "#1F4E79";
    case "bus":
      return "#B45309";
    default:
      return "#3F3F46";
  }
}

export function resolveVehicleVisual(input: {
  brand?: string | null;
  model?: string | null;
  type?: string | null;
  /** Prima poză exterior / orice poză preferată. */
  photoUrl?: string | null;
}): VehicleVisualResolved {
  const brandRaw = (input.brand ?? "").trim();
  const modelRaw = (input.model ?? "").trim();
  const brandKey = normalizeBrandKey(brandRaw);
  const modelKey = normalizeModelKey(modelRaw);
  const label = [brandRaw, modelRaw].filter(Boolean).join(" ") || input.type || "Vehicul";

  if (input.photoUrl?.trim()) {
    return {
      tier: "photo",
      src: input.photoUrl.trim(),
      body: bodyFromModel(brandKey, modelKey) ?? bodyFromType(input.type),
      paint: paintFor(brandKey, bodyFromType(input.type)),
      label,
      alt: label,
    };
  }

  const modelBody = bodyFromModel(brandKey, modelKey);
  if (modelBody) {
    return {
      tier: "model",
      src: null,
      body: modelBody,
      paint: paintFor(brandKey, modelBody),
      label,
      alt: label,
    };
  }

  if (brandKey) {
    const body = bodyFromType(input.type);
    return {
      tier: "brand",
      src: null,
      body,
      paint: paintFor(brandKey, body),
      label: brandRaw || label,
      alt: brandRaw || label,
    };
  }

  const typeBody = bodyFromType(input.type);
  return {
    tier: typeBody === "generic" ? "generic" : "type",
    src: null,
    body: typeBody,
    paint: paintFor("", typeBody),
    label,
    alt: label,
  };
}

/** Prima poză utilă din galerie (preferă exterior). */
export function pickVehicleHeroPhotoUrl(
  items: Array<{ fileUrl: string | null; kind?: string | null }> | null | undefined,
): string | null {
  if (!items?.length) return null;
  const exterior = items.find((p) => p.kind === "exterior" && p.fileUrl);
  if (exterior?.fileUrl) return exterior.fileUrl;
  const any = items.find((p) => p.fileUrl);
  return any?.fileUrl ?? null;
}
