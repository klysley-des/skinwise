const HAIR = /\b(shampoo|conditioner|hair)\b/i;

const STEPS = {
  cleanse: /\b(cleanser|cleansing|face wash|facial wash|cleansing oil|cleansing balm|micellar)\b/i,
  treat: /\b(serum|ampoule|essence|treatment)\b/i,
  moisturise: /\b(moisturi[sz]er|moisturi[sz]ing|lotion|\bcream\b)\b/i,
  sunscreen: /\b(sunscreen|sun cream|sun fluid|\bspf\b|anthelios|uvmune)\b/i,
};

const ROUTINES = {
  morning: ["cleanse", "treat", "moisturise", "sunscreen"],
  evening: ["cleanse", "treat", "moisturise"],
};

export const GUIDANCE = {
  morning: "A morning routine in this catalogue is cleanse, then a treatment, a moisturiser, and a sunscreen. This organises published product names for learning. It is not a diagnosis or a prescription.",
  evening: "An evening routine in this catalogue is cleanse, then a treatment, and a moisturiser. Sunscreen is kept for the morning. This is general education, not a diagnosis.",
  cleanse: "Cleansers are products whose names say cleanser, cleansing, face wash, or micellar. A serum stays under Treatments.",
  treat: "Treatments are serums, ampoules, and essences. A moisturiser stays under Moisturisers, even when its name also says treatment.",
  moisturise: "Moisturisers are products whose names say moisturiser, lotion, or cream, and do not say serum.",
  sunscreen: "Sunscreens are grouped from words such as sunscreen, SPF, or Anthelios in the product name. Use them as the brand directs.",
};

function primaryStep(name) {
  const serum = /\b(serum|ampoule)\b/i.test(name);
  const cleanse = STEPS.cleanse.test(name);
  const sunscreen = STEPS.sunscreen.test(name);
  const moisturise = STEPS.moisturise.test(name);
  const targeted = /\b(essence|treatment)\b/i.test(name);
  if (serum) return "treat";
  if (sunscreen && !cleanse) return "sunscreen";
  if (cleanse) return "cleanse";
  if (moisturise) return "moisturise";
  if (targeted) return "treat";
  return "";
}

export function matchesStep(product, step) {
  const name = String(product?.name || "");
  if (!name || HAIR.test(name)) return false;
  const primary = primaryStep(name);
  if (!primary) return false;
  if (step === "morning") return true;
  if (step === "evening") return primary !== "sunscreen";
  return primary === step;
}

export function compatibilityNote(products) {
  const lists = (Array.isArray(products) ? products : []).map((product) => (
    Array.isArray(product?.ingredientList) ? product.ingredientList.join(", ") : ""
  ));
  const has = (pattern) => lists.some((text) => pattern.test(text));
  const retinoid = has(/\bretinol\b/i);
  const acid = has(/\b(glycolic acid|salicylic acid)\b/i);
  if (retinoid && acid) {
    return "Some of these products publish retinol and an acid (glycolic acid or salicylic acid) in their ingredient lists. Many brands suggest using those products at different times and wearing sunscreen in the daytime. This is not medical advice.";
  }
  return "";
}
