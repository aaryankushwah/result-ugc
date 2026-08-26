import { scripts } from "@result/db";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { managerContext, mutationErrorResponse, MutationError } from "@/lib/mutation-context";
import { SCRIPT_ASSET_CONTENT_TYPES, SCRIPT_ASSET_MAX_BYTES } from "@/lib/script-asset-upload";

const clientPayloadSchema = z.object({ scriptId:z.uuid() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json() as HandleUploadBody;
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let payloadInput:unknown={};
        try { payloadInput=JSON.parse(clientPayload ?? "{}"); } catch { throw new MutationError(400,"Invalid script upload request"); }
        const payload = clientPayloadSchema.safeParse(payloadInput);
        if (!payload.success || payload.data.scriptId !== id) throw new MutationError(400,"Invalid script upload request");
        const context = await managerContext();
        const script = (await context.db.select({ id:scripts.id }).from(scripts).where(and(eq(scripts.id,id),eq(scripts.organizationId,context.organization.id))).limit(1))[0];
        if (!script) throw new MutationError(404,"Script not found");
        const prefix = `script-assets/${script.id}/`;
        if (!pathname.startsWith(prefix)) throw new MutationError(400,"Invalid upload path");
        return {
          allowedContentTypes:[...SCRIPT_ASSET_CONTENT_TYPES],
          maximumSizeInBytes:SCRIPT_ASSET_MAX_BYTES,
          addRandomSuffix:true,
          tokenPayload:JSON.stringify({ organizationId:context.organization.id,scriptId:script.id }),
        };
      },
      onUploadCompleted: async () => {
        // The browser records the returned blob as a script asset. Keeping the
        // callback side-effect free also makes local uploads work without a tunnel.
      },
    });
    return Response.json(result);
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
