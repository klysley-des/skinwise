import express from "express";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createBeauty, toCard } from "./beauty.js";
import { GUIDE, guideById, ingredientListed, ingredientMentioned } from "./guide.js";
import { CONCERNS, SKIN_TYPES, traits } from "./traits.js";
import { GUIDANCE, compatibilityNote, matchesStep } from "./routine.js";

const STEP_IDS = ["cleanse", "treat", "moisturise", "sunscreen", "morning", "evening"];
import { BRANDS, parseBrand, parseChoice, parseCode, parseQuery, parseSort, parseStep } from "./validate.js";

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' https://images.openbeautyfacts.org https://cdn.shopify.com https://www.cerave.com https://theordinary.com https://www.laroche-posay.be",
  "connect-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join("; ");

const LINK_HOSTS = new Set([
  "biobalance.co.uk",
  "www.fixderma.com",
  "skin1004.com",
  "www.cerave.com",
  "theordinary.com",
  "www.laroche-posay.be",
  "world.openbeautyfacts.org",
]);

function safeLink(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !LINK_HOSTS.has(url.hostname)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function slideLabel(name) {
  const stem = name.replace(/\.[^.]+$/, "").replace(/^\d+[-_\s]*/, "").toLowerCase();
  if (stem.startsWith("cerave")) return "CeraVe";
  if (stem.startsWith("biobalance")) return "Biobalance";
  if (stem.startsWith("theordinary") || stem.startsWith("ordinary")) return "The Ordinary";
  if (stem.startsWith("centella") || stem.startsWith("skin1004")) return "SKIN1004";
  if (stem.startsWith("laroche") || stem.startsWith("la-roche") || stem.startsWith("la roche")) return "La Roche-Posay";
  if (stem.startsWith("fixderma")) return "Fixderma";
  return stem.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function shortText(value) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (text.length <= 280) return text;
  const cut = text.slice(0, 280);
  const last = cut.lastIndexOf(" ");
  return `${(last > 80 ? cut.slice(0, last) : cut).replace(/[,:;]+$/, "").trim()}…`;
}

function present(product) {
  const card = toCard(product);
  const info = traits(product.name, product.claimText || product.description || "");
  card.concerns = info.concernLabels;
  card.concernIds = info.concerns;
  card.skinTypes = info.skinTypeLabels;
  card.skinTypeIds = info.skinTypes;
  card.link = safeLink(product.pageUrl);
  card.description = shortText(product.description);
  card.ingredientList = Array.isArray(product.ingredientList) ? product.ingredientList : [];
  card.steps = STEP_IDS.filter((step) => matchesStep(product, step));
  return card;
}

function presentDetail(product) {
  const fromFacts = product.source === "openbeautyfacts";
  let status = product.ingredientStatus === "complete" || product.ingredientStatus === "partial"
    ? product.ingredientStatus
    : "unverified";
  let list = Array.isArray(product.ingredientList) ? product.ingredientList : [];
  if (fromFacts) {
    if (status === "unverified") list = [];
    else status = "partial";
  }
  const shown = { ...product, ingredientList: list };
  const keyActives = GUIDE.filter((item) => ingredientListed(shown, item.id)).map((item) => ({
    name: item.name,
    does: item.does,
    concerns: item.concerns || [],
  }));
  const named = list.filter((part) => !keyActives.some((item) => part.toLowerCase().includes(item.name.toLowerCase())));
  const note = fromFacts
    ? (list.length
      ? "This ingredient list is the text Open Beauty Facts publishes for this barcode."
      : "Open Beauty Facts did not publish an ingredient list for this barcode.")
    : status === "complete"
      ? "This is the ingredient list published on the official product page."
      : status === "partial"
        ? "These names are published by the brand. A complete INCI list has not been verified."
        : "A complete ingredient list has not been verified. The official page does not publish one.";
  return {
    ...present(product),
    ingredients: product.ingredients || "",
    ingredientList: list,
    ingredientStatus: status,
    ingredientKind: status === "complete" ? "inci" : status === "partial" ? "key" : "none",
    keyActives,
    keyIngredients: keyActives.map((item) => item.name),
    otherIngredients: status === "partial" ? named : [],
    mentions: product.mentions || [],
    ingredientNote: note,
    ...(fromFacts ? { sourceName: "Open Beauty Facts" } : {}),
  };
}

function createCache(ttlMs = 600_000) {
  const store = new Map();
  return {
    get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expires) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    set(key, value) {
      store.set(key, { value, expires: Date.now() + ttlMs });
      while (store.size > 120) store.delete(store.keys().next().value);
    },
  };
}

function sendFailure(res, err) {
  if (res.headersSent) return;
  if (err?.code === "TIMEOUT") {
    res.status(504).json({ error: err.message });
    return;
  }
  if (err?.code === "MISSING") {
    res.status(404).json({ error: err.message });
    return;
  }
  if (err?.code === "UPSTREAM") {
    res.status(502).json({ error: err.message });
    return;
  }
  console.error("skinwise failure", err?.message || "unknown");
  res.status(500).json({ error: "Something went wrong on this server." });
}

function route(fn) {
  return (req, res) => {
    Promise.resolve(fn(req, res)).catch((err) => sendFailure(res, err));
  };
}

function orderProducts(products, sort) {
  const copy = products.slice();
  if (sort === "ingredients") {
    copy.sort((a, b) => Number(b.hasIngredients) - Number(a.hasIngredients) || a.name.localeCompare(b.name));
    return copy;
  }
  copy.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === "za") copy.reverse();
  return copy;
}

