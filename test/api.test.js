import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { createApp } from "../src/app.js";
import { ingredientListed } from "../src/guide.js";
import { compatibilityNote, matchesStep } from "../src/routine.js";
import { ingredientsFromOfficialHtml, ingredientsFromOrdinaryHtml, keyNamesFromFixderma, productsFromLrpSitemap } from "../src/official.js";
import { ingredientRecord } from "../src/beauty.js";
import { traits } from "../src/traits.js";
import { parseCode } from "../src/validate.js";

function shop(title, handle, body) {
  return { products: [{ title, handle, body_html: body, vendor: title.split(" ")[0], images: [{ src: "https://cdn.shopify.com/s/files/1/1/1/products/front.jpg" }] }] };
}

describe("names", () => {
  it("drops the barcode and packshot words from a La Roche-Posay title", () => {
    const xml = `<url><loc>https://www.laroche-posay.be/anthelios-uvmune</loc><image:title>4341_Anthelios Uvmune 400 50 hydrating cream_FR</image:title><image:loc>https://www.laroche-posay.be/img/front.png</image:loc></url>`;
    const [product] = productsFromLrpSitemap(xml);
    assert.equal(product.name, "Anthelios Uvmune 400 50 hydrating cream");
  });
});

describe("official ingredient fields", () => {
  it("reads published lists and ignores marketing copy", () => {
    assert.match(ingredientsFromOrdinaryHtml('<p data-original-ingredients="Aqua (Water), Niacinamide, Zinc PCA."></p>'), /Niacinamide/);
    assert.equal(ingredientRecord("What is it? A rich cream that provides long-lasting hydration.", "text").ingredientStatus, "unverified");
    assert.equal(ingredientRecord("Aqua, Niacinamide, Glycerin, Pentylene Glycol, Phenoxyethanol", "list").ingredientStatus, "complete");
    assert.deepEqual(keyNamesFromFixderma('<ul class="ingredients_stl"><li><h3>Retinol</h3> studied</li><li><h3>Hyaluronic Acid</h3></li></ul>'), ["Retinol", "Hyaluronic Acid"]);
    const cerave = '<div class="ingredients-details__content"><p>Aqua / Water / Eau, Glycerin, Ceramide NP, Niacinamide, Phenoxyethanol.</p></div>';
    assert.match(ingredientsFromOfficialHtml(cerave), /Niacinamide/);
    const lrp = '{"name":"Ingredients","value":"AQUA / WATER / EAU, NIACINAMIDE, GLYCERIN, SALICYLIC ACID"}';
    assert.match(ingredientsFromOfficialHtml(lrp), /NIACINAMIDE/);
  });
});

describe("ingredient lists", () => {
  it("matches only the published ingredient parts", () => {
    assert.equal(ingredientListed({ ingredientList: ["Aqua", "Niacinamide", "Glycerin"] }, "niacinamide"), true);
    assert.equal(ingredientListed({ name: "Niacinamide serum", ingredientList: ["Aqua", "Glycerin"] }, "niacinamide"), false);
    assert.equal(ingredientListed({ ingredientList: ["Retinyl Palmitate", "Aqua"] }, "retinol"), false);
    assert.equal(ingredientListed({ ingredientList: ["Retinol", "Caprylic/Capric Triglyceride"] }, "retinol"), true);
    assert.equal(ingredientListed({ ingredientList: ["Sodium Hyaluronate"] }, "hyaluronic"), true);
    assert.equal(ingredientListed({ ingredientList: ["Madecassoside", "Aqua"] }, "centella"), false);
    assert.equal(ingredientListed({ ingredientList: ["Centella Asiatica Extract"] }, "centella"), true);
    assert.equal(ingredientListed({ ingredientList: ["Ceramide NP", "Cholesterol"] }, "ceramides"), true);
    assert.equal(ingredientListed({ ingredientList: ["Glycol", "Glycerin"] }, "glycolic"), false);
    assert.equal(ingredientListed({ ingredientList: ["Glycolic Acid"] }, "glycolic"), true);
    assert.equal(ingredientListed({ ingredientList: [] }, "salicylic"), false);
    assert.equal(ingredientListed({
      ingredientList: ["A long marketing sentence about how this cream is different from one that uses niacinamide for oil control and then continues with more description."],
    }, "niacinamide"), false);
  });
});

