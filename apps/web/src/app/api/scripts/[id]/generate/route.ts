import { activityEvents, brandProfiles, scriptReferences, scripts, scriptVersions } from "@result/db";
import { and, eq } from "drizzle-orm";
import { managerContext, mutationErrorResponse, MutationError } from "@/lib/mutation-context";
import { invalidatePortalData } from "@/lib/portal-cache";
import { generateScript, ScriptGenerationError } from "@/lib/script-generation";
import type { BrandContext } from "@/lib/script-prompt";
import { estimateScriptDuration, scriptHookFromSections } from "@/lib/script-writing";

export const maxDuration = 60;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await managerContext();

    const script = (await context.db.select().from(scripts)
      .where(and(eq(scripts.id, id), eq(scripts.organizationId, context.organization.id))).limit(1))[0];
    if (!script) throw new MutationError(404, "Script not found");

    const brandRow = (await context.db.select().from(brandProfiles)
      .where(eq(brandProfiles.organizationId, context.organization.id)).limit(1))[0];
    if (!brandRow) throw new MutationError(409, "Add your brand details in Brand settings before generating.");

    const brand: BrandContext = {
      name: brandRow.name,
      productDescription: brandRow.productDescription,
      audience: brandRow.audience,
      voice: brandRow.voice,
      bannedPhrases: brandRow.bannedPhrases,
      proofPoints: brandRow.proofPoints,
    };

    const reference = script.referenceId
      ? (await context.db.select().from(scriptReferences)
          .where(and(eq(scriptReferences.id, script.referenceId), eq(scriptReferences.organizationId, context.organization.id))).limit(1))[0]
      : undefined;

    let result;
    try {
      result = await generateScript({
        sections: script.sections,
        brand,
        referenceId: script.referenceId,
        transcript: reference?.transcript ?? "",
      });
    } catch (error) {
      if (error instanceof ScriptGenerationError) throw new MutationError(422, error.message);
      throw error;
    }

    let nextVersion = 0;
    await context.db.transaction(async (transaction) => {
      const current = (await transaction.select().from(scripts)
        .where(and(eq(scripts.id, id), eq(scripts.organizationId, context.organization.id))).limit(1).for("update"))[0];
      if (!current) throw new MutationError(404, "Script not found");
      nextVersion = current.latestVersion + 1;

      await transaction.update(scripts).set({
        sections: result.sections,
        durationSeconds: estimateScriptDuration(result.sections),
        hook: scriptHookFromSections(result.sections),
        brandSnapshot: { ...brand },
        latestVersion: nextVersion,
        updatedByUserId: context.internalUser?.id ?? null,
        updatedAt: new Date(),
      }).where(and(eq(scripts.id, id), eq(scripts.organizationId, context.organization.id)));

      await transaction.insert(scriptVersions).values({
        organizationId: context.organization.id,
        scriptId: id,
        version: nextVersion,
        title: current.title,
        sections: result.sections,
        changeSummary: result.degraded
          ? "Generated without a model (no API key configured)"
          : `Adapted for ${brand.name} with ${result.generation.substitutions.length} substitution${result.generation.substitutions.length === 1 ? "" : "s"}`,
        generation: result.generation,
        createdByUserId: context.internalUser?.id ?? null,
      });

      await transaction.insert(activityEvents).values({
        organizationId: context.organization.id,
        actorUserId: context.internalUser?.id ?? null,
        type: "script.generated",
        summary: `Script “${current.title}” was adapted for ${brand.name} (version ${nextVersion}).`,
        metadata: {
          scriptId: id,
          version: nextVersion,
          model: result.generation.model,
          promptVersion: result.generation.promptVersion,
          substitutions: result.generation.substitutions.length,
          degraded: result.degraded,
        },
      });
    });

    invalidatePortalData();
    return Response.json({
      ok: true,
      version: nextVersion,
      sections: result.sections,
      generation: result.generation,
      degraded: result.degraded,
      sourceTranscript: reference?.transcript ?? null,
    });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
