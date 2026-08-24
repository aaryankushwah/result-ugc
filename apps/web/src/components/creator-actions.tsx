"use client";

import { FilePlus2, LoaderCircle, Search, ShieldAlert, ShieldCheck, UserRoundCheck, UserRoundX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function CandidateActions({ accountId }: { accountId: string }) {
  const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null); const router = useRouter();
  const promote = async () => { setPending(true); setError(null); const response = await fetch(`/api/accounts/${accountId}/promote`, { method: "POST" }); const body = await response.json(); setPending(false); if (!response.ok) { setError(body.error ?? "Could not confirm creator"); return; } router.push(`/creators/${body.creatorId}`); router.refresh(); };
  return <div className="action-with-error"><Button onClick={promote} disabled={pending}>{pending ? <LoaderCircle className="spin" /> : <UserRoundCheck />}{pending ? "Confirming…" : "Confirm as new creator"}</Button>{error ? <span><ShieldAlert />{error}</span> : null}</div>;
}

export function AccountMatchControl({ accountId, creators, currentCreatorId }: { accountId: string; creators: Array<{ id: string; displayName: string; discordUsername: string | null }>; currentCreatorId: string | null }) {
  const [creatorId, setCreatorId] = useState(currentCreatorId ?? creators[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const submit = async () => {
    if (!creatorId) return;
    setPending(true); setError(null);
    const response = await fetch(`/api/accounts/${accountId}/link`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ creatorId }) });
    const body = await response.json(); setPending(false);
    if (!response.ok) { setError(body.error ?? "Could not link account"); return; }
    router.push(`/creators/${creatorId}?tab=accounts`); router.refresh();
  };
  return <div className="account-match-control"><Select value={creatorId} onValueChange={setCreatorId}><SelectTrigger className="w-full"><SelectValue placeholder="Select a creator" /></SelectTrigger><SelectContent>{creators.map((creator) => <SelectItem key={creator.id} value={creator.id}>{creator.displayName}{creator.discordUsername ? ` (@${creator.discordUsername})` : ""}</SelectItem>)}</SelectContent></Select><Button disabled={pending || !creatorId} onClick={submit}><UserRoundCheck />{pending ? "Linking…" : currentCreatorId === creatorId ? "Confirm creator" : "Link to creator"}</Button>{error ? <span className="form-error">{error}</span> : null}</div>;
}

