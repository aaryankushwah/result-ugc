import { activityEvents, creatorNotes } from "@result/db";
import { z } from "zod";
import { managerContext, mutationErrorResponse } from "@/lib/mutation-context";

const schema = z.object({ body: z.string().trim().min(1).max(5000) });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; const parsed = schema.safeParse(await request.json()); if (!parsed.success) return Response.json({ error: "Note is required" }, { status: 400 }); const context = await managerContext(); const [note] = await context.db.insert(creatorNotes).values({ organizationId: context.organization.id, creatorId: id, authorUserId: context.internalUser?.id ?? null, body: parsed.data.body }).returning({ id: creatorNotes.id }); await context.db.insert(activityEvents).values({ organizationId: context.organization.id, creatorId: id, actorUserId: context.internalUser?.id ?? null, type: "creator.note_added", summary: "An internal note was added.", metadata: { noteId: note?.id } }); return Response.json({ ok: true, noteId: note?.id }); } catch (error) { return mutationErrorResponse(error); }
}
