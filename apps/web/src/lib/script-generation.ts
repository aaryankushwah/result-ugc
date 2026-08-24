import "server-only";

import type { ScriptGeneration, ScriptSection } from "@result/db";
import { generateObject } from "ai";
import { z } from "zod";
import { adaptReferenceForResult } from "./script-writing";
import { hasGatewayCredentials } from "./ai-gateway";
import {
  buildGenerationPrompt,
  isBrandContextUsable,
  SCRIPT_PROMPT_VERSION,
  SCRIPT_SYSTEM_PROMPT,
  type BrandContext,
} from "./script-prompt";

/** Routed through the Vercel AI Gateway — a plain "provider/model" string, no provider key of our own. */
export const SCRIPT_MODEL = "anthropic/claude-sonnet-5";

export class ScriptGenerationError extends Error {}

const generationSchema = z.object({
  sections: z.array(z.object({
    id: z.string(),
    copy: z.string(),
  })).min(1),
  substitutions: z.array(z.object({
    sectionId: z.string(),
    from: z.string(),
    to: z.string(),
  })).default([]),
});

export type GenerationResult = {
  sections: ScriptSection[];
  generation: ScriptGeneration;
  degraded: boolean;
};

/**
 * Rewrites a script for the given brand, preserving every word that does not
 * name the business. Falls back to the deterministic adapter when no API key is
 * configured so local preview mode keeps working.
 */
export async function generateScript(input: {
  sections: ScriptSection[];
  brand: BrandContext;
  referenceId: string | null;
  transcript: string;
}): Promise<GenerationResult> {
  const usableSections = input.sections.filter((section) => section.copy.trim());
  if (!usableSections.length) throw new ScriptGenerationError("There is nothing to generate from yet. Add a transcript or write a first draft.");
  if (!isBrandContextUsable(input.brand)) {
    throw new ScriptGenerationError("Add your brand name and product description in Brand settings before generating.");
  }

  if (!hasGatewayCredentials()) {
    const fallback = adaptReferenceForResult(input.transcript || usableSections.map((section) => section.copy).join(" "));
    return {
      sections: fallback,
      generation: { model: "deterministic-fallback", promptVersion: SCRIPT_PROMPT_VERSION, referenceId: input.referenceId, substitutions: [] },
      degraded: true,
    };
  }

  let object: z.infer<typeof generationSchema>;
  try {
    ({ object } = await generateObject({
      model: SCRIPT_MODEL,
      schema: generationSchema,
      system: SCRIPT_SYSTEM_PROMPT,
      prompt: buildGenerationPrompt(input.brand, usableSections.map((section) => ({ id: section.id, label: section.label, copy: section.copy }))),
    }));
  } catch (error) {
    throw new ScriptGenerationError(error instanceof Error ? `Generation failed: ${error.message}` : "Generation failed.");
  }

  const copyById = new Map(object.sections.map((section) => [section.id, section.copy]));
  const sections = input.sections.map((section) => {
    const copy = copyById.get(section.id);
    return copy === undefined ? section : { ...section, copy };
  });

  return {
    sections,
    generation: {
      model: SCRIPT_MODEL,
      promptVersion: SCRIPT_PROMPT_VERSION,
      referenceId: input.referenceId,
      substitutions: object.substitutions,
    },
    degraded: false,
  };
}