export function createApp({
  serverId = process.env.SERVER_ID || "local",
  fetchImpl,
  publicDir = fileURLToPath(new URL("../public/", import.meta.url)),
} = {}) {
  const beauty = createBeauty({ fetchImpl, cache: createCache() });
  const hits = new Map();
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Served-By", serverId);
    res.setHeader("Content-Security-Policy", CSP);
    next();
  });

  function tooMany(req, res) {
    if (req.path === "/health") return false;
    const key = req.ip || "unknown";
    const now = Date.now();
    const fresh = (hits.get(key) || []).filter((stamp) => now - stamp < 60_000);
    if (fresh.length >= 40) {
      res.setHeader("Retry-After", "30");
      res.status(429).json({ error: "Too many lookups. Wait a moment and try again." });
      return true;
    }
    fresh.push(now);
    hits.set(key, fresh);
    return false;
  }

  app.get("/api/health", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, service: "skinwise", server: serverId });
  });

  app.get("/health", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ status: "ok", app: "SkinWise", server: serverId });
  });

  app.get("/api/brands", (req, res) => {
    res.json({
      brands: BRANDS.map(({ id, label }) => ({ id, label })),
      concerns: CONCERNS.map(({ id, label }) => ({ id, label })),
      skinTypes: SKIN_TYPES.map(({ id, label }) => ({ id, label })),
    });
  });

  app.get("/api/guide", (req, res) => {
    res.json({ ingredients: GUIDE });
  });

  app.get("/api/guide/:id/products", route(async (req, res) => {
    if (tooMany(req, res)) return;
    const item = guideById(req.params.id);
    if (!item) {
      res.status(404).json({ error: "That ingredient is not in the guide." });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    const result = await beauty.search({ query: "", brandId: "all" });
    const matched = result.groups.flatMap((group) => (
      group.products.filter((product) => ingredientMentioned(product, item.id)).map(present)
    ));
    res.setHeader("X-Cache", result.cache);
    res.json({
      ingredient: { id: item.id, name: item.name },
      total: matched.length,
      products: matched,
      gaps: result.groups.filter((group) => group.error).map((group) => group.label),
    });
  }));

  app.get("/api/slides", async (req, res) => {
    const dir = path.join(publicDir, "images");
    let names = [];
    try {
      names = await readdir(dir);
    } catch {
      names = [];
    }
    const slides = names
      .filter((name) => [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(path.extname(name).toLowerCase()))
      .filter((name) => !name.startsWith("."))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((name) => ({
        src: `/images/${encodeURIComponent(name)}`,
        label: slideLabel(name),
      }));
    res.json({ slides });
  });

  app.get("/api/products", route(async (req, res) => {
    if (tooMany(req, res)) return;
    res.setHeader("Cache-Control", "no-store");
    const query = parseQuery(req.query.q);
    const brand = parseBrand(req.query.brand);
    const sort = parseSort(req.query.sort);
    const concern = parseChoice(req.query.concern, CONCERNS.map((item) => item.id), "Pick a skin concern from the list.");
    const skin = parseChoice(req.query.skin, SKIN_TYPES.map((item) => item.id), "Pick a skin type from the list.");
    const step = parseStep(req.query.step);
    const error = query.error || brand.error || sort.error || concern.error || skin.error || step.error;
    if (error) {
      res.status(400).json({ error });
      return;
    }
    const result = await beauty.search({
      query: query.value,
      brandId: brand.value,
      refresh: req.query.refresh === "1",
    });
    let total = 0;
    const sourced = [];
    const products = result.groups.flatMap((group) => {
      const inStep = step.value
        ? group.products.filter((product) => matchesStep(product, step.value))
        : group.products;
      const matched = orderProducts(inStep, sort.value).map((product) => {
        const card = present(product);
        return { card, source: product };
      }).filter(({ card }) => (
        (!concern.value || card.concernIds.includes(concern.value))
        && (!skin.value || card.skinTypeIds.includes(skin.value))
      ));
      total += matched.length;
      sourced.push(...matched.map(({ source }) => source));
      return matched.map(({ card }) => card);
    });
    res.setHeader("X-Cache", result.cache);
    res.json({
      server: serverId,
      cache: result.cache,
      guidance: GUIDANCE[step.value] || "",
      warning: compatibilityNote(sourced),
      brand: brand.value === "all"
        ? { id: "all", label: "All brands" }
        : { id: brand.value, label: BRANDS.find((item) => item.id === brand.value).label },
      step: step.value,
      total,
      products,
      gaps: result.groups.filter((group) => group.error).map((group) => group.label),
    });
  }));

  app.get("/api/products/:code", route(async (req, res) => {
    if (tooMany(req, res)) return;
    res.setHeader("Cache-Control", "no-store");
    const code = parseCode(req.params.code);
    if (code.error) {
      res.status(400).json({ error: code.error });
      return;
    }
    const result = await beauty.product(code.value);
    res.setHeader("X-Cache", result.cache);
    res.json({ server: serverId, product: presentDetail(result.product) });
  }));

  app.use("/api", (req, res) => {
    res.status(404).json({ error: "Not found." });
  });

  app.use(express.static(publicDir, { index: "index.html", maxAge: 0 }));
  app.use((req, res) => {
    res.status(404).type("text/plain").send("Not found.\n");
  });

  return app;
}
