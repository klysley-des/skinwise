export const CONCERNS = [
  { id: "acne", label: "Acne and breakouts", pattern: /\b(acne|blemish|breakouts?|blackheads?|whiteheads?)\b/i },
  { id: "pigment", label: "Dark spots", pattern: /\b(dark spots?|hyperpigmentation|age spots?|discoloration)\b/i },
  { id: "oily", label: "Oily skin", pattern: /\b(oily(?:\s+skin)?|oil[\s-]control|excess oil|for oily)\b/i },
  { id: "dry", label: "Dry skin", pattern: /\b(dry skin|very dry|extra dry|extremely dry|for dry)\b/i },
  { id: "sensitive", label: "Sensitive skin", pattern: /\b(sensitive skin|for sensitive)\b/i },
  { id: "tone", label: "Uneven skin tone", pattern: /\b(uneven (?:skin )?tone|dull skin|dullness|lacklustre|lackluster)\b/i },
  { id: "dehydration", label: "Dehydration", pattern: /\b(dehydrat\w*|hydrating|hydration)\b/i },
  { id: "texture", label: "Skin texture", pattern: /\b(skin texture|uneven texture|rough skin|bumpy)\b/i },
];

export const SKIN_TYPES = [
  { id: "dry", label: "Dry", pattern: /\b(dry skin|very dry|extra dry|extremely dry|for dry)\b/i },
  { id: "oily", label: "Oily", pattern: /\b(oily(?:\s+skin)?|for oily|oil[\s-]control)\b/i },
  { id: "sensitive", label: "Sensitive", pattern: /\b(sensitive skin|for sensitive)\b/i },
  { id: "combination", label: "Combination", pattern: /\b(combination skin|for combination)\b/i },
];

function publishedText(name, description) {
  return `${name || ""} ${description || ""}`.replace(/\s+/g, " ").trim();
}

function listedSkinTypes(text) {
  const found = new Set();
  const list = /\b((?:dry|oily|sensitive|combination|normal)(?:\s*(?:,|and|or|to)\s*(?:dry|oily|sensitive|combination|normal))*)\s+skin\b/gi;
  for (const match of text.matchAll(list)) {
    const words = match[1].toLowerCase().match(/\b(dry|oily|sensitive|combination)\b/g) || [];
    words.forEach((word) => found.add(word));
  }
  return found;
}

export function traits(name, description) {
  const text = publishedText(name, description).replace(/\bnon[-\s]?oily\b/gi, " ");
  const listed = listedSkinTypes(text);
  const concerns = CONCERNS.filter((item) => item.pattern.test(text) || listed.has(item.id));
  const skinTypes = SKIN_TYPES.filter((item) => item.pattern.test(text) || listed.has(item.id));
  return {
    concerns: concerns.map((item) => item.id),
    concernLabels: concerns.map((item) => item.label),
    skinTypes: skinTypes.map((item) => item.id),
    skinTypeLabels: skinTypes.map((item) => item.label),
  };
}