export function AccountAssignmentButton({
  accountId,
  username,
  creators,
  currentCreatorId,
  linkState,
}: {
  accountId: string;
  username: string;
  creators: Array<{ id: string; displayName: string; discordUsername: string | null }>;
  currentCreatorId: string | null;
  linkState: "suggested" | "confirmed" | "unlinked";
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creatorId, setCreatorId] = useState(currentCreatorId ?? "");
  const [pending, setPending] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const filteredCreators = creators.filter((creator) => `${creator.displayName} ${creator.discordUsername ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  const assign = async (targetCreatorId = creatorId) => {
    if (!targetCreatorId) return;
    setPending(true); setError(null);
    const response = await fetch(`/api/accounts/${accountId}/link`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ creatorId: targetCreatorId }) });
    const result = await response.json(); setPending(false);
    if (!response.ok) { setError(result.error ?? "Could not assign account"); return; }
    setConfirmed(true); setOpen(false); router.refresh();
  };
  const unassign = async () => {
    setPending(true); setError(null);
    const response = await fetch(`/api/accounts/${accountId}/link`, { method: "DELETE" });
    const result = await response.json(); setPending(false);
    if (!response.ok) { setError(result.error ?? "Could not remove assignment"); return; }
    setCreatorId(""); setOpen(false); router.refresh();
  };

  if (linkState === "suggested" && currentCreatorId) {
    return (
      <Button
        variant="outline"
        size="xs"
        className="account-assign-trigger"
        disabled={pending || confirmed}
        title={error ?? undefined}
        onClick={() => void assign(currentCreatorId)}
      >
        {pending ? <LoaderCircle className="spin" /> : <UserRoundCheck />}
        {pending ? "Confirming…" : confirmed ? "Confirmed" : error ? "Retry" : "Confirm"}
      </Button>
    );
  }

  const triggerLabel = linkState === "suggested" ? "Confirm" : currentCreatorId ? "Reassign" : "Assign";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="xs" className="account-assign-trigger"><UserRoundCheck /> {triggerLabel}</Button></DialogTrigger>
      <DialogContent className="account-assignment-dialog">
        <DialogHeader><DialogTitle>Assign @{username}</DialogTitle><DialogDescription>Choose the one canonical Result creator who owns this posting account.</DialogDescription></DialogHeader>
        <div className="assignment-search"><Search /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search creators or Discord usernames…" /></div>
        <div className="assignment-creator-list">
          {filteredCreators.length ? filteredCreators.map((creator) => (
            <button type="button" className={creatorId === creator.id ? "selected" : ""} onClick={() => setCreatorId(creator.id)} key={creator.id}>
              <span>{creator.displayName.slice(0, 1).toUpperCase()}</span>
              <span><strong>{creator.displayName}</strong><small>{creator.discordUsername ? `Discord @${creator.discordUsername}` : "No Discord identity"}</small></span>
              <i>{creatorId === creator.id ? <UserRoundCheck /> : null}</i>
            </button>
          )) : <p>No creators match that search.</p>}
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <DialogFooter className="account-assignment-footer">
          {currentCreatorId ? <Button variant="ghost" className="unassign-button" disabled={pending} onClick={unassign}><UserRoundX /> Unassign</Button> : null}
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={pending || !creatorId} onClick={() => void assign()}>{pending ? <LoaderCircle className="spin" /> : <UserRoundCheck />}{pending ? "Saving…" : linkState === "suggested" && creatorId === currentCreatorId ? "Confirm match" : "Save assignment"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type DiscordConnectionCandidate = { creatorId: string; userId: string; username: string | null; displayName: string; state: string };

function DiscordConnectionButton({ creatorId, candidates }: { creatorId: string; candidates: DiscordConnectionCandidate[] }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [discordUserId, setDiscordUserId] = useState("");
  const [sourceCreatorId, setSourceCreatorId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const filtered = candidates.filter((candidate) => `${candidate.displayName} ${candidate.username ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const connect = async () => {
    setPending(true); setError(null);
    const response = await fetch(`/api/creators/${creatorId}/discord-link`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ discordUserId, sourceCreatorId }) });
    const result = await response.json(); setPending(false);
    if (!response.ok) { setError(result.error ?? "Could not connect Discord"); return; }
    setQueued(true); setOpen(false); router.refresh();
  };
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="outline" disabled={queued}><UserRoundCheck />{queued ? "Connection queued" : "Connect Discord"}</Button></DialogTrigger>
    <DialogContent className="account-assignment-dialog">
      <DialogHeader><DialogTitle>Connect Discord member</DialogTitle><DialogDescription>Link the actual Discord member to this canonical creator, then restore their Result roles and private channel.</DialogDescription></DialogHeader>
      {candidates.length ? <>
        <div className="assignment-search"><Search /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search synced Discord members…" /></div>
        <div className="assignment-creator-list discord-candidate-list">
          {filtered.length ? filtered.map((candidate) => <button type="button" className={discordUserId === candidate.userId ? "selected" : ""} onClick={() => { setDiscordUserId(candidate.userId); setSourceCreatorId(candidate.creatorId); setError(null); }} key={candidate.userId}>
            <span>{candidate.displayName.slice(0, 1).toUpperCase()}</span>
            <span><strong>{candidate.displayName}</strong><small>{candidate.username ? `Discord @${candidate.username}` : candidate.userId}</small></span>
            <i>{discordUserId === candidate.userId ? <UserRoundCheck /> : null}</i>
          </button>) : <p>No synced Discord members match that search.</p>}
        </div>
        <div className="discord-candidate-divider"><span>or use a Discord user ID</span></div>
      </> : null}
      <label className="form-field">Discord user ID<Input inputMode="numeric" value={discordUserId} onChange={(event) => { setDiscordUserId(event.target.value.replace(/\D/g, "")); setSourceCreatorId(null); setError(null); }} placeholder="e.g. 459809259580948480" /></label>
      <p className="discord-id-help">In Discord, enable Developer Mode, right-click the member, then choose Copy User ID.</p>
      {error ? <p className="form-error">{error}</p> : null}
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={pending || !/^\d{15,22}$/.test(discordUserId)} onClick={connect}>{pending ? <LoaderCircle className="spin" /> : <UserRoundCheck />}{pending ? "Connecting…" : "Connect & restore access"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

export function CreatorQuickActions({ creatorId, discordState, discordUserId, candidates }: { creatorId: string; discordState: string; discordUserId: string | null; candidates: DiscordConnectionCandidate[] }) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const run = async (type: "reconcile_creator" | "restore_access") => {
    setPending(type); setError(null);
    const response = await fetch(`/api/creators/${creatorId}/discord-operations`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type }) });
    const result = await response.json(); setPending(null);
    if (!response.ok) { setError(result.error ?? "Discord operation could not be queued"); return; }
    router.refresh();
  };
  if (!discordUserId) return <DiscordConnectionButton creatorId={creatorId} candidates={candidates} />;
  const missing = discordState !== "connected";
  return <div className="action-with-error">{missing ? <Button variant="outline" disabled={Boolean(pending)} onClick={() => void run("restore_access")}>{pending ? <LoaderCircle className="spin" /> : <UserRoundCheck />} Restore Discord access</Button> : <Button variant="outline" disabled={Boolean(pending)} onClick={() => void run("reconcile_creator")}>{pending ? <LoaderCircle className="spin" /> : <UserRoundCheck />} Reconcile Discord</Button>}{error ? <span><ShieldAlert />{error}</span> : null}</div>;
}