describe("routine steps", () => {
  it("uses the product name and skips hair products", () => {
    assert.equal(matchesStep({ name: "Hydrating Facial Cleanser" }, "cleanse"), true);
    assert.equal(matchesStep({ name: "Hydrating Facial Cleanser" }, "moisturise"), false);
    assert.equal(matchesStep({ name: "Acne Treatment Cleanser" }, "treat"), false);
    assert.equal(matchesStep({ name: "Pure Vitamin C Super Serum" }, "treat"), true);
    assert.equal(matchesStep({ name: "Moisturizing Serum" }, "moisturise"), false);
    assert.equal(matchesStep({ name: "Daily Moisturizing Lotion" }, "moisturise"), true);
    assert.equal(matchesStep({ name: "Daily Moisturizing Lotion" }, "sunscreen"), false);
    assert.equal(matchesStep({ name: "Anthelios UVMune SPF 50" }, "sunscreen"), true);
    assert.equal(matchesStep({ name: "Anthelios UVMune SPF 50" }, "moisturise"), false);
    assert.equal(matchesStep({ name: "Daily Moisturizing Lotion" }, "evening"), true);
    assert.equal(matchesStep({ name: "Anthelios UVMune SPF 50" }, "evening"), false);
    assert.equal(matchesStep({ name: "Anthelios UVMune SPF 50" }, "morning"), true);
    assert.equal(matchesStep({ name: "Gentle Hydrating Shampoo" }, "cleanse"), false);
    assert.equal(matchesStep({ name: "Cleansing Serum" }, "cleanse"), false);
    assert.equal(matchesStep({ name: "Cleansing Serum" }, "treat"), true);
    assert.equal(matchesStep({ name: "Foaming Cream Cleanser" }, "cleanse"), true);
    assert.equal(matchesStep({ name: "Foaming Cream Cleanser" }, "moisturise"), false);
    assert.equal(matchesStep({ name: "Moisturizing Treatment Cream" }, "treat"), false);
    assert.equal(matchesStep({ name: "Moisturizing Treatment Cream" }, "moisturise"), true);
    assert.equal(matchesStep({ name: "Barrier Repair Treatment" }, "treat"), true);
    assert.equal(matchesStep({ name: "Gentle Hydrating Shampoo" }, "morning"), false);
    const note = compatibilityNote([
      { ingredientList: ["Aqua", "Retinol"] },
      { ingredientList: ["Aqua", "Glycolic Acid"] },
    ]);
    assert.match(note, /retinol/i);
    assert.equal(compatibilityNote([{ ingredientList: ["Aqua", "Glycerin"] }]), "");
  });
});

describe("traits", () => {
  it("reads concerns from the product words only", () => {
    const info = traits("Centella soothing cream", "For sensitive and dry skin.");
    assert.deepEqual(info.concerns, ["dry", "sensitive"]);
    assert.deepEqual(info.concernLabels, ["Dry skin", "Sensitive skin"]);
    assert.ok(info.skinTypes.includes("dry"));
    assert.deepEqual(traits("Niacinamide serum", "Aqua, Niacinamide, Glycerin").concerns, []);
    assert.deepEqual(traits("Dry Touch Sun Fluid SPF 50+", "A lightweight sunscreen.").skinTypes, []);
    assert.deepEqual(traits("Foaming cleanser", "For oily and acne-prone skin.").concernLabels, ["Acne and breakouts", "Oily skin"]);
    assert.deepEqual(traits("Gel", "Suitable for dry, combination and oily skin.").skinTypes.sort(), ["combination", "dry", "oily"]);
  });
});

const realFetch = globalThis.fetch;

