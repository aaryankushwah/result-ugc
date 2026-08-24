"use client";

import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Clipboard,
  Clock3,
  Copy,
  ExternalLink,
  LayoutDashboard,
  Link2,
  Plus,
  Search,
  Send,
  Sparkles,
  Table2,
  UserRoundCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { estimateScriptDuration, scriptHookFromText, segmentTranscript } from "@/lib/script-writing";
import { mergeScriptAssignments, referencePlatformFromUrl } from "@/lib/script-studio-state";
import type { ScriptStudioData, StudioCreator, StudioScript } from "@/lib/script-studio-data";

type StudioScreen = "bank" | "writer";


export function ScriptStudio({ initialData, canManage }: { initialData: ScriptStudioData; canManage: boolean }) {
  const [screen, setScreen] = useState<StudioScreen>("bank");
  const [scripts, setScripts] = useState(initialData.scripts);
  const [active, setActive] = useState<StudioScript | null>(initialData.scripts[0] ?? null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [importOpen, setImportOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const filtered = useMemo(() => scripts.filter((script) => {
    const haystack = `${script.title} ${script.hook ?? ""} ${script.assignments.map((assignment) => assignment.creatorName).join(" ")}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  }), [query, scripts]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  };

  const openWriter = (script: StudioScript) => { setActive(script); setScreen("writer"); };

  const createDraft = (input: { title: string; body: string; url: string; creator: string }) => {
    const body = input.body.trim();
    const sections = [plainScriptSection(body)];
    const next: StudioScript = {
      id: `session-${crypto.randomUUID()}`,
      latestVersion: 0,
      title: input.title.trim(),
      status: "draft",
      pipelineStage: "not_started",
      priority: "medium",
      category: "Uncategorized",
      format: "Talking head",
      tags: [],
      targetPlatform: "instagram",
      durationSeconds: estimateScriptDuration(sections),
      hook: scriptHookFromText(body),
      sections,
      reference: input.url.trim() ? {
        id: `session-reference-${crypto.randomUUID()}`,
        sourcePlatform: referencePlatformFromUrl(input.url),
        sourceUrl: input.url.trim(),
        sourceCreator: input.creator.trim() || null,
        transcript: body,
        transcriptSections: segmentTranscript(body),
      } : null,
      assignments: [],
      assets: [],
      performance: { tests:0, liveTests:0, views:0, hookRate:null, averageWatchTimeSeconds:null },
      updatedAt: new Date().toISOString(),
    };
    setScripts((current) => [next, ...current]);
    setActive(next);
    setScreen("writer");
    setImportOpen(false);
    notify("Draft created");
  };

  const updateActive = (updater: (script: StudioScript) => StudioScript) => {
    setActive((current) => {
      if (!current) return current;
      const next = updater(current);
      setScripts((items) => items.map((item) => item.id === current.id ? next : item));
      return next;
    });
  };

  const persistScript = async (script: StudioScript, changeSummary = "Saved from Script Studio") => {
    const persisted = isUuid(script.id);
    const body = persisted ? {
      title: script.title,
      status: script.status,
      pipelineStage: script.pipelineStage,
      priority: script.priority,
      category: script.category,
      format: script.format,
      tags: script.tags,
      targetPlatform: script.targetPlatform,
      sections: script.sections,
      changeSummary,
    } : {
      title: script.title,
      pipelineStage: script.pipelineStage,
      priority: script.priority,
      category: script.category,
      format: script.format,
      tags: script.tags,
      targetPlatform: script.targetPlatform,
      sections: script.sections,
      brandSnapshot: initialData.brand,
      reference: script.reference ? {
        sourcePlatform: script.reference.sourcePlatform,
        sourceUrl: script.reference.sourceUrl,
        sourceCreator: script.reference.sourceCreator,
        transcript: script.reference.transcript,
        transcriptSections: script.reference.transcriptSections,
      } : null,
    };
    const response = await fetch(persisted ? `/api/scripts/${script.id}` : "/api/scripts", {
      method: persisted ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json() as { id?: string; version?: number; error?: string };
    if (!response.ok) throw new Error(result.error ?? "Script could not be saved");
    return { id: result.id ?? script.id, version: result.version ?? (persisted ? script.latestVersion + 1 : 1) };
  };

  const save = async () => {
    if (!active || !canManage) return;
    setSaving(true);
    try {
      const result = await persistScript(active);
      updateActive((script) => ({ ...script, id: result.id, latestVersion: result.version, updatedAt: new Date().toISOString() }));
      notify("Saved to the script bank");
    } catch (error) {
      if (initialData.sourceMode === "preview") notify("Saved in this preview session · connect the database to persist it");
      else notify(error instanceof Error ? error.message : "Script could not be saved");
    } finally {
      setSaving(false);
    }
  };

  const assign = async (creatorIds: string[], dueAt: string, message: string) => {
    if (!active) return;
    setAssigning(true);
    setAssignOpen(false);
    const selectedCreators = initialData.creators.filter((creator) => creatorIds.includes(creator.id));
    const nextAssignments = selectedCreators.map((creator, index) => ({ id:`session-assignment-${index}`, creatorId:creator.id, creatorName:creator.name, state:"assigned", dueAt:dueAt ? new Date(`${dueAt}T12:00:00Z`).toISOString() : null }));
    try {
      const saved = isUuid(active.id) ? { id: active.id, version: active.latestVersion } : await persistScript(active, "Saved before creator assignment");
      if (!creatorIds.every(isUuid)) throw new Error("Only saved Result creators can receive assignments");
      const response = await fetch(`/api/scripts/${saved.id}/assignments`, { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ creatorIds, dueAt:dueAt ? new Date(`${dueAt}T12:00:00Z`).toISOString() : null, message }) });
      const result = await response.json() as { assignments?: Array<{ creatorId:string; creatorName:string; state:string; dueAt:string|null }>; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Assignment could not be saved");
      const persistedAssignments = (result.assignments ?? nextAssignments).map((assignment,index) => ({ ...assignment, id:`assignment-${assignment.creatorId}-${index}` }));
      updateActive((script) => ({ ...script, id:saved.id, latestVersion:saved.version, status:"assigned", assignments:mergeScriptAssignments(script.assignments,persistedAssignments), updatedAt:new Date().toISOString() }));
      notify(`Assigned to ${selectedCreators.map((creator) => creator.name.split(" ")[0]).join(" and ")}`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Assignment could not be saved");
      setAssignOpen(true);
    } finally {
      setAssigning(false);
    }
  };

  const updateCardMetadata = async (script: StudioScript, patch: Partial<Pick<StudioScript,"pipelineStage"|"category"|"priority">>) => {
    const next = { ...script, ...patch, updatedAt:new Date().toISOString() };
    setScripts((current) => current.map((item) => item.id === script.id ? next : item));
    if (active?.id === script.id) setActive(next);
    if (!isUuid(script.id)) return;
    try {
      const response = await fetch(`/api/scripts/${script.id}`, { method:"PATCH", headers:{"content-type":"application/json"}, body:JSON.stringify({
        title:next.title, status:next.status, pipelineStage:next.pipelineStage, priority:next.priority, category:next.category, format:next.format, tags:next.tags, targetPlatform:next.targetPlatform, sections:next.sections, changeSummary:patch.pipelineStage ? `Moved to ${patch.pipelineStage}` : "Script metadata updated",
      }) });
      if (!response.ok) throw new Error("Pipeline update failed");
    } catch {
      notify("Updated in this session · database sync failed");
    }
  };

  return <div className="script-studio-shell">
    {screen === "bank" ? <ScriptBank scripts={filtered} allScripts={scripts} query={query} setQuery={setQuery} status={status} setStatus={setStatus} openWriter={openWriter} openImport={() => setImportOpen(true)} updateMetadata={updateCardMetadata} canManage={canManage} sourceMode={initialData.sourceMode} /> : active ? <ScriptWriter script={active} updateScript={updateActive} goBack={() => setScreen("bank")} save={save} saving={saving} assigning={assigning} openAssign={() => setAssignOpen(true)} notify={notify} canManage={canManage} /> : null}
    <NewScriptDialog open={importOpen} setOpen={setImportOpen} onCreate={createDraft} />
    <AssignDialog key={`${active?.id ?? "none"}-${assignOpen ? "open" : "closed"}`} open={assignOpen} setOpen={setAssignOpen} script={active} creators={initialData.creators} assigning={assigning} onAssign={assign} />
    {toast ? <div className="studio-toast" role="status"><Check />{toast}</div> : null}
  </div>;
}

function ScriptBank({ scripts, allScripts, query, setQuery, status, setStatus, openWriter, openImport, updateMetadata, canManage, sourceMode }: { scripts:StudioScript[]; allScripts:StudioScript[]; query:string; setQuery:(value:string)=>void; status:string; setStatus:(value:string)=>void; openWriter:(script:StudioScript)=>void; openImport:()=>void; updateMetadata:(script:StudioScript,patch:Partial<Pick<StudioScript,"pipelineStage"|"category"|"priority">>)=>void; canManage:boolean; sourceMode:ScriptStudioData["sourceMode"] }) {
  const [view,setView]=useState<"pipeline"|"table">("pipeline");
  const [dragged,setDragged]=useState<string|null>(null);
  const stages = [
    { id:"not_started" as const, label:"Not started", description:"Ideas and references", tone:"neutral" },
    { id:"testing" as const, label:"Testing", description:"Live creative tests", tone:"testing" },
    { id:"iterate" as const, label:"Keep testing", description:"Promising—make variants", tone:"iterate" },
    { id:"winner" as const, label:"Double down", description:"Proven winners", tone:"winner" },
    { id:"retired" as const, label:"Retired", description:"Stopped or archived", tone:"retired" },
  ];
  const categories=["all",...Array.from(new Set(allScripts.map((script)=>script.category))).sort()];
  const filteredByCategory=scripts.filter((script)=>status==="all"||script.category===status);
  const totalViews=allScripts.reduce((sum,script)=>sum+script.performance.views,0);
  const hookRates=allScripts.map((script)=>script.performance.hookRate).filter((value):value is number=>value!==null);
  const activeTests=allScripts.filter((script)=>script.pipelineStage==="testing").length;
  const winners=allScripts.filter((script)=>script.pipelineStage==="winner").length;
  const move=(stage:StudioScript["pipelineStage"])=>{const script=allScripts.find((item)=>item.id===dragged);if(script&&script.pipelineStage!==stage)updateMetadata(script,{pipelineStage:stage});setDragged(null);};
  return <div className="script-bank pipeline-home">
    <div className="pipeline-titlebar"><div><p className="eyebrow">CREATIVE TESTING SYSTEM</p><h1>Script pipeline</h1><p>Every concept moves from reference to test, iteration, and a measurable winner.</p></div><div className="pipeline-title-actions">{sourceMode==="database"?<span className="neon-live"><i/>Neon live</span>:null}{canManage?<Button className="studio-primary" onClick={openImport}><Plus/>New script</Button>:null}</div></div>
    {sourceMode==="preview"?<div className="studio-preview-banner"><Sparkles/><div><strong>Preview data</strong><span>Neon is connected. Create the first real script to replace these example cards.</span></div></div>:null}
    <div className="pipeline-overview"><article><span>ACTIVE TESTS</span><strong>{activeTests}</strong><small>{allScripts.reduce((sum,script)=>sum+script.performance.liveTests,0)} variants live</small></article><article><span>TESTED VIEWS</span><strong>{compactNumber(totalViews)}</strong><small>Across tracked variants</small></article><article><span>WINNING CONCEPTS</span><strong>{winners}</strong><small>{allScripts.length?Math.round(winners/allScripts.length*100):0}% winner rate</small></article><article><span>AVG. HOOK RATE</span><strong>{hookRates.length?`${Math.round(hookRates.reduce((sum,value)=>sum+value,0)/hookRates.length*100)}%`:"—"}</strong><small>Across measured tests</small></article></div>
    <div className="pipeline-controls"><div className="pipeline-views"><button className={view==="pipeline"?"active":""} onClick={()=>setView("pipeline")}><LayoutDashboard/>Pipeline</button><button className={view==="table"?"active":""} onClick={()=>setView("table")}><Table2/>Table</button></div><div className="category-tabs">{categories.slice(0,7).map((category)=><button key={category} className={status===category?"active":""} onClick={()=>setStatus(category)}>{category==="all"?"All categories":category}<span>{category==="all"?allScripts.length:allScripts.filter((script)=>script.category===category).length}</span></button>)}</div><label className="pipeline-search"><Search/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search scripts"/></label></div>
    {view==="pipeline"?<div className="pipeline-board">{stages.map((stage)=>{const cards=filteredByCategory.filter((script)=>script.pipelineStage===stage.id);return <section className={`pipeline-column tone-${stage.tone}`} key={stage.id} onDragOver={(event)=>event.preventDefault()} onDrop={()=>move(stage.id)}><header><div><span><i/>{stage.label}</span><strong>{cards.length}</strong></div><p>{stage.description}</p></header><div className="pipeline-cards">{cards.map((script)=><article className="pipeline-card" key={script.id} draggable={canManage} onDragStart={()=>setDragged(script.id)} onDragEnd={()=>setDragged(null)} data-dragging={dragged===script.id||undefined}><div className="pipeline-card-top"><span className="pipeline-platform">{script.targetPlatform}</span><select value={script.priority} onChange={(event)=>updateMetadata(script,{priority:event.target.value as StudioScript["priority"]})} onClick={(event)=>event.stopPropagation()} aria-label={`${script.title} priority`}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></div><button className="pipeline-card-title" onClick={()=>openWriter(script)}><strong>{script.title}</strong><p>{script.hook??"No hook written yet"}</p></button><div className="pipeline-card-tags"><select value={script.category} onChange={(event)=>updateMetadata(script,{category:event.target.value})} aria-label={`${script.title} category`}><option>{script.category}</option>{["Pain point","Listicle","POV","Education","Founder story","Contrarian","Product demo","Trend remix"].filter((item)=>item!==script.category).map((item)=><option key={item}>{item}</option>)}</select><span>{script.format}</span></div><div className="pipeline-card-stats"><div><strong>{compactNumber(script.performance.views)}</strong><span>views</span></div><div><strong>{script.performance.hookRate===null?"—":`${Math.round(script.performance.hookRate*100)}%`}</strong><span>hook</span></div><div><strong>{script.performance.tests}</strong><span>tests</span></div></div><footer><div className="assignment-faces">{script.assignments.length?script.assignments.slice(0,3).map((assignment)=><span key={assignment.id} title={assignment.creatorName}>{initials(assignment.creatorName)}</span>):<em>Unassigned</em>}</div><time>{timeAgo(script.updatedAt)}</time><button onClick={()=>openWriter(script)} aria-label={`Open ${script.title}`}><ArrowUpRight/></button></footer></article>)}{canManage&&stage.id!=="retired"?<button className="pipeline-add" onClick={openImport}><Plus/>Add script</button>:null}</div></section>})}</div>:<div className="pipeline-table"><div className="pipeline-table-head"><span>Script</span><span>Stage</span><span>Category</span><span>Views</span><span>Hook rate</span><span>Tests</span><span/></div>{filteredByCategory.map((script)=><button key={script.id} onClick={()=>openWriter(script)}><div><strong>{script.title}</strong><span>{script.format}</span></div><span>{stages.find((stage)=>stage.id===script.pipelineStage)?.label}</span><span>{script.category}</span><strong>{compactNumber(script.performance.views)}</strong><strong>{script.performance.hookRate===null?"—":`${Math.round(script.performance.hookRate*100)}%`}</strong><span>{script.performance.tests}</span><ArrowUpRight/></button>)}</div>}
  </div>;
}

function ScriptWriter({ script, updateScript, goBack, save, saving, assigning, openAssign, notify, canManage }: { script:StudioScript; updateScript:(updater:(script:StudioScript)=>StudioScript)=>void; goBack:()=>void; save:()=>void; saving:boolean; assigning:boolean; openAssign:()=>void; notify:(message:string)=>void; canManage:boolean }) {
  const [copied, setCopied] = useState(false);
  const scriptText = script.sections.map((section) => section.copy.trim()).filter(Boolean).join("\n\n");
  const wordCount = scriptText.split(/\s+/).filter(Boolean).length;
  const canSave = canManage && Boolean(script.title.trim() && scriptText.trim()) && !saving && !assigning;
  const updateBody = (body:string) => updateScript((current) => {
    const sections = [plainScriptSection(body, current.sections[0]?.id)];
    return { ...current, hook:scriptHookFromText(body), sections, durationSeconds:estimateScriptDuration(sections), updatedAt:new Date().toISOString() };
  });
  const copyScript = async () => { await navigator.clipboard.writeText(scriptText); setCopied(true); notify("Script copied"); window.setTimeout(() => setCopied(false), 1800); };
  useEffect(() => {
    const handleSave = (event:KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      if (canSave) save();
    };
    window.addEventListener("keydown",handleSave);
    return () => window.removeEventListener("keydown",handleSave);
  },[canSave,save]);
  return <div className="writer-frame">
    <header className="writer-header"><button className="writer-back" onClick={goBack}><ArrowLeft /> Scripts</button><div className="writer-actions"><button onClick={copyScript} disabled={!scriptText.trim()}>{copied?<Check/>:<Copy/>}{copied?"Copied":"Copy"}</button>{canManage?<><button onClick={save} disabled={!canSave}>{saving?<Clock3/>:<Clipboard/>}{saving?"Saving…":script.latestVersion ? `Save v${script.latestVersion + 1}` : "Save"}</button><Button className="studio-primary" onClick={openAssign} disabled={!scriptText.trim() || saving || assigning}>{assigning?<Clock3/>:<Send />}{assigning?"Assigning…":"Assign"}</Button></>:null}</div></header>
    <main className="simple-script-writer">
      <input className="simple-script-title" aria-label="Script title" value={script.title} placeholder="Untitled script" onChange={(event) => updateScript((current) => ({...current,title:event.target.value,updatedAt:new Date().toISOString()}))}/>
      <div className="simple-script-toolbar">
        <StatusLabel status={script.status}/>
        <label>Stage<select value={script.pipelineStage} onChange={(event)=>updateScript((current)=>({...current,pipelineStage:event.target.value as StudioScript["pipelineStage"]}))}><option value="not_started">Not started</option><option value="testing">Testing</option><option value="iterate">Keep testing</option><option value="winner">Double down</option><option value="retired">Retired</option></select></label>
        <label>Platform<select value={script.targetPlatform} onChange={(event)=>updateScript((current)=>({...current,targetPlatform:event.target.value}))}><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="youtube">YouTube</option></select></label>
        <label>Priority<select value={script.priority} onChange={(event)=>updateScript((current)=>({...current,priority:event.target.value as StudioScript["priority"]}))}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
        <span>{wordCount} words · {script.durationSeconds ?? estimateScriptDuration(script.sections)} sec</span>
      </div>
      <textarea className="simple-script-body" aria-label="Script" spellCheck value={scriptText} onChange={(event)=>updateBody(event.target.value)} placeholder="Write the script here…"/>
      {script.reference?.sourceUrl ? <a className="simple-script-reference" href={script.reference.sourceUrl} target="_blank" rel="noreferrer"><Link2/>Reference{script.reference.sourceCreator ? ` · ${script.reference.sourceCreator}` : ""}<ExternalLink/></a> : null}
    </main>
  </div>;
}

function NewScriptDialog({ open, setOpen, onCreate }:{ open:boolean; setOpen:(open:boolean)=>void; onCreate:(input:{title:string;body:string;url:string;creator:string})=>void }) {
  const [title,setTitle]=useState("");
  const [body,setBody]=useState("");
  const [url,setUrl]=useState("");
  const [creator,setCreator]=useState("");
  const create = () => {
    onCreate({title,body,url,creator});
    setTitle("");
    setBody("");
    setUrl("");
    setCreator("");
  };
  return <Dialog open={open} onOpenChange={setOpen}><DialogContent className="reference-dialog new-script-dialog sm:max-w-2xl"><DialogHeader><DialogTitle>New script</DialogTitle></DialogHeader><div className="new-script-form"><input value={title} onChange={(event)=>setTitle(event.target.value)} placeholder="Title" autoFocus/><textarea rows={12} value={body} onChange={(event)=>setBody(event.target.value)} placeholder="Write the script…"/><div><input value={url} onChange={(event)=>setUrl(event.target.value)} placeholder="Reference URL · optional"/><input value={creator} onChange={(event)=>setCreator(event.target.value)} placeholder="Source creator · optional"/></div></div><DialogFooter className="reference-dialog-footer"><Button className="studio-primary" disabled={!title.trim()||!body.trim()} onClick={create}>Create draft</Button></DialogFooter></DialogContent></Dialog>;
}

function AssignDialog({ open,setOpen,script,creators,assigning,onAssign }:{ open:boolean;setOpen:(open:boolean)=>void;script:StudioScript|null;creators:StudioCreator[];assigning:boolean;onAssign:(ids:string[],dueAt:string,message:string)=>void }) {
  const [selected,setSelected]=useState<string[]>(() => script?.assignments.map((assignment) => assignment.creatorId) ?? []); const [search,setSearch]=useState(""); const [dueAt,setDueAt]=useState(""); const [message,setMessage]=useState("Here’s your script. Let me know if you have any questions.");
  const visibleCreators = creators.filter((creator) => `${creator.name} ${creator.username ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  const toggle=(id:string)=>setSelected((current)=>current.includes(id)?current.filter((item)=>item!==id):[...current,id]);
  return <Dialog open={open} onOpenChange={setOpen}><DialogContent className="assign-dialog sm:max-w-xl"><DialogHeader><span className="dialog-kicker"><UserRoundCheck /> CREATOR HANDOFF</span><DialogTitle>Assign and send</DialogTitle><DialogDescription>{script?.title ?? "Choose who should film this script."}</DialogDescription></DialogHeader><label className="creator-picker-search"><Search /><input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Search creators or Discord usernames…" /></label><div className="creator-picker">{visibleCreators.length?visibleCreators.map((creator)=><button key={creator.id} className={selected.includes(creator.id)?"selected":""} onClick={()=>toggle(creator.id)}><Avatar><AvatarImage src={creator.avatarUrl ?? undefined} alt=""/><AvatarFallback>{initials(creator.name)}</AvatarFallback></Avatar><div><strong>{creator.name}</strong><span>{creator.username?`@${creator.username}`:"No Discord connected"} · {creator.activeAssignments} active</span></div><i>{selected.includes(creator.id)?<Check/>:null}</i></button>):<p className="creator-picker-empty">No creators match that search.</p>}</div><div className="assignment-fields"><label><span>Due date</span><input type="date" value={dueAt} onChange={(event)=>setDueAt(event.target.value)}/></label><label><span>Delivery</span><select defaultValue="creator-link"><option value="creator-link">Creator link</option><option value="copy">Copyable brief</option><option value="discord" disabled>Discord · coming next</option></select></label></div><label className="assignment-message"><span>Message to creator</span><textarea rows={3} value={message} onChange={(event)=>setMessage(event.target.value)}/></label><DialogFooter className="assign-dialog-footer"><span>{selected.length} creator{selected.length===1?"":"s"} selected</span><Button className="studio-primary" disabled={!selected.length || assigning} onClick={()=>onAssign(selected,dueAt,message)}>{assigning?<Clock3/>:<Send />}{assigning?"Creating…":"Create assignment"}</Button></DialogFooter></DialogContent></Dialog>;
}

function StatusLabel({ status }:{ status:StudioScript["status"] }) { const labels:Record<StudioScript["status"],string>={draft:"Draft",ready:"Ready to film",assigned:"With creator",in_review:"In review",approved:"Approved",published:"Published",archived:"Archived"}; return <span className={`script-status status-${status}`}><i/>{labels[status]}</span>; }
function initials(name:string):string { return name.split(" ").filter(Boolean).slice(0,2).map((part)=>part[0]?.toUpperCase()).join(""); }
function isUuid(value:string):boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function timeAgo(value:string):string { const minutes=Math.floor((Date.now()-new Date(value).getTime())/60_000); if(minutes<1)return"Just now"; if(minutes<60)return`${minutes}m ago`; const hours=Math.floor(minutes/60); if(hours<24)return`${hours}h ago`; return`${Math.floor(hours/24)}d ago`; }
function compactNumber(value:number):string { return new Intl.NumberFormat("en",{notation:value>=10_000?"compact":"standard",maximumFractionDigits:1}).format(value); }
function plainScriptSection(copy:string,id?:string) { return { id:id??crypto.randomUUID(),label:"Script",timecode:"",delivery:"",copy,visualDirection:"",assetIds:[] as string[] }; }