export function NoteButton({ creatorId }: { creatorId: string }) {
  const [open, setOpen] = useState(false); const [body, setBody] = useState(""); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null); const router = useRouter();
  const submit = async () => { setPending(true); setError(null); const response = await fetch(`/api/creators/${creatorId}/notes`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body }) }); const result = await response.json(); setPending(false); if (!response.ok) { setError(result.error ?? "Could not save note"); return; } setBody(""); setOpen(false); router.refresh(); };
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline"><FilePlus2 /> Add note</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Add internal note</DialogTitle><DialogDescription>Visible only to the Result team.</DialogDescription></DialogHeader><Textarea autoFocus value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write context, feedback, or a follow-up…" rows={6} />{error ? <p className="form-error">{error}</p> : null}<DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit} disabled={pending || !body.trim()}>{pending ? "Saving…" : "Save note"}</Button></DialogFooter></DialogContent></Dialog>;
}

export function ManualRelationshipButton({ creatorId }: { creatorId: string }) {
  const [open, setOpen] = useState(false); const [pending, setPending] = useState(false); const [provider, setProvider] = useState("sideshift"); const [program, setProgram] = useState(""); const [state, setState] = useState("signed_active"); const [error, setError] = useState<string | null>(null); const router = useRouter();
  const submit = async () => { setPending(true); setError(null); const response = await fetch(`/api/creators/${creatorId}/relationships`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider, program: program || null, state }) }); const result = await response.json(); setPending(false); if (!response.ok) { setError(result.error ?? "Could not add relationship"); return; } setOpen(false); router.refresh(); };
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><ShieldCheck /> Add manual relationship</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Verify signing relationship</DialogTitle><DialogDescription>Saved as manually verified, not API-synchronized.</DialogDescription></DialogHeader><label className="form-field">Provider<Select value={provider} onValueChange={setProvider}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sideshift">SideShift</SelectItem><SelectItem value="other">Other</SelectItem><SelectItem value="launchpoint">Launchpoint (manual)</SelectItem></SelectContent></Select></label><label className="form-field">Program<Input value={program} onChange={(event) => setProgram(event.target.value)} placeholder="Optional program name" /></label><label className="form-field">Relationship state<Select value={state} onValueChange={setState}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="signed_active">Signed active</SelectItem><SelectItem value="signed_upcoming">Signed upcoming</SelectItem><SelectItem value="expiring">Expiring</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="pending">Pending</SelectItem></SelectContent></Select></label>{error ? <p className="form-error">{error}</p> : null}<DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit} disabled={pending}>{pending ? "Saving…" : "Save relationship"}</Button></DialogFooter></DialogContent></Dialog>;
}