describe("api", () => {
  it("filters a concern and serves health", async () => {
    globalThis.fetch = async (url, options) => {
      const href = String(url);
      if (href.startsWith("http://127.0.0.1") || href.startsWith("http://localhost")) return realFetch(url, options);
      if (href.includes("skin1004.com")) return json(shop("SKIN1004 Centella soothing cream", "centella-cream", "For sensitive skin. Ingredients: Aqua, Centella Asiatica Extract, Glycerin, Niacinamide, Phenoxyethanol."));
      if (href.includes("biobalance.co.uk")) return json(shop("Biobalance Snail cream", "snail-cream", "Aqua, Glycerin"));
      if (href.includes("fixderma.com")) return json(shop("Fixderma gel", "gel", "Aqua"));
      if (href.includes("Search-UpdateGrid")) return text("");
      if (href.includes("cerave.com/sitemap")) return text("<urlset></urlset>");
      if (href.includes("laroche-posay.be/sitemap")) return text("<urlset></urlset>");
      return text("", 404);
    };
    const app = createApp({ serverId: "test" });
    const health = await request(app, "/api/health");
    assert.equal(health.status, 200);
    assert.equal(health.body.service, "skinwise");
    const alias = await request(app, "/health");
    assert.equal(alias.body.status, "ok");
    const hidden = await request(app, "/api/products?brand=biobalance");
    assert.equal(hidden.status, 200);
    assert.equal(hidden.body.products.length, 1);
    assert.equal(hidden.body.products[0].name, "Biobalance Snail cream");
    const products = await request(app, "/api/products?brand=skin1004&concern=sensitive");
    assert.equal(products.status, 200);
    assert.equal(products.body.products.length, 1);
    assert.equal(products.body.products[0].link, "https://skin1004.com/products/centella-cream");
    const bad = await request(app, "/api/products?concern=nope");
    assert.equal(bad.status, 400);
    globalThis.fetch = realFetch;
  });
});

function json(body) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}
function text(body, status = 200) {
  return new Response(body, { status, headers: { "content-type": "text/plain" } });
}
describe("filters", () => {
  it("combines brand, skin type, ingredient search, and routine", async () => {
    globalThis.fetch = async (url, options) => {
      const href = String(url);
      if (href.startsWith("http://127.0.0.1") || href.startsWith("http://localhost")) return realFetch(url, options);
      if (href.includes("biobalance.co.uk")) return json(shop("Biobalance Barrier cream", "barrier-cream", "Ingredients: Aqua, Niacinamide, Glycerin. For dry skin."));
      if (href.includes("fixderma.com")) return json(shop("Fixderma Sun Fluid SPF 50", "sun-fluid", "Ingredients: Aqua, Glycolic Acid."));
      if (href.includes("skin1004.com")) return json(shop("SKIN1004 Centella serum", "centella-serum", "Ingredients: Aqua, Retinol."));
      if (href.includes("Search-UpdateGrid")) return text("");
      if (href.includes("sitemap")) return text("<urlset></urlset>");
      return text("", 404);
    };
    const app = createApp({ serverId: "test" });
    const brand = await request(app, "/api/products?brand=biobalance");
    assert.equal(brand.status, 200);
    assert.equal(brand.body.products.length, 1);
    assert.equal(brand.body.products[0].brand, "Biobalance");
    const skin = await request(app, "/api/products?brand=biobalance&skin=dry");
    assert.equal(skin.body.products.length, 1);
    const otherSkin = await request(app, "/api/products?brand=fixderma&skin=dry");
    assert.equal(otherSkin.status, 200);
    assert.equal(otherSkin.body.products.length, 0);
    const search = await request(app, "/api/products?q=niacinamide");
    assert.equal(search.body.products.length, 1);
    assert.equal(search.body.products[0].brand, "Biobalance");
    const byBrand = await request(app, "/api/products?q=fixderma");
    assert.equal(byBrand.body.products.length, 1);
    assert.equal(byBrand.body.products[0].brand, "Fixderma");
    const sunscreen = await request(app, "/api/products?step=sunscreen");
    assert.equal(sunscreen.body.products.length, 1);
    assert.match(sunscreen.body.guidance, /sunscreen/i);
    const morning = await request(app, "/api/products?step=morning");
    assert.ok(morning.body.products.length >= 2);
    assert.match(morning.body.warning, /retinol/i);
    assert.ok(Array.isArray(brand.body.products[0].steps));
    assert.ok(brand.body.products[0].ingredientList.includes("Niacinamide"));
    globalThis.fetch = realFetch;
  });

  it("does not call a brand catalogue again for another filter", async () => {
    let calls = 0;
    globalThis.fetch = async (url) => {
      const href = String(url);
      if (href.startsWith("http://127.0.0.1") || href.startsWith("http://localhost")) return realFetch(url);
      calls += 1;
      if (href.includes("biobalance.co.uk")) return json(shop("Biobalance Barrier cream", "barrier-cream", "Ingredients: Aqua, Niacinamide, Glycerin, Panthenol, Phenoxyethanol. For dry skin."));
      return text("", 404);
    };
    const app = createApp({ serverId: "test" });
    const first = await request(app, "/api/products?brand=biobalance");
    assert.equal(first.status, 200);
    assert.equal(first.body.products.length, 1);
    const after = calls;
    const second = await request(app, "/api/products?brand=biobalance&skin=dry&sort=za");
    assert.equal(second.body.products.length, 1);
    assert.equal(second.body.cache, "HIT");
    assert.equal(calls, after);
    globalThis.fetch = realFetch;
  });
});

