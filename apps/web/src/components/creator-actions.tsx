"use client";

import { FilePlus2, LoaderCircle, ShieldAlert, ShieldCheck, UserRoundCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CandidateActions({ accountId }: { accountId: string }) {
  const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null); const router = useRouter();
  const promote = async () => { setPending(true); setError(null); const response = await fetch(`/api/accounts/${accountId}/promote`, { method: "POST" }); const body = await response.json(); setPending(false); if (!response.ok) { setError(body.error ?? "Could not confirm creator"); return; } router.push(`/creators/${body.creatorId}`); router.refresh(); };
  return <div className="action-with-error"><button className="primary-button" onClick={promote} disabled={pending}>{pending ? <LoaderCircle className="spin" /> : <UserRoundCheck />}{pending ? "Confirming…" : "Confirm as new creator"}</button>{error ? <span><ShieldAlert />{error}</span> : null}</div>;
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
  return <div className="account-match-control"><select value={creatorId} onChange={(event) => setCreatorId(event.target.value)} aria-label="Creator"><option value="" disabled>Select a creator</option>{creators.map((creator) => <option key={creator.id} value={creator.id}>{creator.displayName}{creator.discordUsername ? ` (@${creator.discordUsername})` : ""}</option>)}</select><button className="primary-button" disabled={pending || !creatorId} onClick={submit}><UserRoundCheck />{pending ? "Linking…" : currentCreatorId === creatorId ? "Confirm creator" : "Link to creator"}</button>{error ? <span className="form-error">{error}</span> : null}</div>;
}

export function CreatorQuickActions({ creatorId, discordMissing }: { creatorId: string; discordMissing: boolean }) {
  const [pending, setPending] = useState<string | null>(null); const router = useRouter();
  const run = async (type: "reconcile_creator" | "restore_access") => { setPending(type); await fetch(`/api/creators/${creatorId}/discord-operations`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type }) }); setPending(null); router.refresh(); };
  return <>{discordMissing ? <button className="secondary-button" disabled={Boolean(pending)} onClick={() => run("restore_access")}>{pending ? <LoaderCircle className="spin" /> : <UserRoundCheck />} Queue access restore</button> : <button className="secondary-button" disabled={Boolean(pending)} onClick={() => run("reconcile_creator")}>{pending ? <LoaderCircle className="spin" /> : <UserRoundCheck />} Reconcile Discord</button>}</>;
}

export function NoteButton({ creatorId }: { creatorId: string }) {
  const [open, setOpen] = useState(false); const [body, setBody] = useState(""); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null); const router = useRouter();
  const submit = async () => { setPending(true); setError(null); const response = await fetch(`/api/creators/${creatorId}/notes`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body }) }); const result = await response.json(); setPending(false); if (!response.ok) { setError(result.error ?? "Could not save note"); return; } setBody(""); setOpen(false); router.refresh(); };
  return <><button className="secondary-button" onClick={() => setOpen(true)}><FilePlus2 /> Add note</button>{open ? <div className="mini-modal-backdrop" onMouseDown={() => setOpen(false)}><section className="mini-modal" onMouseDown={(event) => event.stopPropagation()}><header><div><strong>Add internal note</strong><span>Visible only to the Result team</span></div><button onClick={() => setOpen(false)}><X /></button></header><textarea autoFocus value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write context, feedback, or a follow-up…" rows={6} />{error ? <p className="form-error">{error}</p> : null}<footer><button className="secondary-button" onClick={() => setOpen(false)}>Cancel</button><button className="primary-button" onClick={submit} disabled={pending || !body.trim()}>{pending ? "Saving…" : "Save note"}</button></footer></section></div> : null}</>;
}

export function ManualRelationshipButton({ creatorId }: { creatorId: string }) {
  const [open, setOpen] = useState(false); const [pending, setPending] = useState(false); const [provider, setProvider] = useState("sideshift"); const [program, setProgram] = useState(""); const [state, setState] = useState("signed_active"); const [error, setError] = useState<string | null>(null); const router = useRouter();
  const submit = async () => { setPending(true); setError(null); const response = await fetch(`/api/creators/${creatorId}/relationships`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider, program: program || null, state }) }); const result = await response.json(); setPending(false); if (!response.ok) { setError(result.error ?? "Could not add relationship"); return; } setOpen(false); router.refresh(); };
  return <><button className="primary-button" onClick={() => setOpen(true)}><ShieldCheck /> Add manual relationship</button>{open ? <div className="mini-modal-backdrop" onMouseDown={() => setOpen(false)}><section className="mini-modal" onMouseDown={(event) => event.stopPropagation()}><header><div><strong>Verify signing relationship</strong><span>Saved as manual, not API-synchronized</span></div><button onClick={() => setOpen(false)}><X /></button></header><label>Provider<select value={provider} onChange={(event) => setProvider(event.target.value)}><option value="sideshift">SideShift</option><option value="other">Other</option><option value="launchpoint">Launchpoint (manual)</option></select></label><label>Program<input value={program} onChange={(event) => setProgram(event.target.value)} placeholder="Optional program name" /></label><label>Relationship state<select value={state} onChange={(event) => setState(event.target.value)}><option value="signed_active">Signed active</option><option value="signed_upcoming">Signed upcoming</option><option value="expiring">Expiring</option><option value="inactive">Inactive</option><option value="pending">Pending</option></select></label>{error ? <p className="form-error">{error}</p> : null}<footer><button className="secondary-button" onClick={() => setOpen(false)}>Cancel</button><button className="primary-button" onClick={submit} disabled={pending}>{pending ? "Saving…" : "Save relationship"}</button></footer></section></div> : null}</>;
}
