import {
  ceraveProductUrls,
  ingredientsFromOfficialHtml,
  ingredientsFromOrdinaryHtml,
  keyNamesFromFixderma,
  productFromCeravePage,
  productsFromLrpSitemap,
  productsFromOrdinaryGrid,
} from "./official.js";
import { BRANDS, brandById, brandIdFor } from "./validate.js";

const OBF = "https://world.openbeautyfacts.org";
const SHOPS = {
  biobalance: { host: "biobalance.co.uk", prefix: "bb", label: "Biobalance" },
  fixderma: { host: "www.fixderma.com", prefix: "fx", label: "Fixderma" },
  skin1004: { host: "skin1004.com", prefix: "sk", label: "SKIN1004" },
};

function clean(value, max = 500) {
  if (typeof value !== "string") return "";
  return value
    .replace(/&nbsp;?/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[\u0000-\u001F\u007F<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function safeImage(value) {
  if (typeof value !== "string") return "";
  const withProtocol = value.startsWith("//") ? `https:${value}` : value;
  try {
    const url = new URL(withProtocol);
    const allowed = [
      "images.openbeautyfacts.org",
      "cdn.shopify.com",
      "www.cerave.com",
      "theordinary.com",
      "www.laroche-posay.be",
    ].includes(url.hostname);
    if (url.protocol !== "https:" || !allowed) return "";
    return url.toString();
  } catch {
    return "";
  }
}

export function mentions(ingredients) {
  const text = ingredients.toLowerCase();
  const notes = [];
  if (/\bparfum\b|\bfragrance\b|\baroma\b/.test(text)) {
    notes.push("Fragrance is listed. Some customers ask about this.");
  }
  if (/alcohol denat|alcohol denatured|sd alcohol/.test(text)) {
    notes.push("Drying alcohol is listed.");
  }
  if (text.includes("essential oil")) {
    notes.push("An essential oil is listed.");
  }
  return notes;
}

export function plainText(html) {
  return clean(
    String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&nbsp;/g, " ")
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, " ")
      .replace(/&gt;/g, " "),
    4000,
  );
}

export function ingredientsFromText(text) {
  const match = String(text || "").match(/\bingredients?\b\s*[:\-]\s*([\s\S]+)/i);
  if (!match) return "";
  const cut = match[1].split(/\b(directions for use|how to use|what is it|backed by science|key highlights|caution)\b/i)[0];
  return clean(cut, 2500);
}

export function hasPublishedIngredients(product) {
  const status = product?.ingredientStatus;
  return (status === "complete" || status === "partial")
    && Array.isArray(product.ingredientList)
    && product.ingredientList.length > 0;
}

export function ingredientRecord(text, source = "text") {
  const marketing = /\b(what is it|how to use|this (?:cream|serum|gel|lotion|product)|provides long-lasting)\b/i;
  const raw = clean(text, 2500);
  if (!raw || marketing.test(raw)) {
    return { ingredients: "", ingredientList: [], ingredientStatus: "unverified" };
  }
  const ingredientList = partsFrom(raw).filter((part) => part.length <= 80 && !marketing.test(part));
  if (!ingredientList.length) {
    return { ingredients: "", ingredientList: [], ingredientStatus: "unverified" };
  }
  const hasBase = ingredientList.some((part) => /\b(aqua|water|eau)\b/i.test(part));
  let ingredientStatus = "partial";
  if (source === "list") ingredientStatus = "complete";
  else if (source === "key") ingredientStatus = "partial";
  else if (hasBase && ingredientList.length >= 5) ingredientStatus = "complete";
  return { ingredients: ingredientList.join(", "), ingredientList, ingredientStatus };
}

export function ingredientsFromBiobalancePage(html) {
  const blocks = String(html || "").split(/<details\b/i).slice(1);
  for (const block of blocks) {
    const title = block.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i);
    if (!title || plainText(title[1]).toLowerCase() !== "ingredients") continue;
    const content = block.match(/<div\b[^>]*accordion__content[^>]*>([\s\S]*?)<\/div>/i);
    const text = plainText(content ? content[1] : "");
    if (text.length > 8) return text;
  }
  return "";
}

