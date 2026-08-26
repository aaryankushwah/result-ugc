import { NotebookPen, Plus, UserRoundSearch, UsersRound } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { CreatorNotesBoard } from "@/components/creator-notes-board";
import { CreatorAccountsRoster } from "@/components/data-tables";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { normalizeCreatorPageView } from "@/lib/creator-notes";
import { getPortalData } from "@/lib/portal-data";

export default async function CreatorsPage({ searchParams }:{ searchParams:Promise<{ view?:string }> }) {
  await requireUser();
  const [query,data]=await Promise.all([searchParams,getPortalData()]);
  const view=normalizeCreatorPageView(query.view);
  const creators=data.creators.filter((creator)=>creator.source==="result");

  return <div className="page-stack creator-page">
    <PageTitle eyebrow="CREATOR ROSTER" title="Creators & accounts" description="Creators, connected posting accounts, access, signing, and performance in one expandable view." actions={<Button><Plus/>Add creator</Button>}/>
    <nav className="creator-page-view-tabs" aria-label="Creator views">
      <Link href="/creators" className={view==="creators"?"active":""}><UsersRound/>Creators</Link>
      <Link href="/creators?view=notes" className={view==="notes"?"active":""}><NotebookPen/>Notes</Link>
    </nav>
    {view==="creators"?<>
      {data.sourceMode==="live_provider"?<div className="source-banner compact"><UserRoundSearch/><div><strong>{data.creators.length} creator candidates found from tracked accounts</strong><span>Confirm each match after Neon is connected. Result will not infer signing or Discord state from a username.</span></div></div>:null}
      <Suspense fallback={<div className="skeleton skeleton-panel"/>}><CreatorAccountsRoster creators={data.creators} videos={data.videos}/></Suspense>
    </>:null}
    {view==="notes"?<CreatorNotesBoard creators={creators.map((creator)=>({id:creator.id,displayName:creator.displayName,username:creator.discord.username??creator.accounts[0]?.username??null,avatarUrl:creator.discord.avatarUrl??creator.accounts[0]?.avatarUrl??null,notes:creator.notes}))}/>:null}
  </div>;
}
