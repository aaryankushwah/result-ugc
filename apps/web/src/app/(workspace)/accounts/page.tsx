import { Link2, Plus } from "lucide-react";
import { Suspense } from "react";
import { AccountTable } from "@/components/data-tables";
import { PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getPortalData } from "@/lib/portal-data";

export default async function AccountsPage() { await requireUser(); const data = await getPortalData(); return <div className="page-stack"><PageTitle eyebrow="SOCIAL TRACKING" title="Accounts" description="Tracked social accounts, current performance, creator ownership, and source freshness." actions={<><button className="secondary-button"><Link2 /> Match accounts</button><button className="primary-button"><Plus /> Track account</button></>} /><Suspense fallback={<div className="skeleton skeleton-panel" />}><AccountTable accounts={data.accounts} /></Suspense></div>; }
