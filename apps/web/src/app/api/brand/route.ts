import { activityEvents, brandProfiles } from "@result/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { managerContext, mutationErrorResponse } from "@/lib/mutation-context";
import { invalidatePortalData } from "@/lib/portal-cache";

const listField = z.array(z.string().trim().min(1).max(200)).max(20).default([]);

const brandSchema = z.object({
  name: z.string().trim().min(1).max(120),
  productDescription: z.string().trim().min(1).max(2_000),
  audience: z.string().trim().max(1_000).default(""),
  voice: listField,
  bannedPhrases: listField,
  proofPoints: listField,
});

export async function PUT(request: Request) {
  try {
    const parsed = brandSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Brand name and product description are required.", details: parsed.error.flatten() }, { status: 400 });
    }
    const context = await managerContext();

    await context.db.insert(brandProfiles).values({
      organizationId: context.organization.id,
      name: parsed.data.name,
      productDescription: parsed.data.productDescription,
      audience: parsed.data.audience,
      voice: parsed.data.voice,
      bannedPhrases: parsed.data.bannedPhrases,
      proofPoints: parsed.data.proofPoints,
      updatedByUserId: context.internalUser?.id ?? null,
    }).onConflictDoUpdate({
      target: brandProfiles.organizationId,
      set: {
        name: parsed.data.name,
        productDescription: parsed.data.productDescription,
        audience: parsed.data.audience,
        voice: parsed.data.voice,
        bannedPhrases: parsed.data.bannedPhrases,
        proofPoints: parsed.data.proofPoints,
        updatedByUserId: context.internalUser?.id ?? null,
        updatedAt: new Date(),
      },
    });

    await context.db.insert(activityEvents).values({
      organizationId: context.organization.id,
      actorUserId: context.internalUser?.id ?? null,
      type: "brand.updated",
      summary: `Brand context for ${parsed.data.name} was updated.`,
      metadata: { name: parsed.data.name },
    });

    invalidatePortalData();
    return Response.json({ ok: true, brand: parsed.data });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}

export async function GET() {
  try {
    const context = await managerContext();
    const row = (await context.db.select().from(brandProfiles).where(eq(brandProfiles.organizationId, context.organization.id)).limit(1))[0];
    return Response.json({ ok: true, brand: row ?? null });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
