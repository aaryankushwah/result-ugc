export type BrandContext = {
  name: string;
  productDescription: string;
  audience: string;
  voice: string[];
  bannedPhrases: string[];
  proofPoints: string[];
};

export const SCRIPT_PROMPT_VERSION = "preserve-v1";

export const SCRIPT_SYSTEM_PROMPT = [
  "You adapt a competitor's short-form video script so it advertises a different business.",
  "",
  "Your single hard rule: change as little as humanly possible.",
  "",
  "Keep verbatim:",
  "- every word that does not name or describe the business",
  "- sentence order, sentence count, and sentence length",
  "- filler words, slang, contractions, stutters, repetition and interjections",
  "- punctuation, capitalisation and line breaks",
  "- numbers, timeframes and quantities that are not claims about the business",
  "",
  "Change only:",
  "- the brand or company name",
  "- the product or category nouns that name what is being sold",
  "- proof points and statistics that would be false for the new business",
  "- the call to action destination",
  "",
  "Never add new sentences, new benefits, new marketing language or a new closing line.",
  "Never improve, tighten or professionalise the writing. Awkward phrasing must stay awkward.",
  "If a sentence never mentions the business, reproduce it character for character.",
  "",
  "Report every replacement you make in `substitutions`, using the exact source text you replaced.",
].join("\n");

export function buildBrandBlock(brand: BrandContext): string {
  const lines = [
    `Business name: ${brand.name}`,
    `What it is: ${brand.productDescription}`,
    `Who it is for: ${brand.audience}`,
  ];
  if (brand.voice.length) lines.push(`Voice: ${brand.voice.join(", ")}`);
  if (brand.proofPoints.length) lines.push(`Approved proof points (use only these for claims):\n- ${brand.proofPoints.join("\n- ")}`);
  if (brand.bannedPhrases.length) lines.push(`Never use these phrases: ${brand.bannedPhrases.join(", ")}`);
  return lines.join("\n");
}

export function buildGenerationPrompt(brand: BrandContext, sections: { id: string; label: string; copy: string }[]): string {
  return [
    "Here is the business the script must now advertise:",
    "",
    buildBrandBlock(brand),
    "",
    "Here is the source script. Adapt each section and return it with the same ids, in the same order.",
    "",
    sections.map((section) => `[${section.id}] ${section.label}\n${section.copy}`).join("\n\n"),
  ].join("\n");
}

export function isBrandContextUsable(brand: BrandContext): boolean {
  return Boolean(brand.name.trim() && brand.productDescription.trim());
}
