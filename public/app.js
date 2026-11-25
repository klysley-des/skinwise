(function () {
  const brands = [
    { id: "all", label: "All" },
    { id: "biobalance", label: "Biobalance" },
    { id: "fixderma", label: "Fixderma" },
    { id: "ordinary", label: "The Ordinary" },
    { id: "cerave", label: "CeraVe" },
    { id: "laroche", label: "La Roche-Posay" },
    { id: "skin1004", label: "SKIN1004" },
  ];
  const stepNames = {
    cleanse: "Cleansers",
    treat: "Treatments",
    moisturise: "Moisturisers",
    sunscreen: "Sunscreens",
    morning: "Morning routine products",
    evening: "Evening routine products",
  };
  const els = {
    brands: document.getElementById("brands"),
    skins: document.getElementById("skins"),
    concerns: document.getElementById("concern-list"),
    query: document.getElementById("q"),
    sort: document.getElementById("sort"),
    status: document.getElementById("status"),
    retry: document.getElementById("retry"),
    list: document.getElementById("list"),
    detail: document.getElementById("detail"),
    guide: document.getElementById("guide"),
    probe: document.getElementById("probe"),
    probeLog: document.getElementById("probe-log"),
    form: document.getElementById("finder"),
    barcodeForm: document.getElementById("barcode-lookup"),
    barcode: document.getElementById("barcode"),
    barcodeStatus: document.getElementById("barcode-status"),
  };
  const guidance = {
    morning: "A morning routine in this catalogue is cleanse, then a treatment, a moisturiser, and a sunscreen. This organises published product names for learning. It is not a diagnosis or a prescription.",
    evening: "An evening routine in this catalogue is cleanse, then a treatment, and a moisturiser. Sunscreen is kept for the morning. This is general education, not a diagnosis.",
    cleanse: "Cleansers are products whose names say cleanser, cleansing, face wash, or micellar. A serum stays under Treatments.",
    treat: "Treatments are serums, ampoules, and essences. A moisturiser stays under Moisturisers, even when its name also says treatment.",
    moisturise: "Moisturisers are products whose names say moisturiser, lotion, or cream, and do not say serum.",
    sunscreen: "Sunscreens are grouped from words such as sunscreen, SPF, or Anthelios in the product name. Use them as the brand directs.",
  };
  const state = { brand: "all", concern: "", skin: "", step: "", products: [], total: 0 };
  let concernLabels = [];
  let skinLabels = [];
  let catalogue = [];
  let pendingBrands = [];
  let gaps = [];
  let loading = false;

  function el(tag, props, children) {
    const node = document.createElement(tag);
    Object.entries(props || {}).forEach(([key, value]) => {
      if (value == null) return;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else node.setAttribute(key, String(value));
    });
    (children || []).forEach((child) => { if (child) node.append(child); });
    return node;
  }

  function imageUrl(url) {
    if (typeof url !== "string") return "";
    if (url.startsWith("https://images.openbeautyfacts.org/")) return url;
    if (url.startsWith("https://cdn.shopify.com/")) return url;
    if (url.startsWith("https://www.cerave.com/")) return url;
    if (url.startsWith("https://theordinary.com/")) return url;
    if (url.startsWith("https://www.laroche-posay.be/")) return url;
    return "";
  }

  function chips(container, items, current, onPick) {
    if (!container) return;
    container.replaceChildren();
    items.forEach((item) => {
      const on = item.id === current;
      const button = el("button", { type: "button", class: on ? "chip is-on" : "chip", text: item.label, "aria-pressed": on ? "true" : "false" });
      button.addEventListener("click", () => onPick(item.id));
      container.append(button);
    });
  }

  function cardFor(product) {
    const card = el("button", { type: "button", class: "card" });
    const picture = imageUrl(product.image);
    const frame = el("span", { class: "photo" });
    if (picture) {
      const image = el("img", { alt: "", loading: "lazy", decoding: "async" });
      image.src = picture;
      image.addEventListener("error", () => {
        frame.replaceChildren(el("span", { class: "photo-fallback", text: product.brand || "SkinWise" }));
      });
      frame.append(image);
    } else {
      frame.append(el("span", { class: "photo-fallback", text: product.brand || "SkinWise" }));
    }
    card.append(frame);
    const lines = [
      el("span", { class: "brand", text: product.brand || "" }),
      el("strong", { text: product.name }),
    ];
    if (Array.isArray(product.concerns) && product.concerns.length) {
      lines.push(el("span", { class: "fit", text: product.concerns.slice(0, 3).join(" · ") }));
    }
    lines.push(el("span", { class: "view", text: "View product" }));
    card.append(...lines);
    card.addEventListener("click", () => openProduct(product.code));
    return card;
  }

  function countStatus() {
    const label = stepNames[state.step] || "products";
    if (!state.products.length) return emptyMessage();
    const more = state.total > state.products.length ? ` Showing ${state.products.length} of ${state.total}.` : "";
    return state.step ? `${state.products.length} ${label.toLowerCase()}.${more}` : `${state.products.length} products.${more}`;
  }

  function emptyMessage() {
    const chosen = [];
    if (state.brand !== "all") chosen.push("this brand");
    if (state.concern) chosen.push("this concern");
    if (state.skin) chosen.push("this skin type");
    if (state.step) chosen.push("this routine step");
    if (els.query && els.query.value.trim()) chosen.push("this search");
    const what = chosen.length ? chosen.join(" and ") : "these filters";
    return `No products match ${what}. A concern or skin type is included only when the brand publishes that claim. Clear one filter, or try another name.`;
  }

  function renderList() {
    const keepDetail = els.detail && !els.detail.hidden;
    if (!keepDetail) {
      els.list.hidden = false;
      els.detail.hidden = true;
    }
    els.list.replaceChildren();
    if (!state.products.length) {
      const waiting = pendingBrands.length && !catalogue.length;
      els.list.append(el("p", { class: "empty", text: waiting ? "Loading products…" : emptyMessage() }));
      return;
    }
    const grid = el("div", { class: "grid" });
    state.products.forEach((product) => grid.append(cardFor(product)));
    els.list.append(grid);
  }

  function keyActiveBlock(product) {
    const items = Array.isArray(product.keyActives) ? product.keyActives : [];
    if (!items.length) return null;
    return el("div", { class: "key-actives" }, [
      el("h3", { text: "Key ingredients" }),
      ...items.map((item) => el("div", { class: "ingredient-field" }, [
        el("p", { class: "ingredient-label", text: item.name || "" }),
        el("p", { text: item.does || "" }),
        el("p", { class: "quiet", text: `Commonly used for: ${(item.concerns || []).join(", ") || "see the brand page."}` }),
      ])),
    ]);
  }

  function renderDetail(product) {
    els.list.hidden = true;
    els.detail.hidden = false;
    els.detail.replaceChildren();
    const back = el("button", { type: "button", class: "back", text: "Back to products" });
    back.addEventListener("click", () => {
      els.detail.hidden = true;
      els.list.hidden = false;
      els.status.textContent = countStatus();
    });
    const picture = imageUrl(product.image);
    const image = picture ? el("img", { alt: "" }) : null;
    if (image) image.src = picture;
    const notes = el("ul", { class: "notes" });
    (product.mentions || []).forEach((note) => notes.append(el("li", { text: note })));
    const ingredients = el("ul", { class: "ingredients" });
    (product.ingredientList || []).forEach((item) => ingredients.append(el("li", { text: item })));
    const hasList = ingredients.childNodes.length > 0;
    const listHeading = product.sourceName
      ? (hasList ? "Ingredient list" : "")
      : (product.ingredientStatus === "complete" ? "Complete ingredient list" : "Ingredient list");
    const link = typeof product.link === "string" && product.link.startsWith("https://")
      ? el("a", { href: product.link, text: product.sourceName ? `${product.sourceName} record` : "Official product page" })
      : null;
    if (link) { link.target = "_blank"; link.rel = "noreferrer"; }
    const blocks = [
      back,
      el("h2", { text: product.name }),
      el("p", { class: "quiet", text: [product.brand, product.quantity].filter(Boolean).join(" · ") }),
      image,
      product.description ? el("p", { text: product.description }) : null,
      notes.childNodes.length ? notes : null,
      keyActiveBlock(product),
      listHeading ? el("h3", { text: listHeading }) : null,
      product.ingredientNote ? el("p", { class: "quiet", text: product.ingredientNote }) : null,
      product.ingredientList && product.ingredientList.length ? ingredients : null,
      link ? el("p", { class: "quiet", text: product.sourceName ? `Product record from ${product.sourceName}` : "Official source for this product" }) : null,
      link,
    ];
    blocks.filter(Boolean).forEach((node) => els.detail.append(node));
    els.detail.scrollIntoView({ block: "start" });
  }

  function showProducts() {
    if (els.detail) els.detail.hidden = true;
    if (els.list) els.list.hidden = false;
  }

  function stepsFromName(name) {
    const title = String(name || "");
    if (!title || /\b(shampoo|conditioner|hair)\b/i.test(title)) return [];
    const serum = /\b(serum|ampoule)\b/i.test(title);
    const cleanse = /\b(cleanser|cleansing|face wash|facial wash|cleansing oil|cleansing balm|micellar)\b/i.test(title);
    const sunscreen = /\b(sunscreen|sun cream|sun fluid|\bspf\b|anthelios|uvmune)\b/i.test(title);
    const moisturise = /\b(moisturi[sz]er|moisturi[sz]ing|lotion|\bcream\b)\b/i.test(title);
    const targeted = /\b(essence|treatment)\b/i.test(title);
    let primary = "";
    if (serum) primary = "treat";
    else if (sunscreen && !cleanse) primary = "sunscreen";
    else if (cleanse) primary = "cleanse";
    else if (moisturise) primary = "moisturise";
    else if (targeted) primary = "treat";
    if (!primary) return [];
    const steps = [primary, "morning"];
    if (primary !== "sunscreen") steps.push("evening");
    return steps;
  }

  function stepsFor(product) {
    if (Array.isArray(product?.steps) && product.steps.length) return product.steps;
    return stepsFromName(product?.name);
  }

  function brandIdOf(product) {
    if (product?.brandId) return product.brandId;
    const label = String(product?.brand || "").toLowerCase();
    const found = brands.find((item) => item.label.toLowerCase() === label);
    return found ? found.id : "";
  }

  const concernRules = [
    { id: "acne", label: "Acne and breakouts", pattern: /\b(acne|blemish|breakouts?|blackheads?|whiteheads?)\b/i },
    { id: "pigment", label: "Dark spots", pattern: /\b(dark spots?|hyperpigmentation|age spots?|discoloration)\b/i },
    { id: "oily", label: "Oily skin", pattern: /\b(oily(?:\s+skin)?|oil[\s-]control|excess oil|for oily)\b/i },
    { id: "dry", label: "Dry skin", pattern: /\b(dry skin|very dry|extra dry|extremely dry|for dry)\b/i },
    { id: "sensitive", label: "Sensitive skin", pattern: /\b(sensitive skin|for sensitive)\b/i },
    { id: "tone", label: "Uneven skin tone", pattern: /\b(uneven (?:skin )?tone|dull skin|dullness|lacklustre|lackluster)\b/i },
    { id: "dehydration", label: "Dehydration", pattern: /\b(dehydrat\w*|hydrating|hydration)\b/i },
    { id: "texture", label: "Skin texture", pattern: /\b(skin texture|uneven texture|rough skin|bumpy)\b/i },
  ];

  const skinRules = [
    { id: "dry", label: "Dry", pattern: /\b(dry skin|very dry|extra dry|extremely dry|for dry)\b/i },
    { id: "oily", label: "Oily", pattern: /\b(oily(?:\s+skin)?|for oily|oil[\s-]control)\b/i },
    { id: "sensitive", label: "Sensitive", pattern: /\b(sensitive skin|for sensitive)\b/i },
    { id: "combination", label: "Combination", pattern: /\b(combination skin|for combination)\b/i },
  ];

  function publishedWords(product, labels) {
    return `${product?.name || ""} ${product?.description || ""} ${(labels || []).join(" ")}`
      .replace(/\bnon[-\s]?oily\b/gi, " ");
  }

  function listedSkinIds(text) {
    const found = new Set();
    const list = /\b((?:dry|oily|sensitive|combination|normal)(?:\s*(?:,|and|or|to)\s*(?:dry|oily|sensitive|combination|normal))*)\s+skin\b/gi;
    for (const match of text.matchAll(list)) {
      const words = match[1].toLowerCase().match(/\b(dry|oily|sensitive|combination)\b/g) || [];
      words.forEach((word) => found.add(word));
    }
    return found;
  }

  function concernIdsOf(product) {
    const labels = Array.isArray(product?.concerns) ? product.concerns : [];
    const text = publishedWords(product, labels);
    const listed = listedSkinIds(text);
    const found = new Set(Array.isArray(product?.concernIds) ? product.concernIds : []);
    concernRules.forEach((item) => {
      if (labels.includes(item.label) || item.pattern.test(text) || listed.has(item.id)) found.add(item.id);
    });
    return [...found];
  }

  function skinIdsOf(product) {
    const labels = Array.isArray(product?.skinTypes) ? product.skinTypes : [];
    const text = publishedWords(product, labels);
    const listed = listedSkinIds(text);
    const found = new Set(Array.isArray(product?.skinTypeIds) ? product.skinTypeIds : []);
    skinRules.forEach((item) => {
      if (labels.includes(item.label) || item.pattern.test(text) || listed.has(item.id)) found.add(item.id);
    });
    return [...found];
  }

  function paintChips() {
    chips(els.brands, brands, state.brand, (id) => {
      state.brand = id;
      if (id === "all") state.step = "";
      showProducts();
      applyView();
    });
    chips(els.skins, [{ id: "", label: "Any skin type" }, ...skinLabels], state.skin, (id) => {
      state.skin = id;
      showProducts();
      applyView();
    });
  }

  function routineWarning(products) {
    const lists = products.map((product) => (product.ingredientList || []).join(", "));
    const has = (pattern) => lists.some((text) => pattern.test(text));
    if (has(/\bretinol\b/i) && has(/\b(glycolic acid|salicylic acid)\b/i)) {
      return "Some of these products publish retinol and an acid (glycolic acid or salicylic acid) in their ingredient lists. Many brands suggest using those products at different times and wearing sunscreen in the daytime. This is not medical advice.";
    }
    return "";
  }

  function applyView() {
    const query = (els.query && els.query.value ? els.query.value : "").trim().toLowerCase();
    const matched = catalogue.filter((product) => {
      if (state.brand !== "all" && brandIdOf(product) !== state.brand) return false;
      if (state.concern && !concernIdsOf(product).includes(state.concern)) return false;
      if (state.skin && !skinIdsOf(product).includes(state.skin)) return false;
      if (state.step && !stepsFor(product).includes(state.step)) return false;
      if (!query) return true;
      const haystack = [product.name, product.brand, ...(product.ingredientList || [])].join(" ").toLowerCase();
      return haystack.includes(query);
    });
    const sort = els.sort ? els.sort.value : "az";
    matched.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    if (sort === "za") matched.reverse();
    if (sort === "ingredients") {
      matched.sort((a, b) => Number(b.hasIngredients) - Number(a.hasIngredients) || String(a.name).localeCompare(String(b.name)));
    }
    state.products = matched;
    state.total = matched.length;
    renderList();
    const still = pendingBrands.length ? ` Still reading ${pendingBrands.join(", ")}.` : "";
    const missing = gaps.length ? ` Some catalogues did not answer: ${gaps.join(", ")}.` : "";
    if (els.status) {
      if (!catalogue.length && pendingBrands.length) els.status.textContent = "Loading products…";
      else if (!catalogue.length && gaps.length) els.status.textContent = "The products did not load. Try again in a moment.";
      else els.status.textContent = `${countStatus()}${still}${missing}`;
    }
    if (els.retry) els.retry.hidden = !(gaps.length && !pendingBrands.length);
    const note = document.getElementById("routine-note");
    if (note) note.textContent = [guidance[state.step] || "", state.step ? routineWarning(matched) : ""].filter(Boolean).join(" ");
    paintChips();
  }

  async function loadCatalogue({ refresh = false } = {}) {
    if (loading) return;
    loading = true;
    catalogue = [];
    gaps = [];
    pendingBrands = brands.filter((brand) => brand.id !== "all").map((brand) => brand.label);
    if (els.list) els.list.setAttribute("aria-busy", "true");
    applyView();
    await Promise.all(pendingBrands.slice().map(async (label) => {
      const brand = brands.find((item) => item.label === label);
      try {
        const params = new URLSearchParams({ brand: brand.id, sort: "az" });
        if (refresh) params.set("refresh", "1");
        const response = await fetch(`/api/products?${params}`);
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || `${label} did not load.`);
        const seen = new Set(catalogue.map((product) => product.code));
        (Array.isArray(body.products) ? body.products : []).forEach((product) => {
          if (!seen.has(product.code)) catalogue.push(product);
        });
        if (Array.isArray(body.gaps)) body.gaps.forEach((gap) => { if (!gaps.includes(gap)) gaps.push(gap); });
      } catch {
        if (!gaps.includes(label)) gaps.push(label);
      } finally {
        pendingBrands = pendingBrands.filter((item) => item !== label);
        applyView();
      }
    }));
    loading = false;
    if (els.list) els.list.removeAttribute("aria-busy");
    applyView();
  }

  function barcodeNotice(error) {
    if (!error.status) return "The product catalogue is unavailable. Try again in a moment.";
    if (error.status === 404) return error.message || "That product was not found.";
    if (error.status === 400) return "Enter a barcode of 6 to 20 digits.";
    if (error.status === 502 || error.status === 504 || error.status === 500) {
      return error.message || "The product catalogue is unavailable. Try again in a moment.";
    }
    return error.message || "That product did not open.";
  }

  async function openProduct(code, options = {}) {
    const notice = options.status || els.status;
    const say = (text) => { if (notice) notice.textContent = text; };
    say(options.pending || "Opening the product…");
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(code)}`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(body.error || "That product did not open."), { status: response.status });
      if (!body.product) throw Object.assign(new Error("That product did not open."), { status: 404 });
      renderDetail(body.product);
      say(body.product.name);
    } catch (error) {
      say(options.status ? barcodeNotice(error) : (error.message || "That product did not open."));
    }
  }

  async function lookupBarcode(event) {
    event.preventDefault();
    const raw = String(els.barcode && els.barcode.value || "").replace(/\s+/g, "");
    if (!/^\d{6,20}$/.test(raw)) {
      if (els.barcodeStatus) els.barcodeStatus.textContent = "Enter a barcode of 6 to 20 digits.";
      if (els.barcode) els.barcode.setAttribute("aria-invalid", "true");
      return;
    }
    if (els.barcode) els.barcode.removeAttribute("aria-invalid");
    const button = els.barcodeForm ? els.barcodeForm.querySelector("button") : null;
    if (button) button.disabled = true;
    try {
      await openProduct(raw, { status: els.barcodeStatus, pending: "Looking up that barcode…" });
    } finally {
      if (button) button.disabled = false;
    }
  }

  function pickConcern(id) {
    state.concern = state.concern === id ? "" : id;
    state.step = "";
    chips(els.concerns, concernLabels, state.concern, pickConcern);
    showProducts();
    document.getElementById("discover").scrollIntoView({ behavior: "smooth" });
    applyView();
  }

  async function openStep(step, button) {
    state.step = step;
    state.brand = "all";
    state.concern = "";
    state.skin = "";
    if (els.query) els.query.value = "";
    document.querySelectorAll(".routine-card, #routine-times button").forEach((card) => card.classList.remove("is-on"));
    if (button) {
      const card = button.closest("article");
      if (card) card.classList.add("is-on");
      else button.classList.add("is-on");
    }
    showProducts();
    applyView();
    const discover = document.getElementById("discover");
    if (discover) discover.scrollIntoView({ behavior: "smooth" });
    if (state.products.length) return;
    const label = stepNames[step] || "products";
    if (els.status) els.status.textContent = `Looking for ${label.toLowerCase()}…`;
    try {
      const response = await fetch(`/api/products?step=${encodeURIComponent(step)}`);
      const body = await response.json().catch(() => ({}));
      if (response.ok && Array.isArray(body.products)) {
        const byCode = new Map(catalogue.map((product) => [product.code, product]));
        body.products.forEach((product) => {
          const existing = byCode.get(product.code);
          if (existing) Object.assign(existing, product);
          else catalogue.push(product);
        });
      }
    } catch { /* the products already loaded stay on the page */ }
    applyView();
  }

  const guideCopy = {
    niacinamide: {
      name: "Niacinamide",
      does: "A form of vitamin B3 that helps balance oil and support the skin barrier.",
      usedFor: "Oily skin, enlarged pores and uneven skin tone.",
      concerns: ["Uneven skin tone", "Oily skin"],
      precautions: "Generally gentle on the skin. Introduce new products gradually.",
      goodToKnow: "Helps keep skin balanced, smooth and healthy-looking.",
    },
    salicylic: {
      name: "Salicylic Acid",
      does: "A gentle exfoliating acid that helps clear clogged pores.",
      usedFor: "Acne, blackheads and excess oil.",
      concerns: ["Acne and breakouts", "Oily skin"],
      precautions: "May cause dryness or irritation. Start slowly and avoid overuse.",
      goodToKnow: "Works inside pores to remove buildup and help prevent breakouts.",
    },
    hyaluronic: {
      name: "Hyaluronic Acid",
      does: "A hydrating ingredient that attracts and holds moisture in the skin.",
      usedFor: "Dry, dehydrated and tight-feeling skin.",
      concerns: ["Dehydration", "Dry skin"],
      precautions: "Apply to slightly damp skin and follow with a moisturiser.",
      goodToKnow: "Helps skin feel soft, plump and deeply hydrated.",
    },
    retinol: {
      name: "Retinol",
      does: "A vitamin A ingredient that supports skin renewal.",
      usedFor: "Fine lines, uneven texture and acne concerns.",
      concerns: ["Skin texture", "Signs of ageing", "Acne and breakouts"],
      precautions: "Start with a low strength and use gradually at night. Use sunscreen during the day. Avoid during pregnancy.",
      goodToKnow: "Helps improve skin texture and the appearance of fine lines over time.",
    },
    "vitamin-c": {
      name: "Vitamin C",
      does: "An antioxidant that helps protect and brighten the skin.",
      usedFor: "Dark spots, dullness and uneven skin tone.",
      concerns: ["Uneven skin tone", "Dark spots"],
      precautions: "Introduce gradually, especially if you have sensitive skin. Use sunscreen during the day.",
      goodToKnow: "Helps skin look brighter and more radiant.",
    },
    centella: {
      name: "Centella Asiatica",
      does: "A plant-based ingredient known for its soothing properties.",
      usedFor: "Sensitive, irritated and redness-prone skin.",
      concerns: ["Sensitive skin", "Redness"],
      precautions: "Generally well tolerated, but patch-test new products before use.",
      goodToKnow: "Often called Cica, it is popular in calming creams and serums.",
    },
    ceramides: {
      name: "Ceramides",
      does: "Natural skin lipids that help protect and strengthen the skin barrier.",
      usedFor: "Dry skin, irritation and a weakened skin barrier.",
      concerns: ["Dry skin", "Skin barrier"],
      precautions: "Generally suitable for most skin types. Check the full formulation if you have known sensitivities.",
      goodToKnow: "Help lock in moisture and keep the skin barrier healthy.",
    },
    glycolic: {
      name: "Glycolic Acid",
      does: "An exfoliating acid that removes dead skin cells from the surface.",
      usedFor: "Dullness, uneven texture and dark spots.",
      concerns: ["Skin texture", "Uneven skin tone"],
      precautions: "Can increase sun sensitivity. Introduce gradually and use sunscreen.",
      goodToKnow: "Helps reveal smoother, brighter and more even-looking skin.",
    },
  };

  async function loadGuide() {
    const response = await fetch("/api/guide");
    const body = await response.json();
    const meta = await fetch("/api/brands").then((res) => res.json());
    concernLabels = meta.concerns || [];
    skinLabels = meta.skinTypes || [];
    chips(els.concerns, concernLabels, state.concern, pickConcern);
    paintChips();
    if (!els.guide) return;
    els.guide.replaceChildren();
    (body.ingredients || []).forEach((item) => {
      const copy = guideCopy[item.id];
      els.guide.append(ingredientCard(copy ? { ...item, ...copy } : item));
    });
  }

  function ingredientField(label, text) {
    return el("div", { class: "ingredient-field" }, [
      el("p", { class: "ingredient-label", text: label }),
      el("p", { text: text || "" }),
    ]);
  }

  function ingredientCard(item) {
    const button = el("button", { type: "button", class: "find", text: "Find Products" });
    button.addEventListener("click", () => findIngredient(item, button));
    const concerns = Array.isArray(item.concerns) ? item.concerns.join(", ") : "";
    return el("article", { class: "ingredient-card" }, [
      el("h3", { text: item.name }),
      ingredientField("Why it matters?", item.does || item.summary),
      item.usedFor ? ingredientField("Skincare benefits", item.usedFor) : null,
      concerns ? ingredientField("Targeted concerns", concerns) : null,
      (item.precautions || item.caution) ? ingredientField("Precautions", item.precautions || item.caution) : null,
      (item.goodToKnow && item.goodToKnow !== (item.precautions || item.caution)) ? ingredientField("Good to know", item.goodToKnow) : null,
      button,
    ]);
  }

  const guidePatterns = {
    niacinamide: [/\bniacinamide\b/i],
    salicylic: [/\bsalicylic acid\b/i],
    hyaluronic: [/\bhyaluron/i],
    retinol: [/\bretinol\b/i],
    "vitamin-c": [
      /\bascorbic acid\b/i,
      /\bsodium ascorbyl phosphate\b/i,
      /\bascorbyl glucoside\b/i,
      /\bascorbyl palmitate\b/i,
      /\bascorbyl tetraisopalmitate\b/i,
      /\bmagnesium ascorbyl phosphate\b/i,
      /\b3-o-ethyl ascorbic acid\b/i,
      /^vitamin c\b/i,
      /\bvitamin c\b/i,
    ],
    centella: [/\bcentella(?:\s+asiatica)?\b/i],
    ceramides: [/\bceramides?\b/i],
    glycolic: [/\bglycolic(?:\s+acid)?\b/i],
  };

  const guideSearch = {
    niacinamide: "niacinamide",
    salicylic: "salicylic",
    hyaluronic: "hyaluron",
    retinol: "retinol",
    "vitamin-c": "vitamin c",
    centella: "centella",
    ceramides: "ceramide",
    glycolic: "glycolic",
  };

  function listsIngredient(product, id) {
    const patterns = guidePatterns[id];
    if (!patterns) return false;
    const parts = [];
    if (Array.isArray(product?.ingredientList)) parts.push(...product.ingredientList);
    if (typeof product?.ingredients === "string") parts.push(...product.ingredients.split(/[,;•·|]/));
    parts.push(product?.name || "", product?.description || "");
    return parts.some((part) => {
      const text = String(part || "").trim();
      return text.length > 1 && text.length <= 240 && patterns.some((pattern) => pattern.test(text));
    });
  }

  async function findIngredient(item, button) {
    const panel = document.getElementById("ingredient-results");
    if (!panel) return;
    document.querySelectorAll(".ingredient-card").forEach((card) => card.classList.remove("is-on"));
    button.closest("article").classList.add("is-on");
    button.disabled = true;
    panel.hidden = false;
    panel.replaceChildren(
      el("h3", { text: item.name }),
      el("p", { class: "status", text: "Looking through published ingredient lists…" }),
    );
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    try {
      const started = Date.now();
      while (!catalogue.length && pendingBrands.length && Date.now() - started < 8000) {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
      const seen = new Map();
      catalogue.filter((product) => listsIngredient(product, item.id)).forEach((product) => {
        if (product?.code) seen.set(product.code, product);
      });
      if (guideSearch[item.id]) {
        try {
          const response = await fetch(`/api/products?q=${encodeURIComponent(guideSearch[item.id])}`);
          const body = await response.json().catch(() => ({}));
          if (response.ok && Array.isArray(body.products)) {
            body.products.filter((product) => listsIngredient(product, item.id)).forEach((product) => {
              if (product?.code) seen.set(product.code, product);
            });
          }
        } catch { /* the products already on the page stay usable */ }
      }
      let products = [...seen.values()];
      let total = products.length;
      panel.replaceChildren(el("h3", { text: products.length ? `Products that list ${item.name}` : item.name }));
      if (!products.length) {
        const waiting = pendingBrands.length ? " Products are still loading. Press Find Products again in a moment." : "";
        panel.append(el("p", { text: `No matching products currently available.${waiting}` }));
        return;
      }
      const grid = el("div", { class: "grid" });
      products.forEach((product) => grid.append(cardFor(product)));
      panel.append(grid);
      const note = total > products.length
        ? `Showing ${products.length} of ${total} products whose published ingredient lists include ${item.name}.`
        : "Matched from the ingredient list published by the brand.";
      panel.append(el("p", { class: "quiet", text: note }));
    } catch (error) {
      panel.replaceChildren(el("p", { text: error.message || "The product list did not load." }));
    } finally {
      button.disabled = false;
    }
  }

  els.probe.addEventListener("click", async () => {
    const seen = [];
    for (let i = 0; i < 4; i += 1) {
      const response = await fetch("/api/health", { cache: "no-store" });
      const body = await response.json();
      seen.push(body.server || "unknown");
    }
    els.probeLog.textContent = seen.join(" → ");
  });

  async function startSlider() {
    const root = document.querySelector(".slider");
    if (!root) return;
    const stage = root.querySelector(".slides");
    let files = [];
    try {
      const response = await fetch("/api/slides");
      if (response.ok) {
        const body = await response.json();
        if (Array.isArray(body.slides)) files = body.slides;
      }
    } catch { /* the pictures written in index.html stay */ }
    if (files.length && stage) {
      stage.replaceChildren();
      files.forEach((file, item) => {
        const image = el("img", { alt: file.label, loading: item === 0 ? "eager" : "lazy", decoding: "async" });
        image.src = file.src;
        stage.append(el("figure", { class: item === 0 ? "slide is-on" : "slide" }, [
          image,
          el("figcaption", { text: file.label }),
        ]));
      });
    }
    const slides = [...root.querySelectorAll(".slide")];
    if (!slides.length) return;
    root.hidden = false;
    const dots = root.querySelector(".dots");
    if (!dots) return;
    let index = 0;
    let timerId = 0;
    function show(next) {
      index = (next + slides.length) % slides.length;
      slides.forEach((slide, item) => slide.classList.toggle("is-on", item === index));
      [...dots.children].forEach((dot, item) => {
        const on = item === index;
        dot.classList.toggle("is-on", on);
        dot.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }
    function queue() {
      window.clearInterval(timerId);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      timerId = window.setInterval(() => show(index + 1), 5000);
    }
    slides.forEach((slide, item) => {
      const dot = el("button", { type: "button", class: item === 0 ? "is-on" : "", "aria-label": `Photograph ${item + 1}` });
      dot.addEventListener("click", () => { show(item); queue(); });
      dots.append(dot);
    });
    const prev = root.querySelector(".prev");
    const next = root.querySelector(".next");
    if (prev) prev.addEventListener("click", () => { show(index - 1); queue(); });
    if (next) next.addEventListener("click", () => { show(index + 1); queue(); });
    root.addEventListener("mouseenter", () => window.clearInterval(timerId));
    root.addEventListener("mouseleave", queue);
    root.addEventListener("focusin", () => window.clearInterval(timerId));
    root.addEventListener("focusout", queue);
    queue();
  }

  document.querySelectorAll("[data-step]").forEach((button) => {
    button.addEventListener("click", () => {
      openStep(button.getAttribute("data-step") || "", button);
    });
  });

  if (els.form) els.form.addEventListener("submit", (event) => { event.preventDefault(); state.step = ""; applyView(); });
  if (els.barcodeForm) els.barcodeForm.addEventListener("submit", lookupBarcode);
  if (els.query) els.query.addEventListener("input", () => { state.step = ""; applyView(); });
  if (els.sort) els.sort.addEventListener("change", applyView);
  if (els.retry) els.retry.addEventListener("click", () => loadCatalogue({ refresh: true }));

  startSlider();
  loadCatalogue();
  loadGuide().catch(() => {
    if (els.guide) els.guide.replaceChildren(el("p", { text: "The ingredient guide did not load. The product list above still works." }));
  });
}());
