import { Plus, UserRoundSearch } from "lucide-react";
import { Suspense } from "react";
import { CreatorAccountsRoster } from "@/components/data-tables";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getPortalData } from "@/lib/portal-data";

export default async function CreatorsPage() {
  await requireUser(); const data = await getPortalData();
  return <div className="page-stack"><PageTitle eyebrow="CREATOR ROSTER" title="Creators & accounts" description="Creators, connected posting accounts, access, signing, and performance in one expandable view." actions={<Button><Plus /> Add creator</Button>} />{data.sourceMode === "live_provider" ? <div className="source-banner compact"><UserRoundSearch /><div><strong>{data.creators.length} creator candidates found from tracked accounts</strong><span>Confirm each match after Neon is connected. Result will not infer signing or Discord state from a username.</span></div></div> : null}<Suspense fallback={<div className="skeleton skeleton-panel" />}><CreatorAccountsRoster creators={data.creators} /></Suspense></div>;
}
