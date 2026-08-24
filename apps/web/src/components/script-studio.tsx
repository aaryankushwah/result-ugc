"use client";

import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Clipboard,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  ImageDown,
  Instagram,
  LayoutDashboard,
  Link2,
  MessageSquareText,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Sparkles,
  Table2,
  UserRoundCheck,
  WandSparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { adaptReferenceForResult, estimateScriptDuration, formatScriptForClipboard, segmentTranscript, type StudioSection } from "@/lib/script-writing";
import type { ScriptStudioData, StudioCreator, StudioScript } from "@/lib/script-studio-data";

type StudioScreen = "bank" | "writer";
type ImportMode = "full" | "sections";

const blankTranscript = "";
const previewVisuals = [
  { id: "visual-workflow", number: "01", label: "MESSY WORKFLOW", note: "Phone close-up · hard daylight", className: "visual-warm" },
  { id: "visual-tabs", number: "02", label: "TABS EVERYWHERE", note: "Fast screen capture · three cuts", className: "visual-grid" },
  { id: "visual-result", number: "03", label: "RESULT REVEAL", note: "Script status transition", className: "visual-signal" },
];

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

  const filtered = useMemo(() => scripts.filter((script) => {
    const haystack = `${script.title} ${script.hook ?? ""} ${script.assignments.map((assignment) => assignment.creatorName).join(" ")}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  }), [query, scripts]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  };

  const openWriter = (script: StudioScript) => { setActive(script); setScreen("writer"); };

  const createFromReference = (input: { url: string; creator: string; transcript: string }) => {
    const sections = adaptReferenceForResult(input.transcript);
    const next: StudioScript = {
      id: `session-${crypto.randomUUID()}`,
      title: "New reference · adapted for Result",
      status: "draft",
      pipelineStage: "not_started",
      priority: "medium",
      category: "Uncategorized",
      format: "Talking head",
      tags: [],
      targetPlatform: "instagram",
      durationSeconds: estimateScriptDuration(sections),
      hook: sections[0]?.copy ?? null,
      sections,
      reference: {
        id: `session-reference-${crypto.randomUUID()}`,
        sourcePlatform: "instagram",
        sourceUrl: input.url || null,
        sourceCreator: input.creator || null,
        transcript: input.transcript,
        transcriptSections: segmentTranscript(input.transcript),
      },
      assignments: [],
      assets: [],
      performance: { tests:0, liveTests:0, views:0, hookRate:null, averageWatchTimeSeconds:null },
      updatedAt: new Date().toISOString(),
    };
    setScripts((current) => [next, ...current]);
    setActive(next);
    setScreen("writer");
    setImportOpen(false);
    notify("Reference structured and adapted for Result");
  };

  const updateActive = (updater: (script: StudioScript) => StudioScript) => {
    setActive((current) => {
      if (!current) return current;
      const next = updater(current);
      setScripts((items) => items.map((item) => item.id === current.id ? next : item));
      return next;
    });
  };

  const save = async () => {
    if (!active || !canManage) return;
    setSaving(true);
    const persisted = isUuid(active.id);
    const body = persisted ? {
      title: active.title,
      status: active.status,
      pipelineStage: active.pipelineStage,
      priority: active.priority,
      category: active.category,
      format: active.format,
      tags: active.tags,
      targetPlatform: active.targetPlatform,
      sections: active.sections,
      changeSummary: "Saved from Script Studio",
    } : {
      title: active.title,
      pipelineStage: active.pipelineStage,
      priority: active.priority,
      category: active.category,
      format: active.format,
      tags: active.tags,
      targetPlatform: active.targetPlatform,
      sections: active.sections,
      brandSnapshot: initialData.brand,
      reference: active.reference ? {
        sourcePlatform: active.reference.sourcePlatform,
        sourceUrl: active.reference.sourceUrl,
        sourceCreator: active.reference.sourceCreator,
        transcript: active.reference.transcript,
        transcriptSections: active.reference.transcriptSections,
      } : null,
    };
    try {
      const response = await fetch(persisted ? `/api/scripts/${active.id}` : "/api/scripts", {
        method: persisted ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json() as { id?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Script could not be saved");
      if (!persisted && result.id) updateActive((script) => ({ ...script, id: result.id!, updatedAt: new Date().toISOString() }));
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
    const selectedCreators = initialData.creators.filter((creator) => creatorIds.includes(creator.id));
    const nextAssignments = selectedCreators.map((creator, index) => ({ id:`session-assignment-${index}`, creatorId:creator.id, creatorName:creator.name, state:"assigned", dueAt:dueAt ? new Date(`${dueAt}T12:00:00Z`).toISOString() : null }));
    if (isUuid(active.id) && creatorIds.every(isUuid)) {
      try {
        const response = await fetch(`/api/scripts/${active.id}/assignments`, { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ creatorIds, dueAt:dueAt ? new Date(`${dueAt}T12:00:00Z`).toISOString() : null, message }) });
        const result = await response.json() as { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Assignment could not be saved");
      } catch (error) {
        notify(error instanceof Error ? error.message : "Assignment could not be saved");
        return;
      }
    }
    updateActive((script) => ({ ...script, status:"assigned", assignments:nextAssignments, updatedAt:new Date().toISOString() }));
    setAssignOpen(false);
    notify(`Assigned to ${selectedCreators.map((creator) => creator.name.split(" ")[0]).join(" and ")}`);
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
    {screen === "bank" ? <ScriptBank scripts={filtered} allScripts={scripts} query={query} setQuery={setQuery} status={status} setStatus={setStatus} openWriter={openWriter} openImport={() => setImportOpen(true)} updateMetadata={updateCardMetadata} canManage={canManage} sourceMode={initialData.sourceMode} /> : active ? <ScriptWriter script={active} brand={initialData.brand} creators={initialData.creators} updateScript={updateActive} goBack={() => setScreen("bank")} save={save} saving={saving} openAssign={() => setAssignOpen(true)} notify={notify} canManage={canManage} /> : null}
    <ReferenceDialog open={importOpen} setOpen={setImportOpen} onCreate={createFromReference} />
    <AssignDialog open={assignOpen} setOpen={setAssignOpen} script={active} creators={initialData.creators} onAssign={assign} />
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

function ScriptWriter({ script, brand, updateScript, goBack, save, saving, openAssign, notify, canManage }: { script:StudioScript; brand:ScriptStudioData["brand"]; creators:StudioCreator[]; updateScript:(updater:(script:StudioScript)=>StudioScript)=>void; goBack:()=>void; save:()=>void; saving:boolean; openAssign:()=>void; notify:(message:string)=>void; canManage:boolean }) {
  const [sideTab, setSideTab] = useState<"brief"|"assets"|"notes">("brief");
  const [copied, setCopied] = useState(false);
  const updateSection = (sectionId:string, field:keyof StudioSection, value:string) => updateScript((current) => ({ ...current, hook: field === "copy" && current.sections[0]?.id === sectionId ? value : current.hook, sections:current.sections.map((section) => section.id === sectionId ? {...section,[field]:value} : section), durationSeconds:estimateScriptDuration(current.sections.map((section) => section.id === sectionId ? {...section,[field]:value} : section)), updatedAt:new Date().toISOString() }));
  const copyScript = async () => { await navigator.clipboard.writeText(formatScriptForClipboard(script.title, script.sections)); setCopied(true); notify("Creator-formatted script copied"); window.setTimeout(() => setCopied(false), 1800); };
  const copyTranscript = async () => { if (!script.reference) return; await navigator.clipboard.writeText(script.reference.transcript); notify("Transcript copied"); };
  const downloadVisual = (label:string) => { downloadReferenceFrame(label); notify("Reference frame downloaded as PNG"); };
  return <div className="writer-frame">
    <header className="writer-header"><div><button className="writer-back" onClick={goBack}><ArrowLeft /> Script bank</button><span>/</span><strong>{script.title}</strong></div><div className="writer-actions"><button onClick={copyScript}>{copied?<Check/>:<Copy/>}{copied?"Copied":"Copy script"}</button>{canManage?<><button onClick={save} disabled={saving}>{saving?<Clock3/>:<Clipboard/>}{saving?"Saving":"Save version"}</button><Button className="studio-primary" onClick={openAssign}><Send /> Assign & send</Button></>:null}</div></header>
    <div className="writer-grid">
      <aside className="reference-column"><div className="writer-column-title"><div><p>REFERENCE</p><h2>Source Reel</h2></div><button aria-label="Reference options"><MoreHorizontal /></button></div>{script.reference ? <><div className="reference-reel"><div className="reference-poster"><span className="poster-source"><Instagram /> REFERENCE</span><strong>YOUR TEAM<br/>ISN&apos;T SLOW.</strong><button aria-label="Open reference"><ExternalLink /></button><small>0:24</small></div><div className="reference-meta"><Instagram /><div><strong>{script.reference.sourceCreator ?? "Instagram creator"}</strong><span>Structure source · saved to Result</span></div>{script.reference.sourceUrl ? <a href={script.reference.sourceUrl} target="_blank" rel="noreferrer" aria-label="Open source Reel"><ArrowUpRight /></a> : null}</div></div><div className="transcript-heading"><div><h3>Transcript</h3><span>{script.reference.transcriptSections.length} beats</span></div><button onClick={copyTranscript}><Copy /> Copy all</button></div><div className="transcript-beats">{script.reference.transcriptSections.map((section,index) => <article className={index === 0 ? "active" : ""} key={section.id}><time>{section.timecode}</time><div><span>{section.label}</span><p>{section.text}</p></div></article>)}</div></> : <div className="reference-empty"><Link2 /><h3>No reference attached</h3><p>This script started from a blank brief.</p></div>}
      </aside>
      <main className="script-editor"><div className="script-document-head"><div><StatusLabel status={script.status} /><input aria-label="Script title" value={script.title} onChange={(event) => updateScript((current) => ({...current,title:event.target.value,updatedAt:new Date().toISOString()}))}/><p><span>{brand.name}</span> · {script.durationSeconds ?? estimateScriptDuration(script.sections)} sec · {script.sections.reduce((sum,section)=>sum+section.copy.split(/\s+/).filter(Boolean).length,0)} words</p><div className="writer-taxonomy"><label><span>Stage</span><select value={script.pipelineStage} onChange={(event)=>updateScript((current)=>({...current,pipelineStage:event.target.value as StudioScript["pipelineStage"]}))}><option value="not_started">Not started</option><option value="testing">Testing</option><option value="iterate">Keep testing</option><option value="winner">Double down</option><option value="retired">Retired</option></select></label><label><span>Category</span><input value={script.category} onChange={(event)=>updateScript((current)=>({...current,category:event.target.value}))}/></label><label><span>Format</span><input value={script.format} onChange={(event)=>updateScript((current)=>({...current,format:event.target.value}))}/></label><label><span>Priority</span><select value={script.priority} onChange={(event)=>updateScript((current)=>({...current,priority:event.target.value as StudioScript["priority"]}))}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label></div></div><div className="adaptation-note"><WandSparkles /><p><strong>Adapted for {brand.name}</strong><span>Source structure is preserved. Product language and claims come from the active brand context.</span></p><button onClick={() => notify("Hook, tension, reveal, and CTA structure preserved")}>View mapping</button></div></div><div className="script-sections">{script.sections.map((section,index) => <article className="script-section" key={section.id}><div className="section-label"><span>{String(index+1).padStart(2,"0")}</span><input value={section.label} onChange={(event)=>updateSection(section.id,"label",event.target.value)}/><small>{section.timecode}</small></div><div className="section-copy"><input className="delivery-input" value={section.delivery} onChange={(event)=>updateSection(section.id,"delivery",event.target.value)} aria-label={`${section.label} delivery`}/><textarea rows={Math.max(2,Math.ceil(section.copy.length/68))} value={section.copy} onChange={(event)=>updateSection(section.id,"copy",event.target.value)} aria-label={`${section.label} copy`}/><div className="visual-direction"><ImageDown /><input value={section.visualDirection} onChange={(event)=>updateSection(section.id,"visualDirection",event.target.value)} aria-label={`${section.label} visual direction`}/><button onClick={()=>downloadVisual(section.visualDirection)}>Get visual</button></div></div></article>)}{canManage?<button className="add-script-section" onClick={()=>updateScript((current)=>({...current,sections:[...current.sections,{id:crypto.randomUUID(),label:"New beat",timecode:"",delivery:"Direct to camera",copy:"Write the next beat…",visualDirection:"Add a clear visual direction.",assetIds:[]}]}))}><Plus /> Add section</button>:null}</div></main>
      <aside className="writer-context"><div className="context-tabs"><button className={sideTab==="brief"?"active":""} onClick={()=>setSideTab("brief")}>Brief</button><button className={sideTab==="assets"?"active":""} onClick={()=>setSideTab("assets")}>Assets</button><button className={sideTab==="notes"?"active":""} onClick={()=>setSideTab("notes")}>Notes <span>2</span></button></div>{sideTab==="brief"?<BrandBrief brand={brand}/>:sideTab==="assets"?<VisualAssets onDownload={downloadVisual}/>:<StudioNotes/>}</aside>
    </div>
  </div>;
}

function BrandBrief({ brand }:{ brand:ScriptStudioData["brand"] }) { return <div className="brand-brief"><div className="context-section-head"><h3>Brand context</h3><span>ACTIVE</span></div><div className="brand-identity"><strong className="font-result">RESULT</strong><span>{brand.productDescription}</span></div><dl><div><dt>Audience</dt><dd>{brand.audience}</dd></div><div><dt>Voice</dt><dd className="tag-list">{brand.voice.map((item)=><span key={item}>{item}</span>)}</dd></div><div><dt>Never say</dt><dd>{brand.bannedPhrases.map((phrase)=>`“${phrase}”`).join(", ")}</dd></div><div><dt>Approved proof</dt><dd>{brand.proofPoints[0]}</dd></div></dl><div className="production-checklist"><div className="context-section-head"><h3>Production checklist</h3><span>2/5</span></div>{["Film in natural daylight","Show product before 10 sec","Add a screen recording","Burn in captions","Export 9:16 · 1080p"].map((item,index)=><label key={item}><input type="checkbox" defaultChecked={index<2}/><span>{item}</span></label>)}</div><div className="context-tip"><Sparkles /><p><strong>Make direction filmable</strong><span>Specific visuals make creator output more consistent.</span></p></div></div>; }

function VisualAssets({ onDownload }:{ onDownload:(label:string)=>void }) { return <div className="visual-assets"><div className="context-section-head"><h3>Script visuals</h3><span>{previewVisuals.length}</span></div>{previewVisuals.map((visual)=><article key={visual.id}><div className={`visual-mini ${visual.className}`}><span>{visual.number}</span><strong>{visual.label}</strong></div><div><strong>{visual.label.toLowerCase().replaceAll(" "," ")}</strong><span>{visual.note}</span></div><button onClick={()=>onDownload(visual.label)} aria-label={`Download ${visual.label}`}><Download /></button></article>)}</div>; }

function StudioNotes() { return <div className="studio-notes"><article><span>RT</span><p><strong>Keep the opening to one breath.</strong>The original works because the pain is understood immediately.</p></article><article><span>MC</span><p><strong>I can film the screen section.</strong>Attach the exact workspace I should use.</p></article><button><MessageSquareText /> Add internal note</button></div>; }

function ReferenceDialog({ open, setOpen, onCreate }:{ open:boolean; setOpen:(open:boolean)=>void; onCreate:(input:{url:string;creator:string;transcript:string})=>void }) {
  const [mode,setMode]=useState<ImportMode>("full"); const [url,setUrl]=useState(""); const [creator,setCreator]=useState(""); const [transcript,setTranscript]=useState(blankTranscript); const [parts,setParts]=useState({Hook:"",Problem:"",Solution:"",Proof:"",CTA:""});
  const combined = mode === "full" ? transcript : Object.entries(parts).filter(([,value])=>value.trim()).map(([label,value])=>`${label}: ${value.trim()}`).join(" ");
  return <Dialog open={open} onOpenChange={setOpen}><DialogContent className="reference-dialog sm:max-w-2xl"><DialogHeader><span className="dialog-kicker"><Instagram /> REFERENCE INTAKE</span><DialogTitle>Turn a winning Reel into a Result script</DialogTitle><DialogDescription>Keep the creative structure. Replace the company, claims, and language with your active Result brand context.</DialogDescription></DialogHeader><div className="reference-form"><div className="form-pair"><label><span>Instagram Reel URL</span><div><Link2/><input value={url} onChange={(event)=>setUrl(event.target.value)} placeholder="https://instagram.com/reel/…"/></div></label><label><span>Source creator</span><input value={creator} onChange={(event)=>setCreator(event.target.value)} placeholder="@creator"/></label></div><div className="intake-mode"><button className={mode==="full"?"active":""} onClick={()=>setMode("full")}>Paste full transcript</button><button className={mode==="sections"?"active":""} onClick={()=>setMode("sections")}>Paste by section</button></div>{mode==="full"?<label className="transcript-field"><span>Transcript</span><textarea rows={8} value={transcript} onChange={(event)=>setTranscript(event.target.value)} placeholder="Paste the spoken transcript here…"/><small>Result detects the hook, problem, solution, proof, and CTA. Automatic Reel transcription can plug into the same saved reference record later.</small></label>:<div className="section-intake">{Object.keys(parts).map((label)=><label key={label}><span>{label}</span><textarea rows={2} value={parts[label as keyof typeof parts]} onChange={(event)=>setParts({...parts,[label]:event.target.value})} placeholder={`Paste the ${label.toLowerCase()}…`}/></label>)}</div>}</div><DialogFooter className="reference-dialog-footer"><span><Sparkles/> Uses the active Result brand profile</span><Button className="studio-primary" disabled={!combined.trim()} onClick={()=>onCreate({url,creator,transcript:combined})}>Analyze reference <ArrowUpRight /></Button></DialogFooter></DialogContent></Dialog>;
}

function AssignDialog({ open,setOpen,script,creators,onAssign }:{ open:boolean;setOpen:(open:boolean)=>void;script:StudioScript|null;creators:StudioCreator[];onAssign:(ids:string[],dueAt:string,message:string)=>void }) {
  const [selected,setSelected]=useState<string[]>([]); const [dueAt,setDueAt]=useState(""); const [message,setMessage]=useState("Here is your next script. Visual directions and references are attached—leave questions directly on the brief.");
  const toggle=(id:string)=>setSelected((current)=>current.includes(id)?current.filter((item)=>item!==id):[...current,id]);
  return <Dialog open={open} onOpenChange={setOpen}><DialogContent className="assign-dialog sm:max-w-xl"><DialogHeader><span className="dialog-kicker"><UserRoundCheck /> CREATOR HANDOFF</span><DialogTitle>Assign and send</DialogTitle><DialogDescription>{script?.title ?? "Choose who should film this script."}</DialogDescription></DialogHeader><div className="creator-picker">{creators.map((creator)=><button key={creator.id} className={selected.includes(creator.id)?"selected":""} onClick={()=>toggle(creator.id)}><Avatar><AvatarImage src={creator.avatarUrl ?? undefined} alt=""/><AvatarFallback>{initials(creator.name)}</AvatarFallback></Avatar><div><strong>{creator.name}</strong><span>{creator.username?`@${creator.username}`:"Result creator"} · {creator.activeAssignments} active</span></div><i>{selected.includes(creator.id)?<Check/>:null}</i></button>)}</div><div className="assignment-fields"><label><span>Due date</span><input type="date" value={dueAt} onChange={(event)=>setDueAt(event.target.value)}/></label><label><span>Delivery</span><select defaultValue="creator-link"><option value="creator-link">Creator link</option><option value="copy">Copyable brief</option><option value="discord" disabled>Discord · coming next</option></select></label></div><label className="assignment-message"><span>Message to creator</span><textarea rows={3} value={message} onChange={(event)=>setMessage(event.target.value)}/></label><DialogFooter className="assign-dialog-footer"><span>{selected.length} creator{selected.length===1?"":"s"} selected</span><Button className="studio-primary" disabled={!selected.length} onClick={()=>onAssign(selected,dueAt,message)}>Create assignment <Send /></Button></DialogFooter></DialogContent></Dialog>;
}

function StatusLabel({ status }:{ status:StudioScript["status"] }) { const labels:Record<StudioScript["status"],string>={draft:"Draft",ready:"Ready to film",assigned:"With creator",in_review:"In review",approved:"Approved",published:"Published",archived:"Archived"}; return <span className={`script-status status-${status}`}><i/>{labels[status]}</span>; }
function initials(name:string):string { return name.split(" ").filter(Boolean).slice(0,2).map((part)=>part[0]?.toUpperCase()).join(""); }
function isUuid(value:string):boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function timeAgo(value:string):string { const minutes=Math.floor((Date.now()-new Date(value).getTime())/60_000); if(minutes<1)return"Just now"; if(minutes<60)return`${minutes}m ago`; const hours=Math.floor(minutes/60); if(hours<24)return`${hours}h ago`; return`${Math.floor(hours/24)}d ago`; }
function compactNumber(value:number):string { return new Intl.NumberFormat("en",{notation:value>=10_000?"compact":"standard",maximumFractionDigits:1}).format(value); }
function downloadReferenceFrame(label:string) { const canvas=document.createElement("canvas"); canvas.width=1080; canvas.height=1350; const context=canvas.getContext("2d"); if(!context)return; context.fillStyle="#101010"; context.fillRect(0,0,1080,1350); context.fillStyle="#85ed75"; context.fillRect(70,70,16,1210); context.fillStyle="#ffffff"; context.font="600 80px Arial"; const words=label.toUpperCase().split(" "); let line=""; let y=300; for(const word of words){const test=`${line}${word} `;if(context.measureText(test).width>820){context.fillText(line,140,y);line=`${word} `;y+=100}else line=test} context.fillText(line,140,y); context.fillStyle="#858585"; context.font="30px Arial"; context.fillText("RESULT · CREATOR REFERENCE FRAME",140,1130); context.fillStyle="#85ed75"; context.fillRect(140,1190,310,7); const anchor=document.createElement("a"); anchor.download=`${label.toLowerCase().replaceAll(" ","-")}.png`; anchor.href=canvas.toDataURL("image/png"); anchor.click(); }
