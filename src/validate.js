export const BRANDS = [
  { id: "biobalance", label: "Biobalance", source: "shopify" },
  { id: "fixderma", label: "Fixderma", source: "shopify" },
  { id: "ordinary", label: "The Ordinary", source: "official" },
  { id: "cerave", label: "CeraVe", source: "official" },
  { id: "laroche", label: "La Roche-Posay", source: "official" },
  { id: "skin1004", label: "SKIN1004", source: "shopify" },
];

const WORDS = /^[\p{L}\p{M}\p{N} .,'’&+-]+$/u;

export function brandById(id) {
  return BRANDS.find((brand) => brand.id === id) || null;
}

export function brandIdFor(raw) {
  const text = String(raw || "").toLowerCase();
  if (/biobalance|bio-balance|bio balance/.test(text)) return "biobalance";
  if (/fixderma|fix derma/.test(text)) return "fixderma";
  if (/\bordinary\b/.test(text)) return "ordinary";
  if (/cerave|cera ve/.test(text)) return "cerave";
  if (/la roche[- ]posay/.test(text)) return "laroche";
  if (/skin\s*1004/.test(text)) return "skin1004";
  return "";
}

export function parseQuery(value) {
  if (value == null || value === "") return { value: "" };
  if (typeof value !== "string") return { error: "Type a product name." };
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length > 60) return { error: "That name is too long." };
  if (trimmed && (!WORDS.test(trimmed) || !/[\p{L}\p{N}]/u.test(trimmed))) {
    return { error: "Use letters and numbers, like niacinamide or sunscreen." };
  }
  return { value: trimmed };
}

export function parseBrand(value) {
  if (value == null || value === "" || value === "all") return { value: "all" };
  if (typeof value !== "string" || !brandById(value)) return { error: "Pick one of the brands." };
  return { value };
}

const STEPS = ["cleanse", "treat", "moisturise", "sunscreen", "morning", "evening"];

export function parseStep(value) {
  if (value == null || value === "") return { value: "" };
  if (typeof value !== "string" || !STEPS.includes(value)) return { error: "Pick a routine step from the list." };
  return { value };
}

export function parseSort(value) {
  if (value == null || value === "" || value === "az") return { value: "az" };
  if (value === "za" || value === "ingredients") return { value };
  return { error: "Sort by name or by ingredient list." };
}

export function parseChoice(value, allowed, emptyMessage) {
  if (value == null || value === "" || value === "all") return { value: "" };
  if (typeof value !== "string" || !allowed.includes(value)) return { error: emptyMessage };
  return { value };
}

export function parseCode(value) {
  if (typeof value === "string" && /^\d{6,20}$/.test(value)) return { value };
  if (typeof value === "string" && /^(lrp|bb|fx|to|cv|sk)-[a-z0-9-]{3,140}$/.test(value)) return { value };
  return { error: "That product code is not valid." };
}