describe("barcode", () => {
  it("accepts a barcode of 6 to 20 digits", () => {
    assert.equal(parseCode("123456").value, "123456");
    assert.equal(parseCode("12345678901234567890").value, "12345678901234567890");
    assert.equal(parseCode("12345").error, "That product code is not valid.");
    assert.equal(parseCode("123456789012345678901").error, "That product code is not valid.");
    assert.equal(parseCode("12345a").error, "That product code is not valid.");
    assert.equal(parseCode("12 3456").error, "That product code is not valid.");
  });

  it("looks up a barcode through the existing product endpoint", async () => {
    globalThis.fetch = async (url) => {
      const href = String(url);
      if (href.startsWith("http://127.0.0.1") || href.startsWith("http://localhost")) return realFetch(url);
      if (href.includes("/api/v2/product/3337875597207")) {
        return json({
          product: {
            code: "3337875597207",
            product_name: "CeraVe Hydrating Cleanser",
            brands: "CeraVe",
            quantity: "236 ml",
            ingredients_text: "Aqua, Glycerin, Ceramide NP, Niacinamide",
            categories: "skincare",
            image_front_small_url: "https://images.openbeautyfacts.org/images/products/207/front.jpg",
          },
        });
      }
      if (href.includes("/api/v2/product/0000000000000")) return json({ status: 0, product: null });
      if (href.includes("/api/v2/product/1111111111111")) return json({
        product: { code: "1111111111111", product_name: "Other cream", brands: "Some Other Brand", categories: "skincare" },
      });
      if (href.includes("/api/v2/product/2222222222222")) return text("no", 503);
      return text("", 404);
    };
    const app = createApp({ serverId: "test" });
    const found = await request(app, "/api/products/3337875597207");
    assert.equal(found.status, 200);
    assert.equal(found.body.product.name, "CeraVe Hydrating Cleanser");
    assert.equal(found.body.product.brand, "CeraVe");
    assert.equal(found.body.product.code, "3337875597207");
    assert.equal(found.body.product.sourceName, "Open Beauty Facts");
    assert.equal(found.body.product.link, "https://world.openbeautyfacts.org/product/3337875597207");
    assert.match(found.body.product.ingredientNote, /Open Beauty Facts/);
    assert.notEqual(found.body.product.ingredientStatus, "complete");
    assert.ok(found.body.product.ingredientList.length > 0);
    const missing = await request(app, "/api/products/0000000000000");
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error, "That barcode was not found.");
    const otherBrand = await request(app, "/api/products/1111111111111");
    assert.equal(otherBrand.status, 404);
    assert.equal(otherBrand.body.error, "That product is not one of the brands on SkinWise.");
    const down = await request(app, "/api/products/2222222222222");
    assert.equal(down.status, 502);
    const bad = await request(app, "/api/products/123");
    assert.equal(bad.status, 400);
    globalThis.fetch = realFetch;
  });

  it("treats an Open Beauty Facts 404 as a missing barcode and does not retry it", async () => {
    let calls = 0;
    globalThis.fetch = async (url) => {
      const href = String(url);
      if (href.startsWith("http://127.0.0.1") || href.startsWith("http://localhost")) return realFetch(url);
      if (href.includes("/api/v2/product/4044044044044")) {
        calls += 1;
        return text("missing", 404);
      }
      if (href.includes("/api/v2/product/5555555555555")) throw new Error("timed out");
      return text("no", 503);
    };
    const app = createApp({ serverId: "test" });
    const missing = await request(app, "/api/products/4044044044044");
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error, "That barcode was not found.");
    assert.equal(calls, 1);
    const slow = await request(app, "/api/products/5555555555555");
    assert.equal(slow.status, 504);
    globalThis.fetch = realFetch;
  });

  it("keeps non-food cosmetics and still rejects a food category", async () => {
    globalThis.fetch = async (url) => {
      const href = String(url);
      if (href.startsWith("http://127.0.0.1") || href.startsWith("http://localhost")) return realFetch(url);
      const products = {
        "3337875597357": {
          code: "3337875597357",
          product_name: "CeraVe Schuimende Reinigingsgel",
          brands: "CeraVe",
          categories: "en:non-food-products, en:open-beauty-facts",
          categories_tags: ["en:non-food-products", "en:cleansers"],
          ingredients_text: "Aqua, Glycerin, Ceramide NP, Niacinamide, Cholesterol",
        },
        "3337875743563": {
          code: "3337875743563",
          product_name: "CeraVe Hydrating cream-to-foam cleanser",
          brands: "CeraVe",
          categories: "incorrect product type, non-food-products, open-beauty-facts, cleansers",
          categories_tags: ["en:non-food-products"],
          ingredients_text: "Aqua, Glycerin, Ceramide NP, Niacinamide, Cholesterol",
        },
        "4444444444444": {
          code: "4444444444444",
          product_name: "CeraVe snack bar",
          brands: "CeraVe",
          categories: "snacks, dairy",
          categories_tags: ["en:snacks", "en:dairy"],
          ingredients_text: "Milk, Sugar",
        },
        "6666666666666": {
          code: "6666666666666",
          product_name: "CeraVe Hydrating Cleanser",
          brands: "CeraVe",
          categories: "non-food-products",
          ingredients_text: "This cream keeps skin soft: Aqua, Glycerin, Niacinamide",
        },
      };
      const code = href.match(/\/api\/v2\/product\/(\d+)/)?.[1];
      if (code && products[code]) return json({ product: products[code] });
      return json({ status: 0, product: null });
    };
    const app = createApp({ serverId: "test" });
    const gel = await request(app, "/api/products/3337875597357");
    assert.equal(gel.status, 200);
    assert.equal(gel.body.product.brand, "CeraVe");
    assert.equal(gel.body.product.ingredientStatus, "partial");
    assert.match(gel.body.product.ingredientNote, /Open Beauty Facts publishes/);
    assert.equal(gel.body.product.ingredientNote.includes("did not publish"), false);
    assert.ok(gel.body.product.ingredientList.includes("Niacinamide"));
    const foam = await request(app, "/api/products/3337875743563");
    assert.equal(foam.status, 200);
    assert.equal(foam.body.product.name, "CeraVe Hydrating cream-to-foam cleanser");
    const food = await request(app, "/api/products/4444444444444");
    assert.equal(food.status, 404);
    assert.equal(food.body.error, "That product is not in the SkinWise catalogues.");
    const unpublished = await request(app, "/api/products/6666666666666");
    assert.equal(unpublished.status, 200);
    assert.deepEqual(unpublished.body.product.ingredientList, []);
    assert.deepEqual(unpublished.body.product.keyActives, []);
    assert.match(unpublished.body.product.ingredientNote, /did not publish/);
    globalThis.fetch = realFetch;
  });
});

describe("slides", () => {
  it("lists photographs from the slides folder in name order", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "skinwise-"));
    mkdirSync(path.join(dir, "images"));
    writeFileSync(path.join(dir, "images", "02-biobalance.jpg"), "b");
    writeFileSync(path.join(dir, "images", "01-cerave.png"), "c");
    writeFileSync(path.join(dir, "images", "notes.txt"), "skip");
    const app = createApp({ serverId: "test", publicDir: dir });
    const response = await request(app, "/api/slides");
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.slides, [
      { src: "/images/01-cerave.png", label: "CeraVe" },
      { src: "/images/02-biobalance.jpg", label: "Biobalance" },
    ]);
  });
});

function request(app, path) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", async () => {
      try {
        const { port } = server.address();
        const response = await realFetch(`http://127.0.0.1:${port}${path}`);
        const body = await response.json();
        server.close();
        resolve({ status: response.status, body });
      } catch (error) {
        server.close();
        reject(error);
      }
    });
  });
}
