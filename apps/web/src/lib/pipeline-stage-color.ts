import type { DitherColor } from "@/components/dither-kit/palette";

export type PipelineStage = "not_started" | "testing" | "iterate" | "winner" | "retired";

/**
 * Stage → dither-kit palette colour, so a card's wash matches the column it
 * sits in. Mirrors the --pipeline-stage hues in globals.css:
 *   not_started #767676 · testing #8b79ff · iterate #d4a849
 *   winner #55b76a · retired #d27050
 */
const STAGE_COLOR: Record<PipelineStage, DitherColor> = {
  not_started: "grey",
  testing: "purple",
  iterate: "orange",
  winner: "green",
  retired: "red",
};

export function ditherColorForStage(stage: string): DitherColor {
  return STAGE_COLOR[stage as PipelineStage] ?? "grey";
}

export const PIPELINE_STAGES = Object.keys(STAGE_COLOR) as PipelineStage[];
