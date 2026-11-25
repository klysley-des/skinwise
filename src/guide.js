export const GUIDE = [
  {
    id: "niacinamide",
    name: "Niacinamide",
    does: "A form of vitamin B3 that helps balance oil and support the skin barrier.",
    usedFor: "Oily skin, enlarged pores and uneven skin tone.",
    concerns: ["Uneven skin tone", "Oily skin"],
    precautions: "Generally gentle on the skin. Introduce new products gradually.",
    goodToKnow: "Helps keep skin balanced, smooth and healthy-looking.",
  },
  {
    id: "salicylic",
    name: "Salicylic Acid",
    does: "A gentle exfoliating acid that helps clear clogged pores.",
    usedFor: "Acne, blackheads and excess oil.",
    concerns: ["Acne and breakouts", "Oily skin"],
    precautions: "May cause dryness or irritation. Start slowly and avoid overuse.",
    goodToKnow: "Works inside pores to remove buildup and help prevent breakouts.",
  },
  {
    id: "hyaluronic",
    name: "Hyaluronic Acid",
    does: "A hydrating ingredient that attracts and holds moisture in the skin.",
    usedFor: "Dry, dehydrated and tight-feeling skin.",
    concerns: ["Dehydration", "Dry skin"],
    precautions: "Apply to slightly damp skin and follow with a moisturiser.",
    goodToKnow: "Helps skin feel soft, plump and deeply hydrated.",
  },
  {
    id: "retinol",
    name: "Retinol",
    does: "A vitamin A ingredient that supports skin renewal.",
    usedFor: "Fine lines, uneven texture and acne concerns.",
    concerns: ["Skin texture", "Signs of ageing", "Acne and breakouts"],
    precautions: "Start with a low strength and use gradually at night. Use sunscreen during the day. Avoid during pregnancy.",
    goodToKnow: "Helps improve skin texture and the appearance of fine lines over time.",
  },
  {
    id: "vitamin-c",
    name: "Vitamin C",
    does: "An antioxidant that helps protect and brighten the skin.",
    usedFor: "Dark spots, dullness and uneven skin tone.",
    concerns: ["Uneven skin tone", "Dark spots"],
    precautions: "Introduce gradually, especially if you have sensitive skin. Use sunscreen during the day.",
    goodToKnow: "Helps skin look brighter and more radiant.",
  },
  {
    id: "centella",
    name: "Centella Asiatica",
    does: "A plant-based ingredient known for its soothing properties.",
    usedFor: "Sensitive, irritated and redness-prone skin.",
    concerns: ["Sensitive skin", "Redness"],
    precautions: "Generally well tolerated, but patch-test new products before use.",
    goodToKnow: "Often called Cica, it is popular in calming creams and serums.",
  },
  {
    id: "ceramides",
    name: "Ceramides",
    does: "Natural skin lipids that help protect and strengthen the skin barrier.",
    usedFor: "Dry skin, irritation and a weakened skin barrier.",
    concerns: ["Dry skin", "Skin barrier"],
    precautions: "Generally suitable for most skin types. Check the full formulation if you have known sensitivities.",
    goodToKnow: "Help lock in moisture and keep the skin barrier healthy.",
  },
  {
    id: "glycolic",
    name: "Glycolic Acid",
    does: "An exfoliating acid that removes dead skin cells from the surface.",
    usedFor: "Dullness, uneven texture and dark spots.",
    concerns: ["Skin texture", "Uneven skin tone"],
    precautions: "Can increase sun sensitivity. Introduce gradually and use sunscreen.",
    goodToKnow: "Helps reveal smoother, brighter and more even-looking skin.",
  },
];

const LISTED = {
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
  ],
  centella: [/\bcentella(?:\s+asiatica)?\b/i],
  ceramides: [/\bceramides?\b/i],
  glycolic: [/\bglycolic(?:\s+acid)?\b/i],
};

export function guideById(id) {
  return GUIDE.find((item) => item.id === id) || null;
}

export function ingredientListed(product, id) {
  const patterns = LISTED[id];
  const parts = Array.isArray(product?.ingredientList) ? product.ingredientList : [];
  if (!patterns || !parts.length) return false;
  return parts.some((part) => part.length <= 80 && patterns.some((pattern) => pattern.test(part)));
}

export function ingredientMentioned(product, id) {
  if (ingredientListed(product, id)) return true;
  const patterns = LISTED[id];
  if (!patterns) return false;
  const text = `${product?.name || ""} ${product?.claimText || ""} ${product?.description || ""}`;
  return patterns.some((pattern) => pattern.test(text));
}