function partsFrom(ingredients) {
  return ingredients
    .split(/[,;•·|]/)
    .map((part) => part.trim().replace(/\.+$/, ""))
    .filter((part) => part.length > 1)
    .slice(0, 80);
}

export function toProduct(raw, brandId) {
  const brand = brandById(brandId);
  const ingredients = clean(raw.ingredients, 2500);
  return {
    code: clean(String(raw.code || ""), 90),
    name: clean(raw.name, 140),
    brand: brand ? brand.label : "",
    brandId: brand ? brand.id : "",
    quantity: clean(raw.quantity, 40),
    image: safeImage(raw.image),
    ingredients,
    ingredientList: partsFrom(ingredients),
    mentions: mentions(ingredients),
    hasIngredients: ingredients.length > 0,
    ingredientStatus: ingredients ? ingredientRecord(ingredients, "text").ingredientStatus : "unverified",
  };
}

export function toCard(product) {
  return {
    code: product.code,
    name: product.name,
    brand: product.brand,
    brandId: product.brandId,
    quantity: product.quantity,
    image: product.image,
    hasIngredients: product.hasIngredients,
  };
}

function shopifyPack(images) {
  const list = Array.isArray(images) ? images : [];
  const src = (list.find((image) => /front|pack/i.test(image.src || "")) || list[0] || {}).src || "";
  const safe = safeImage(src);
  if (!safe.includes("cdn.shopify.com")) return safe;
  const url = new URL(safe);
  url.searchParams.set("width", "640");
  return url.toString();
}

const PAGE_HOSTS = new Set([
  "biobalance.co.uk",
  "www.cerave.com",
  "theordinary.com",
  "www.laroche-posay.be",
  "a82962.sitemaphosting.com",
  "skin1004.com",
  "www.skin1004.com",
  "www.fixderma.com",
]);

function usefulName(name, label) {
  if (!name) return false;
  return name.toLowerCase() !== label.toLowerCase();
}

function isSkincare(type, title) {
  const kind = `${type} ${title}`.toLowerCase();
  return !/\b(hair|shampoo|conditioner|brush)\b/.test(kind);
}

function upstream(message) {
  const error = new Error(message);
  error.code = "UPSTREAM";
  return error;
}

function isFoodCategory(value) {
  const text = String(value || "").toLowerCase().replace(/non[-\s]?food/g, " ");
  return /\b(food|foods|beverage|beverages|dairy|snack|snacks|drink|drinks|milk)\b/.test(text);
}

