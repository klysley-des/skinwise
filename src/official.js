const CERVE_SKIP = new Set([
  "facial-cleansers",
  "body-cleansers",
  "body-moisturizers",
  "facial-moisturizers",
  "eye-creams",
  "foaming-facial-cleansers",
  "gel-facial-cleansers",
  "cream-facial-cleansers",
]);

function decode(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function absolute(origin, value) {
  if (!value) return "";
  try {
    return new URL(value, origin).toString();
  } catch {
    return "";
  }
}

function tidyIngredients(value) {
  return value
    .split(/Évite|Please be aware|Voir la|Consulter|Directions for/i)[0]
    .replace(/[,;\s]+$/, "")
    .trim();
}

export function ingredientsFromOfficialHtml(html) {
  const source = String(html || "");
  const json = source.match(/"name"\s*:\s*"Ingredients"\s*,\s*"value"\s*:\s*"((?:\\.|[^"\\])*)"/i);
  if (json) {
    const value = tidyIngredients(json[1].replace(/\\"/g, '"').replace(/\\\//g, "/").replace(/\\u0026/g, "&"));
    if (value.length > 12) return value;
  }
  const block = source.match(/ingredients-details__content[\s\S]{0,2500}/i);
  const scoped = block ? block[0] : source;
  const text = scoped
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
  const labelled = text.match(/\bIngredients\b\s*[:\-]?\s*((?:Aqua|AQUA|Water)\b[^.]{10,2200})/i);
  if (labelled) return tidyIngredients(labelled[1]);
  const aqua = text.match(/\b((?:Aqua|AQUA)\s*\/\s*Water\s*\/\s*Eau\b[^.]{10,2200})/i);
  return aqua ? tidyIngredients(aqua[1]) : "";
}

export function ingredientsFromOrdinaryHtml(html) {
  const match = String(html || "").match(/data-original-ingredients="([^"]*)"/i);
  if (!match) return "";
  return tidyIngredients(decode(match[1]));
}

export function keyNamesFromFixderma(html) {
  const names = [];
  for (const block of String(html || "").match(/<ul class="ingredients_stl">([\s\S]*?)<\/ul>/gi) || []) {
    for (const heading of block.matchAll(/<h3>([\s\S]*?)<\/h3>/gi)) {
      const name = decode(heading[1]).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (name && name.length <= 60 && !names.includes(name)) names.push(name);
    }
  }
  return names;
}

export function productsFromOrdinaryGrid(html) {
  const products = [];
  const seen = new Set();
  for (const tile of String(html || "").split("product-grid-item").slice(1)) {
    const raw = tile.match(/data-gtm-enhanced-ecommerce="([^"]+)"/);
    const href = tile.match(/href="(\/en-us\/[a-z0-9-]+\.html)"/);
    if (!raw || !href) continue;
    let data;
    try {
      data = JSON.parse(decode(raw[1]));
    } catch {
      continue;
    }
    if (!data || typeof data !== "object") continue;
    const name = String(data.name || "").replace(/\s+/g, " ").trim();
    const slug = href[1].slice(7, -5);
    if (!name || !/^[a-z0-9-]{3,140}$/.test(slug) || seen.has(slug)) continue;
    if (/\b(hair|shampoo|foundation|concealer)\b/i.test(name)) continue;
    const images = [...tile.matchAll(/https:\/\/theordinary\.com\/dw\/image\/[^"&\s]+/g)].map((match) => match[0]);
    const pack = images.find((url) => !/application|model|icon|award/i.test(url)) || images[0];
    if (!pack) continue;
    seen.add(slug);
    const image = `${pack.split("?")[0]}?sw=800&sh=800&sm=fit`;
    products.push({
      code: `to-${slug}`,
      name,
      quantity: String(data.variant || "").trim(),
      image,
      pageUrl: `https://theordinary.com${href[1]}`,
    });
  }
  return products;
}

export function ceraveProductUrls(xml) {
  const locs = [...String(xml || "").matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => decode(match[1].trim()));
  return locs.filter((url) => {
    try {
      const path = new URL(url).pathname;
      if (new URL(url).hostname !== "www.cerave.com" || !path.startsWith("/skincare/")) return false;
      const parts = path.split("/").filter(Boolean);
      if (parts.length < 3) return false;
      const last = parts[parts.length - 1];
      if (CERVE_SKIP.has(last)) return false;
      if (last.includes("-for-")) return false;
      return true;
    } catch {
      return false;
    }
  });
}

export function productFromCeravePage(html, pageUrl) {
  let slug = "";
  try {
    slug = new URL(pageUrl).pathname.split("/").filter(Boolean).pop();
  } catch {
    return null;
  }
  if (!/^[a-z0-9-]{3,140}$/.test(slug)) return null;
  for (const block of String(html || "").matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let data;
    try {
      data = JSON.parse(block[1]);
    } catch {
      continue;
    }
    if (!data || data["@type"] !== "Product" || !data.name) continue;
    const images = (Array.isArray(data.image) ? data.image : [data.image]).filter(Boolean);
    const front = images.find((url) => /front/i.test(url)) || images[0];
    const image = absolute("https://www.cerave.com", front);
    if (!image.startsWith("https://www.cerave.com/")) continue;
    const description = typeof data.description === "string"
      ? decode(decode(data.description)).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      : "";
    return {
      code: `cv-${slug}`,
      name: String(data.name).replace(/\s+/g, " ").trim(),
      quantity: "",
      image,
      ingredients: ingredientsFromOfficialHtml(html),
      description,
      pageUrl,
    };
  }
  return null;
}

export function productsFromLrpSitemap(xml) {
  const products = [];
  const seen = new Set();
  for (const block of String(xml || "").split("<url>").slice(1)) {
    const page = (block.match(/<loc>(.*?)<\/loc>/) || [])[1];
    if (!page || !page.includes("laroche-posay.be")) continue;
    const slug = decode(page).split("/").pop();
    if (!/^[a-z0-9-]{3,140}$/.test(slug) || seen.has(slug)) continue;
    const title = decode((block.match(/<image:title>(.*?)<\/image:title>/) || [])[1] || "");
    const name = title
      .replace(/^La\s*Roche\s*[- ]?Posay\s*/i, "")
      .replace(/Product\s*-?\s*Page\s*/i, "")
      .replace(/[_-]+/g, " ")
      .replace(/^\d{3,}\s+/, "")
      .replace(/\s+\d{5,}.*$/, "")
      .replace(/\bpackshot\b.*$/i, "")
      .replace(/\s+(?:FR|BE|FSS)$/i, "")
      .replace(/^lrp\s+/i, "")
      .replace(/\s+/g, " ")
      .trim();
    const images = [...block.matchAll(/<image:loc>(.*?)<\/image:loc>/g)].map((match) => decode(match[1]));
    const front = images.find((url) => /front\.(?:png|jpe?g|webp)/i.test(url)) || images[0];
    if (!front || !/[A-Za-z]{4,}/.test(name)) continue;
    if (/\b(shampoo|shampoing|hair|dandruff|antipelliculaire|mascara|pencil|powder|makeup|make up|teint|vernis|lipstick|deodorant)\b/i.test(`${name} ${slug}`)) continue;
    seen.add(slug);
    products.push({
      code: `lrp-${slug}`,
      name,
      quantity: "",
      image: absolute("https://www.laroche-posay.be", front),
      pageUrl: decode(page),
    });
  }
  return products;
}
