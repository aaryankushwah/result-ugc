"use client";

import { Check, ChevronDown, LoaderCircle, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SourceImage } from "@/components/source-image";
import { noteInputPlaceholder } from "@/lib/creator-notes";

type CreatorNote={id:string;body:string;author:string|null;createdAt:string};
type NotesCreator={id:string;displayName:string;username:string|null;avatarUrl:string|null;notes:CreatorNote[]};

function noteDate(value:string):string{return new Intl.DateTimeFormat("en",{month:"short",day:"numeric",year:"numeric"}).format(new Date(value));}

export function CreatorNotesBoard({creators}:{creators:NotesCreator[]}) {
  const router=useRouter();
  const [drafts,setDrafts]=useState<Record<string,string>>({});
  const [pending,setPending]=useState<string|null>(null);
  const [saved,setSaved]=useState<string|null>(null);
  const [openCreator,setOpenCreator]=useState<string|null>(null);
  const [errors,setErrors]=useState<Record<string,string>>({});
  const submit=async(creator:NotesCreator)=>{
    const body=(drafts[creator.id]??"").trim();
    if(!body||pending)return;
    setPending(creator.id); setSaved(null); setErrors((current)=>({...current,[creator.id]:""}));
    const response=await fetch(`/api/creators/${creator.id}/notes`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({body})});
    const result=await response.json() as {error?:string};
    setPending(null);
    if(!response.ok){setErrors((current)=>({...current,[creator.id]:result.error??"Could not save note"}));return;}
    setDrafts((current)=>({...current,[creator.id]:""})); setSaved(creator.id); router.refresh(); window.setTimeout(()=>setSaved((current)=>current===creator.id?null:current),1800);
  };
  return <section className="creator-notes-board" aria-label="Creator notes">
    {creators.map((creator)=>{const latest=creator.notes[0];const isOpen=openCreator===creator.id;const historyId=`creator-note-history-${creator.id}`;return <article key={creator.id}>
      <div className="creator-note-identity"><span>{creator.avatarUrl?<SourceImage src={creator.avatarUrl} width={40} height={40}/>:creator.displayName.slice(0,1).toUpperCase()}</span><div><strong>{creator.displayName}</strong><small>{creator.username?`@${creator.username}`:`${creator.notes.length} saved note${creator.notes.length===1?"":"s"}`}</small></div></div>
      {latest?<button type="button" className="creator-note-preview" aria-expanded={isOpen} aria-controls={historyId} onClick={()=>setOpenCreator((current)=>current===creator.id?null:creator.id)}><span><strong>{latest.body}</strong><small>{creator.notes.length} note{creator.notes.length===1?"":"s"} · Open history</small></span><ChevronDown/></button>:<div className="creator-note-preview empty"><span><strong>No saved notes</strong><small>Add the first note</small></span></div>}
      <div className="creator-note-composer"><input value={drafts[creator.id]??""} onChange={(event)=>setDrafts((current)=>({...current,[creator.id]:event.target.value}))} onKeyDown={(event)=>{if(event.key==="Enter"){event.preventDefault();void submit(creator);}}} placeholder={noteInputPlaceholder(creator.displayName)} aria-label={`Add note for ${creator.displayName}`}/><button type="button" disabled={pending===creator.id||!(drafts[creator.id]??"").trim()} onClick={()=>void submit(creator)}>{pending===creator.id?<LoaderCircle className="spin"/>:saved===creator.id?<Check/>:<Save/>}<span>{pending===creator.id?"Saving":saved===creator.id?"Saved":"Save"}</span></button>{errors[creator.id]?<p>{errors[creator.id]}</p>:null}</div>
      {isOpen?<section className="creator-note-history" id={historyId}><header><strong>Note history</strong><span>{creator.notes.length} saved</span></header><div>{creator.notes.map((note)=><div key={note.id}><p>{note.body}</p><small>{note.author??"Result team"} · <time dateTime={note.createdAt}>{noteDate(note.createdAt)}</time></small></div>)}</div></section>:null}
    </article>})}
    {!creators.length?<div className="creator-notes-empty">No creators to add notes to yet.</div>:null}
  </section>;
}