export function createBeauty({ fetchImpl = globalThis.fetch, cache = null, timeoutMs = 20000 } = {}) {
  async function getJson(url, options = {}) {
    const hit = cache?.get(url);
    if (hit) return { data: hit, cache: "HIT" };
    let lastError = upstream("A product catalogue had a problem. Try again in a moment.");
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetchImpl(url, {
          signal: AbortSignal.timeout(timeoutMs),
          headers: {
            accept: "application/json",
            "user-agent": "SkinWise/1.0 (skincare discovery; educational)",
          },
        });
        if (options.missingOn404 && response.status === 404) {
          const missing = new Error("That barcode was not found.");
          missing.code = "MISSING";
          throw missing;
        }
        if (!response.ok) {
          lastError = upstream("A product catalogue had a problem. Try again in a moment.");
        } else {
          try {
            const data = await response.json();
            cache?.set(url, data);
            return { data, cache: "MISS" };
          } catch {
            lastError = upstream("A product catalogue sent something I could not read.");
          }
        }
      } catch (error) {
        if (error?.code === "MISSING") throw error;
        lastError = error?.code === "UPSTREAM"
          ? error
          : Object.assign(new Error("A product catalogue did not answer. Try again in a moment."), { code: "TIMEOUT" });
      }
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 400));
    }
    throw lastError;
  }

  async function getText(url, options = {}) {
    const key = `text:${url}`;
    const hit = cache?.get(key);
    if (hit) return { data: hit, cache: "HIT" };
    const attempts = options.attempts || 2;
    const timeout = options.timeout || timeoutMs;
    let lastError = upstream("A brand page had a problem. Try again in a moment.");
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await fetchImpl(url, {
          signal: AbortSignal.timeout(timeout),
          headers: {
            accept: "text/html",
            "user-agent": "SkinWise/1.0 (skincare discovery; educational)",
          },
        });
        if (!response.ok) {
          lastError = upstream("A brand page had a problem. Try again in a moment.");
        } else if (response.url && !PAGE_HOSTS.has(new URL(response.url).hostname)) {
          lastError = upstream("A brand page had a problem. Try again in a moment.");
        } else {
          const data = await response.text();
          cache?.set(key, data);
          return { data, cache: "MISS" };
        }
      } catch (error) {
        lastError = error?.code === "UPSTREAM"
          ? error
          : Object.assign(new Error("A brand page did not answer. Try again in a moment."), { code: "TIMEOUT" });
      }
      if (attempt + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, 400));
    }
    throw lastError;
  }

  function fromObf(raw) {
    const categories = `${raw.categories || ""} ${Array.isArray(raw.categories_tags) ? raw.categories_tags.join(" ") : ""}`;
    if (isFoodCategory(categories)) return null;
    const brandId = brandIdFor(raw.brands);
    if (!brandId) return null;
    const brand = brandById(brandId);
    const product = toProduct({
      code: raw.code,
      name: raw.product_name,
      quantity: raw.quantity,
      image: raw.image_front_small_url,
      ingredients: raw.ingredients_text,
    }, brandId);
    if (!usefulName(product.name, brand.label)) return null;
    product.source = "openbeautyfacts";
    if (/^\d{6,20}$/.test(String(product.code || ""))) {
      product.pageUrl = `https://world.openbeautyfacts.org/product/${product.code}`;
    }
    return product;
  }

  function fromShop(raw, brandId) {
    const shop = SHOPS[brandId];
    const handle = clean(String(raw.handle || ""), 80).toLowerCase();
    if (!/^[a-z0-9-]{3,80}$/.test(handle)) return null;
    if (!isSkincare(raw.product_type, raw.title)) return null;
    if (brandIdFor(raw.vendor) !== brandId && brandIdFor(raw.title) !== brandId) return null;
    const text = plainText(raw.body_html);
    const variant = Array.isArray(raw.variants) ? raw.variants[0] : null;
    const size = variant && variant.title && variant.title !== "Default Title" ? variant.title : "";
    const image = shopifyPack(raw.images);
    const listed = ingredientRecord(ingredientsFromText(text), "text");
    const product = toProduct({
      code: `${shop.prefix}-${handle}`,
      name: raw.title,
      quantity: size,
      image,
      ingredients: listed.ingredients,
    }, brandId);
    product.ingredientStatus = listed.ingredientStatus;
    if (!usefulName(product.name, shop.label)) return null;
    product.claimText = text.slice(0, 1600);
    product.description = text.slice(0, 320);
    product.pageUrl = `https://${shop.host}/products/${handle}`;
    return product;
  }

  async function searchObf(brand, query) {
    const url = new URL("/cgi/search.pl", OBF);
    url.searchParams.set("search_terms", query ? `${brand.search} ${query}` : brand.search);
    url.searchParams.set("search_simple", "1");
    url.searchParams.set("action", "process");
    url.searchParams.set("json", "1");
    url.searchParams.set("page_size", "24");
    const { data, cache: cacheStatus } = await getJson(url.toString());
    const products = (Array.isArray(data.products) ? data.products : [])
      .map(fromObf)
      .filter((product) => product && product.brandId === brand.id);
    return { products, cache: cacheStatus };
  }

  async function shopProducts(brandId) {
    const shop = SHOPS[brandId];
    const pages = [];
    for (let page = 1; page <= 2; page += 1) {
      const url = new URL("/products.json", `https://${shop.host}`);
      url.searchParams.set("limit", "250");
      url.searchParams.set("page", String(page));
      try {
        const loaded = await getJson(url.toString());
        pages.push(loaded);
        if ((loaded.data.products || []).length < 250) break;
      } catch (error) {
        if (page === 1) throw error;
      }
    }
    const seen = new Set();
    const products = [];
    for (const page of pages) {
      for (const raw of page.data.products || []) {
        const product = fromShop(raw, brandId);
        if (!product || seen.has(product.code)) continue;
        seen.add(product.code);
        products.push(product);
      }
    }
    const cacheStatus = pages.some((page) => page.cache === "MISS") ? "MISS" : "HIT";
    const enriched = await pool(products, 8, (product) => enrichShop(product, brandId));
    return { products: enriched.filter(Boolean), cache: cacheStatus };
  }

  async function enrichShop(product, brandId) {
    if (!product?.pageUrl || product.ingredientStatus === "complete" || product.ingredientStatus === "partial") return product;
    try {
      const html = await getText(product.pageUrl, { timeout: 12000, attempts: 1 });
      if (brandId === "biobalance") {
        return applyRecord(product, ingredientsFromBiobalancePage(html.data), "list");
      }
      if (brandId === "fixderma") {
        const names = keyNamesFromFixderma(html.data);
        return names.length ? applyRecord(product, names.join(", "), "key") : product;
      }
      const line = ingredientsFromText(plainText(html.data));
      return applyRecord(product, line, "text");
    } catch {
      return product;
    }
  }

  function applyRecord(product, text, source) {
    const record = ingredientRecord(text, source);
    if (record.ingredientStatus === "unverified") return product;
    const next = { ...product, ...record, hasIngredients: true, mentions: mentions(record.ingredients) };
    return next;
  }

  function matchesQuery(product, query) {
    const needle = String(query || "").trim().toLowerCase();
    if (!needle) return true;
    const haystack = [
      product.name,
      product.brand,
      product.ingredients,
      ...(product.ingredientList || []),
    ].join(" ").toLowerCase();
    return haystack.includes(needle);
  }

  const catalogue = new Map();
  const CATALOGUE_TTL = 10 * 60 * 1000;

  function remember(key, loader) {
    const hit = catalogue.get(key);
    if (hit?.value && Date.now() < hit.expires) return Promise.resolve({ ...hit.value, cache: "HIT" });
    if (hit?.pending) return hit.pending;
    const pending = Promise.resolve().then(loader).then((value) => {
      const current = catalogue.get(key);
      if (!current || current.pending === pending) {
        catalogue.set(key, { value, expires: Date.now() + CATALOGUE_TTL });
      }
      return { ...value, cache: value.cache || "MISS" };
    }).catch((error) => {
      const current = catalogue.get(key);
      if (current?.pending === pending) catalogue.delete(key);
      throw error;
    });
    catalogue.set(key, { pending, expires: 0 });
    return pending;
  }

  async function searchShop(brand, query) {
    const loaded = await remember(`shop:${brand.id}`, () => shopProducts(brand.id));
    const products = loaded.products.filter((product) => matchesQuery(product, query));
    return { products, cache: loaded.cache };
  }

  async function pool(items, limit, fn) {
    const results = new Array(items.length);
    let next = 0;
    async function worker() {
      while (next < items.length) {
        const current = next;
        next += 1;
        try {
          results[current] = await fn(items[current]);
        } catch {
          results[current] = null;
        }
      }
    }
    const workers = Math.min(limit, items.length);
    if (workers > 0) await Promise.all(Array.from({ length: workers }, () => worker()));
    return results;
  }

  function withIngredients(product, ingredients) {
    const next = toProduct({
      code: product.code,
      name: product.name,
      quantity: product.quantity,
      image: product.image,
      ingredients: ingredients || "",
    }, product.brandId);
    next.pageUrl = product.pageUrl;
    next.description = product.description || "";
    next.claimText = product.claimText || product.description || "";
    if (product.ingredientStatus) next.ingredientStatus = product.ingredientStatus;
    return next;
  }

  async function readPageList(product, read) {
    if (!product?.pageUrl || product.ingredientStatus === "complete") return product;
    try {
      const html = await getText(product.pageUrl, { timeout: 12000, attempts: 1 });
      const text = read(html.data);
      const record = ingredientRecord(text, "list");
      if (record.ingredientStatus === "unverified") return product;
      return { ...product, ...record, hasIngredients: true };
    } catch {
      return product;
    }
  }

  async function loadOrdinary() {
    const pages = [];
    const grids = await Promise.all([0, 60, 120, 180].map(async (start) => {
      const url = new URL("https://theordinary.com/on/demandware.store/Sites-deciem-us-Site/en_US/Search-UpdateGrid");
      url.searchParams.set("cgid", "theordinary-skincare");
      url.searchParams.set("start", String(start));
      url.searchParams.set("sz", "60");
      const html = await getText(url.toString());
      return productsFromOrdinaryGrid(html.data);
    }));
    grids.forEach((found) => pages.push(...found));
    const seen = new Set();
    const unique = pages.filter((product) => {
      if (seen.has(product.code)) return false;
      seen.add(product.code);
      return true;
    });
    return pool(unique, 8, (product) => readPageList(product, ingredientsFromOrdinaryHtml));
  }

  async function loadCerave() {
    const index = await getText("https://a82962.sitemaphosting.com/4034207/sitemap.xml");
    const urls = ceraveProductUrls(index.data);
    const pages = await pool(urls, 8, async (pageUrl) => {
      const html = await getText(pageUrl, { timeout: 12000, attempts: 1 });
      return productFromCeravePage(html.data, pageUrl);
    });
    return pages.filter(Boolean).map((product) => withIngredients(product, product.ingredients));
  }

  async function loadLaroche() {
    const xml = await getText("https://www.laroche-posay.be/sitemap-image.xml");
    const products = productsFromLrpSitemap(xml.data);
    return pool(products, 8, (product) => readPageList(product, ingredientsFromOfficialHtml));
  }

  function officialBundle(brandId) {
    return remember(`official:${brandId}`, async () => {
      const products = brandId === "ordinary"
        ? await loadOrdinary()
        : brandId === "cerave"
          ? await loadCerave()
          : await loadLaroche();
      return { products: products.map((product) => withIngredients({ ...product, brandId }, product.ingredients)) };
    });
  }

  async function officialProducts(brandId) {
    return (await officialBundle(brandId)).products;
  }

  async function searchOfficial(brand, query) {
    const loaded = await officialBundle(brand.id);
    const products = loaded.products.filter((product) => matchesQuery(product, query));
    return { products, cache: loaded.cache };
  }

  async function searchOne(brand, query) {
    if (brand.source === "shopify") return searchShop(brand, query);
    if (brand.source === "official") return searchOfficial(brand, query);
    return searchObf(brand, query);
  }

  return {
    async search({ query, brandId, refresh = false }) {
      if (refresh) {
        const ids = brandId === "all" ? BRANDS.map((item) => item.id) : [brandId];
        ids.forEach((id) => {
          catalogue.delete(`shop:${id}`);
          catalogue.delete(`official:${id}`);
        });
      }
      const selected = brandId === "all" ? BRANDS : [brandById(brandId)];
      const settled = await Promise.all(selected.map(async (brand) => {
        try {
          const result = await searchOne(brand, query);
          return { brand, ...result, error: "" };
        } catch (error) {
          return { brand, products: [], cache: "MISS", error: error.message || "This brand did not load." };
        }
      }));
      if (settled.every((item) => item.error)) {
        const error = new Error(settled[0].error);
        error.code = "UPSTREAM";
        throw error;
      }
      const cacheStatus = settled.some((item) => item.cache === "MISS") ? "MISS" : "HIT";
      return {
        groups: settled.map((item) => ({
          id: item.brand.id,
          label: item.brand.label,
          products: item.products,
          error: item.error,
        })),
        cache: cacheStatus,
      };
    },
    async product(code) {
      if (/^\d+$/.test(code)) {
        const url = new URL(`/api/v2/product/${code}`, OBF);
        const { data, cache: cacheStatus } = await getJson(url.toString(), { missingOn404: true });
        if (!data?.product) {
          const error = new Error("That barcode was not found.");
          error.code = "MISSING";
          throw error;
        }
        const product = fromObf(data.product);
        if (!product) {
          const categories = `${data.product.categories || ""} ${Array.isArray(data.product.categories_tags) ? data.product.categories_tags.join(" ") : ""}`;
          const outsideBrand = !brandIdFor(data.product.brands);
          const message = outsideBrand
            ? "That product is not one of the brands on SkinWise."
            : isFoodCategory(categories)
              ? "That product is not in the SkinWise catalogues."
              : "That product is not one of the brands on SkinWise.";
          const error = new Error(message);
          error.code = "MISSING";
          throw error;
        }
        return { product, cache: cacheStatus };
      }
      const prefix = code.startsWith("lrp-") ? "lrp" : code.slice(0, 2);
      if (prefix === "to" || prefix === "cv" || prefix === "lrp") {
        const brandId = prefix === "to" ? "ordinary" : prefix === "cv" ? "cerave" : "laroche";
        const list = await officialProducts(brandId);
        const index = list.findIndex((item) => item.code === code);
        const found = list[index];
        if (!found) {
          const error = new Error("That product is not one of the brands on SkinWise.");
          error.code = "MISSING";
          throw error;
        }
        if (found.ingredientStatus !== "complete" && found.pageUrl) {
          const html = await getText(found.pageUrl, { timeout: 12000, attempts: 1 });
          const text = brandId === "ordinary"
            ? ingredientsFromOrdinaryHtml(html.data) || ingredientsFromOfficialHtml(html.data)
            : ingredientsFromOfficialHtml(html.data);
          const record = ingredientRecord(text, "list");
          const filled = record.ingredientStatus === "unverified"
            ? found
            : withIngredients({ ...found, ingredientStatus: "complete" }, record.ingredients);
          if (index >= 0) list[index] = filled;
          return { product: filled, cache: html.cache };
        }
        return { product: found, cache: "HIT" };
      }
      const brandId = Object.keys(SHOPS).find((id) => SHOPS[id].prefix === prefix);
      const loaded = await remember(`shop:${brandId}`, () => shopProducts(brandId));
      const cached = loaded.products.find((item) => item.code === code);
      if (cached) return { product: cached, cache: loaded.cache };
      const handle = code.slice(prefix.length + 1);
      const shop = SHOPS[brandId];
      const url = new URL(`/products/${handle}.json`, `https://${shop.host}`);
      const { data, cache: cacheStatus } = await getJson(url.toString());
      const product = data.product ? fromShop(data.product, brandId) : null;
      if (!product) {
        const error = new Error("That product is not one of the brands on SkinWise.");
        error.code = "MISSING";
        throw error;
      }
      if (product.ingredientStatus !== "complete") {
        const page = new URL(`/products/${handle}`, `https://${shop.host}`);
        try {
          const html = await getText(page.toString());
          const names = brandId === "fixderma" ? keyNamesFromFixderma(html.data) : [];
          const text = brandId === "biobalance"
            ? ingredientsFromBiobalancePage(html.data)
            : names.length ? names.join(", ") : ingredientsFromText(plainText(html.data));
          const source = brandId === "biobalance" ? "list" : names.length ? "key" : "text";
          const record = ingredientRecord(text, source);
          if (record.ingredientStatus !== "unverified") {
            Object.assign(product, record, { hasIngredients: true, mentions: mentions(record.ingredients) });
          }
          return { product, cache: html.cache === "HIT" && cacheStatus === "HIT" ? "HIT" : "MISS" };
        } catch {
          return { product, cache: cacheStatus };
        }
      }
      return { product, cache: cacheStatus };
    },
  };
}
