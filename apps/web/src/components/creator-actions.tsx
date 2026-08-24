"use client";

import { FilePlus2, LoaderCircle, ShieldAlert, ShieldCheck, UserRoundCheck } from "lucide-react";
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
    router.push(`/creators/${creatorId}?tab=content`); router.refresh();
  };
  return <div className="account-match-control"><Select value={creatorId} onValueChange={setCreatorId}><SelectTrigger className="w-full"><SelectValue placeholder="Select a creator" /></SelectTrigger><SelectContent>{creators.map((creator) => <SelectItem key={creator.id} value={creator.id}>{creator.displayName}{creator.discordUsername ? ` (@${creator.discordUsername})` : ""}</SelectItem>)}</SelectContent></Select><Button disabled={pending || !creatorId} onClick={submit}><UserRoundCheck />{pending ? "Linking…" : currentCreatorId === creatorId ? "Confirm creator" : "Link to creator"}</Button>{error ? <span className="form-error">{error}</span> : null}</div>;
}

export function CreatorQuickActions({ creatorId, discordMissing }: { creatorId: string; discordMissing: boolean }) {
  const [pending, setPending] = useState<string | null>(null); const router = useRouter();
  const run = async (type: "reconcile_creator" | "restore_access") => { setPending(type); await fetch(`/api/creators/${creatorId}/discord-operations`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type }) }); setPending(null); router.refresh(); };
  return <>{discordMissing ? <Button variant="outline" disabled={Boolean(pending)} onClick={() => run("restore_access")}>{pending ? <LoaderCircle className="spin" /> : <UserRoundCheck />} Queue access restore</Button> : <Button variant="outline" disabled={Boolean(pending)} onClick={() => run("reconcile_creator")}>{pending ? <LoaderCircle className="spin" /> : <UserRoundCheck />} Reconcile Discord</Button>}</>;
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
