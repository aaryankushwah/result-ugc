import { Eye, EyeOff } from "lucide-react";
import { Suspense } from "react";
import Link from "next/link";
import { VideoTable } from "@/components/data-tables";
import { PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getPortalData } from "@/lib/portal-data";

export default async function VideosPage({ searchParams }: { searchParams: Promise<{ visibility?: string }> }) { await requireUser(); const data = await getPortalData(); const visibility = (await searchParams).visibility === "excluded" ? "excluded" : "included"; return <div className="page-stack"><PageTitle eyebrow="CONTENT PERFORMANCE" title="Videos" description="Every tracked post with visibility, baseline performance, engagement, and refresh health." actions={<div className="view-toggle"><Link href="/videos" className={visibility === "included" ? "active" : ""}><Eye /> Included</Link><Link href="/videos?visibility=excluded" className={visibility === "excluded" ? "active" : ""}><EyeOff /> Excluded</Link></div>} /><Suspense fallback={<div className="skeleton skeleton-panel" />}><VideoTable videos={data.videos} visibility={visibility} /></Suspense></div>; }
