import "server-only";

import { revalidateTag } from "next/cache";

export const PORTAL_DATA_CACHE_TAG = "result-portal-data";

export function invalidatePortalData(): void {
  revalidateTag(PORTAL_DATA_CACHE_TAG, "max");
}
