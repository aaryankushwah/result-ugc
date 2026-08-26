"use client";

import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  Check,
  Clipboard,
  Clock3,
  Copy,
  Eye,
  ExternalLink,
  File,
  FlaskConical,
  Gauge,
  Image as ImageIcon,
  LayoutDashboard,
  Link2,
  Music2,
  Plus,
  Search,
  Send,
  Sparkles,
  Table2,
  Trash2,
  TriangleAlert,
  Trophy,
  UserRoundCheck,
  Video,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReferenceEmbed } from "@/components/reference-embed";
import { ScriptBlockEditor } from "@/components/script-block-editor";
import { estimateScriptDuration, scriptHookFromSections, scriptHookFromText, segmentTranscript } from "@/lib/script-writing";
import { scriptClipboardText, scriptPlainText } from "@/lib/script-blocks";
import { diffWords, preservedRatio } from "@/lib/script-diff";
import { parseReferenceUrl } from "@/lib/reference-url";
import { cleanScriptTitle } from "@/lib/script-title";
import { filterScriptsByCategory, mergeScriptAssignments, partitionScriptAssets, referencePlatformFromUrl, removeStudioScript, restoreStudioScript, UNCATEGORIZED_SCRIPT_CATEGORY } from "@/lib/script-studio-state";
import type { ScriptStudioData, StudioAsset, StudioCreator, StudioScript } from "@/lib/script-studio-data";

type StudioScreen = "bank" | "writer";

type GenerationOutcome = {
  generation: { model: string; promptVersion: string; referenceId: string | null; substitutions: Array<{ sectionId: string; from: string; to: string }> };
  degraded: boolean;
  before: string;
  after: string;
};


export function ScriptStudio({ initialData, canManage }: { initialData: ScriptStudioData; canManage: boolean }) {
  const [screen, setScreen] = useState<StudioScreen>("bank");
  const [scripts, setScripts] = useState(initialData.scripts);
  const [failedNotifications, setFailedNotifications] = useState(initialData.failedNotifications);
  const [active, setActive] = useState<StudioScript | null>(initialData.scripts[0] ?? null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [importOpen, setImportOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StudioScript | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [brand, setBrand] = useState(initialData.brand);
  const [lastGeneration, setLastGeneration] = useState<GenerationOutcome | null>(null);

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

  /** Paste a reel link, get a transcribed draft. The whole point of the studio. */
  const importReel = async (url: string): Promise<boolean> => {
    setImporting(true);
    try {
      const response = await fetch("/api/references/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const result = await response.json() as { reference?: StudioScript["reference"] & { transcriptState?: string }; suggestedTitle?: string; error?: string };
      if (!response.ok || !result.reference) throw new Error(result.error ?? "The reel could not be imported");

      const transcript = result.reference.transcript;
      const sections = [plainScriptSection(transcript)];
      const next: StudioScript = {
        id: `session-${crypto.randomUUID()}`,
        latestVersion: 0,
        title: (result.suggestedTitle ?? "Imported reel").slice(0, 120),
        status: "draft",
        pipelineStage: "not_started",
        priority: "medium",
        category: "Uncategorized",
        format: "Talking head",
        tags: [],
        targetPlatform: "instagram",
        durationSeconds: estimateScriptDuration(sections),
        hook: scriptHookFromText(transcript),
        sections,
        reference: result.reference,
        assignments: [],
        assets: [],
        performance: { tests: 0, liveTests: 0, views: 0, hookRate: null, averageWatchTimeSeconds: null },
        updatedAt: new Date().toISOString(),
      };
      setScripts((current) => [next, ...current]);
      setActive(next);
      setLastGeneration(null);
      setScreen("writer");
      setImportOpen(false);
      notify(`Transcribed ${result.reference.transcriptSections.length} segment${result.reference.transcriptSections.length === 1 ? "" : "s"}`);
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : "The reel could not be imported");
      return false;
    } finally {
      setImporting(false);
    }
  };

  /** Swap the business, keep every other word. Persists first so the script has an id. */
  const generate = async () => {
    if (!active || !canManage) return;
    setGenerating(true);
    try {
      const saved = isUuid(active.id) ? { id: active.id, version: active.latestVersion, assets: undefined } : await persistScript(active, "Saved before generation");
      const response = await fetch(`/api/scripts/${saved.id}/generate`, { method: "POST" });
      const result = await response.json() as {
        version?: number;
        sections?: StudioScript["sections"];
        generation?: GenerationOutcome["generation"];
        degraded?: boolean;
        sourceTranscript?: string | null;
        error?: string;
      };
      if (!response.ok || !result.sections) throw new Error(result.error ?? "Generation failed");

      const before = active.reference?.transcript ?? result.sourceTranscript ?? "";
      const afterText = result.sections.map((section) => section.copy.trim()).filter(Boolean).join("\n\n");
      setLastGeneration({
        generation: result.generation ?? { model: "unknown", promptVersion: "unknown", referenceId: null, substitutions: [] },
        degraded: Boolean(result.degraded),
        before,
        after: afterText,
      });
      updateActive((script) => ({
        ...script,
        id: saved.id,
        latestVersion: result.version ?? saved.version,
        sections: result.sections!,
        hook: scriptHookFromSections(result.sections!),
        durationSeconds: estimateScriptDuration(result.sections!),
        updatedAt: new Date().toISOString(),
      }));
      notify(result.degraded ? "Generated without a model · AI Gateway is not configured" : "Adapted for your brand");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
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
      assets: script.assets.filter((asset) => asset.sourceUrl).map((asset) => ({ label: asset.label, kind: asset.kind, sourceUrl: asset.sourceUrl! })),
      // An ingested reference is already a row; send its id so the transcript is not duplicated.
      referenceId: script.reference && isUuid(script.reference.id) ? script.reference.id : null,
      reference: script.reference && !isUuid(script.reference.id) ? {
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
    const result = await response.json() as { id?: string; version?: number; assets?: StudioAsset[]; error?: string };
    if (!response.ok) throw new Error(result.error ?? "Script could not be saved");
    return { id: result.id ?? script.id, version: result.version ?? (persisted ? script.latestVersion + 1 : 1), assets: result.assets };
  };

  const save = async () => {
    if (!active || !canManage) return;
    setSaving(true);
    try {
      const result = await persistScript(active);
      updateActive((script) => ({ ...script, id: result.id, latestVersion: result.version, assets:result.assets ?? script.assets, updatedAt: new Date().toISOString() }));
      notify("Saved to the script bank");
    } catch (error) {
      if (initialData.sourceMode === "preview") notify("Saved in this preview session · connect the database to persist it");
      else notify(error instanceof Error ? error.message : "Script could not be saved");
    } finally {
      setSaving(false);
    }
  };

  const deleteScript = async () => {
    if (!deleteTarget || !canManage) return;
    const target = deleteTarget;
    const originalIndex = scripts.findIndex((script) => script.id === target.id);
    const wasActive = active?.id === target.id;
    setDeleting(true);
    setDeleteTarget(null);
    setScripts((current) => removeStudioScript(current, target.id));
    if (wasActive) {
      setLastGeneration(null);
      setActive(null);
      setScreen("bank");
    }
    notify(`Deleted “${target.title.trim() || "Untitled script"}”`);
    try {
      if (isUuid(target.id)) {
        const response = await fetch(`/api/scripts/${target.id}`, { method: "DELETE" });
        const result = await response.json() as { error?: string; canceledNotificationIds?: string[] };
        if (!response.ok) throw new Error(result.error ?? "Script could not be deleted");
        const canceledIds = new Set(result.canceledNotificationIds ?? []);
        if (canceledIds.size) setFailedNotifications((current) => current.filter((notification) => !canceledIds.has(notification.operationId)));
      }
    } catch (error) {
      setScripts((current) => restoreStudioScript(current, target, originalIndex));
      notify(`${error instanceof Error ? error.message : "Script could not be deleted"} · restored`);
    } finally {
      setDeleting(false);
    }
  };

  const assign = async (creatorIds: string[], dueAt: string, message: string, notifyCreator: boolean) => {
    if (!active) return;
    setAssigning(true);
    setAssignOpen(false);
    const selectedCreators = initialData.creators.filter((creator) => creatorIds.includes(creator.id));
    const nextAssignments = selectedCreators.map((creator, index) => ({ id:`session-assignment-${index}`, creatorId:creator.id, creatorName:creator.name, state:"assigned", dueAt:dueAt ? new Date(`${dueAt}T12:00:00Z`).toISOString() : null }));
    try {
      const saved = isUuid(active.id) ? { id: active.id, version: active.latestVersion, assets:undefined } : await persistScript(active, "Saved before creator assignment");
      if (!creatorIds.every(isUuid)) throw new Error("Only saved Result creators can receive assignments");
      const response = await fetch(`/api/scripts/${saved.id}/assignments`, { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ creatorIds, dueAt:dueAt ? new Date(`${dueAt}T12:00:00Z`).toISOString() : null, message, notifyCreator, notificationRequestId:crypto.randomUUID() }) });
      const result = await response.json() as { assignments?: Array<{ creatorId:string; creatorName:string; state:string; dueAt:string|null }>; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Assignment could not be saved");
      const persistedAssignments = (result.assignments ?? nextAssignments).map((assignment,index) => ({ ...assignment, id:`assignment-${assignment.creatorId}-${index}` }));
      updateActive((script) => ({ ...script, id:saved.id, latestVersion:saved.version, assets:saved.assets ?? script.assets, status:"assigned", assignments:mergeScriptAssignments(script.assignments,persistedAssignments), updatedAt:new Date().toISOString() }));
      notify(`${notifyCreator ? "Assigned and queued in Discord for" : "Assigned silently to"} ${selectedCreators.map((creator) => creator.name.split(" ")[0]).join(" and ")}`);
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
    {screen === "bank" ? <ScriptBank scripts={filtered} allScripts={scripts} query={query} setQuery={setQuery} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} openWriter={openWriter} requestDelete={setDeleteTarget} openImport={() => setImportOpen(true)} openBrand={() => setBrandOpen(true)} failedNotifications={failedNotifications} notify={notify} updateMetadata={updateCardMetadata} canManage={canManage} sourceMode={initialData.sourceMode} /> : active ? <ScriptWriter script={active} updateScript={updateActive} goBack={() => { setScreen("bank"); setLastGeneration(null); }} save={save} saving={saving} deleting={deleting} assigning={assigning} generating={generating} generate={generate} generation={lastGeneration} dismissGeneration={() => setLastGeneration(null)} openDelete={() => setDeleteTarget(active)} openAssign={() => setAssignOpen(true)} notify={notify} canManage={canManage} /> : null}
    <ImportDialog open={importOpen} setOpen={setImportOpen} onImport={importReel} onCreate={createDraft} importing={importing} />
    <BrandDialog key={brandOpen ? "brand-open" : "brand-closed"} open={brandOpen} setOpen={setBrandOpen} brand={brand} setBrand={setBrand} notify={notify} canManage={canManage} />
    <AssignDialog key={`${active?.id ?? "none"}-${assignOpen ? "open" : "closed"}`} open={assignOpen} setOpen={setAssignOpen} script={active} creators={initialData.creators} assigning={assigning} onAssign={assign} />
    <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}>
      <DialogContent className="script-delete-dialog" showCloseButton={!deleting}>
        <DialogHeader>
          <DialogTitle>Delete “{deleteTarget?.title.trim() || "Untitled script"}”?</DialogTitle>
          <DialogDescription>
            {deleteTarget && isUuid(deleteTarget.id)
              ? "This permanently removes the script, its versions, assignments, resources, and test records. Discord messages already delivered to creators will remain."
              : "This removes the unsaved draft from this session."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
          <Button variant="destructive" onClick={deleteScript} disabled={deleting}>
            <Trash2 />Delete script
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {toast ? <div className="studio-toast" role="status"><Check />{toast}</div> : null}
  </div>;
}

function ScriptBank({ scripts, allScripts, query, setQuery, categoryFilter, setCategoryFilter, openWriter, requestDelete, openImport, openBrand, failedNotifications, notify, updateMetadata, canManage, sourceMode }: { scripts:StudioScript[]; allScripts:StudioScript[]; query:string; setQuery:(value:string)=>void; categoryFilter:string; setCategoryFilter:(value:string)=>void; openWriter:(script:StudioScript)=>void; requestDelete:(script:StudioScript)=>void; openImport:()=>void; openBrand:()=>void; failedNotifications:ScriptStudioData["failedNotifications"]; notify:(message:string)=>void; updateMetadata:(script:StudioScript,patch:Partial<Pick<StudioScript,"pipelineStage"|"category"|"priority">>)=>void; canManage:boolean; sourceMode:ScriptStudioData["sourceMode"] }) {
  const [view,setView]=useState<"pipeline"|"table">("pipeline");
  const [dragged,setDragged]=useState<string|null>(null);
  const [dropStage,setDropStage]=useState<StudioScript["pipelineStage"]|null>(null);
  const stages = [
    { id:"not_started" as const, label:"Not started", description:"Ideas and references", tone:"neutral" },
    { id:"testing" as const, label:"Testing", description:"Live creative tests", tone:"testing" },
    { id:"iterate" as const, label:"Keep testing", description:"Promising—make variants", tone:"iterate" },
    { id:"winner" as const, label:"Double down", description:"Proven winners", tone:"winner" },
    { id:"retired" as const, label:"Retired", description:"Stopped or archived", tone:"retired" },
  ];
  const categories=["all",...Array.from(new Set(allScripts.map((script)=>script.category))).sort()];
  const filteredByCategory=filterScriptsByCategory(scripts,categoryFilter);
  const totalViews=allScripts.reduce((sum,script)=>sum+script.performance.views,0);
  const hookRates=allScripts.map((script)=>script.performance.hookRate).filter((value):value is number=>value!==null);
  const activeTests=allScripts.filter((script)=>script.pipelineStage==="testing").length;
  const winners=allScripts.filter((script)=>script.pipelineStage==="winner").length;
  const move=(stage:StudioScript["pipelineStage"])=>{const script=allScripts.find((item)=>item.id===dragged);if(script&&script.pipelineStage!==stage)updateMetadata(script,{pipelineStage:stage});setDragged(null);setDropStage(null);};
  return <div className="script-bank pipeline-home">
    <div className="pipeline-titlebar"><div><p className="eyebrow">CREATIVE TESTING SYSTEM</p><h1>Script pipeline</h1><p>Every concept moves from reference to test, iteration, and a measurable winner.</p></div><div className="pipeline-title-actions">{sourceMode==="database"?<span className="neon-live"><i/>Neon live</span>:null}{canManage?<><button className="studio-secondary" onClick={openBrand}><Building2/>Brand</button><Button className="studio-primary" onClick={openImport}><Plus/>New script</Button></>:null}</div></div>
    {sourceMode==="preview"?<div className="studio-preview-banner"><Sparkles/><div><strong>Preview data</strong><span>Neon is connected. Create the first real script to replace these example cards.</span></div></div>:null}
    {failedNotifications.length?<FailedNotificationStrip items={failedNotifications} notify={notify}/>:null}
    <section className="overview-metric-grid script-overview-metrics" aria-label="Script performance summary">
      {[
        { label:"Active tests", value:activeTests, icon:FlaskConical },
        { label:"Tested views", value:compactNumber(totalViews), icon:Eye },
        { label:"Winning concepts", value:winners, icon:Trophy },
        { label:"Average hook rate", value:hookRates.length?`${Math.round(hookRates.reduce((sum,value)=>sum+value,0)/hookRates.length*100)}%`:"—", icon:Gauge },
      ].map((metric)=><article className="metric-card overview-metric-card" key={metric.label}>
        <span className="metric-icon"><metric.icon /></span>
        <div className="overview-metric-copy"><p>{metric.label}</p><strong>{metric.value}</strong></div>
      </article>)}
    </section>
    <section className="pipeline-workspace data-panel">
      <nav className="roster-tabs pipeline-category-tabs" aria-label="Script categories">{categories.slice(0,7).map((category)=><button type="button" key={category} aria-pressed={categoryFilter===category} data-state={categoryFilter===category?"active":"inactive"} onClick={()=>setCategoryFilter(category)}>{category==="all"?"All scripts":category===UNCATEGORIZED_SCRIPT_CATEGORY?"Needs category":category}<span>{category==="all"?allScripts.length:allScripts.filter((script)=>script.category===category).length}</span></button>)}</nav>
      <div className="table-toolbar pipeline-toolbar"><label className="table-search pipeline-search"><Search/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search scripts"/></label><div className="view-toggle pipeline-view-toggle" aria-label="Script view"><button className={view==="pipeline"?"active":""} onClick={()=>setView("pipeline")}><LayoutDashboard/>Pipeline</button><button className={view==="table"?"active":""} onClick={()=>setView("table")}><Table2/>Table</button></div></div>
      {categoryFilter!=="all"?<div className="pipeline-filter-context" role="status"><p>{categoryFilter===UNCATEGORIZED_SCRIPT_CATEGORY?<><strong>{filteredByCategory.length} {filteredByCategory.length===1?"script":"scripts"}</strong> need {filteredByCategory.length===1?"a category":"categories"}. Choose one from a card to organize {filteredByCategory.length===1?"it":"them"}.</>:<><strong>Showing {filteredByCategory.length} {filteredByCategory.length===1?"script":"scripts"}</strong> in {categoryFilter}.</>}</p><button type="button" onClick={()=>setCategoryFilter("all")}>Clear filter</button></div>:null}
      {view==="pipeline"?<div className="pipeline-board">{stages.map((stage)=>{
      const cards=filteredByCategory.filter((script)=>script.pipelineStage===stage.id);
      const isDropTarget=Boolean(dragged&&dropStage===stage.id);
      return <section
        className={`pipeline-column tone-${stage.tone}`}
        data-drop-target={isDropTarget||undefined}
        key={stage.id}
        onDragEnter={()=>{if(dragged)setDropStage(stage.id);}}
        onDragOver={(event)=>{event.preventDefault();if(dragged)setDropStage(stage.id);}}
        onDrop={()=>move(stage.id)}
      >
        <header><div><span><i/>{stage.label}</span><strong>{cards.length}</strong></div><p>{stage.description}</p></header>
        <div className="pipeline-cards">
          {cards.map((script)=><article className="pipeline-card" key={script.id} draggable={canManage} onDragStart={(event)=>{event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",script.id);setDragged(script.id);setDropStage(script.pipelineStage);}} onDragEnd={()=>{setDragged(null);setDropStage(null);}} data-dragging={dragged===script.id||undefined}><div className="pipeline-card-top"><select className="priority-pill" data-priority={script.priority} value={script.priority} onChange={(event)=>updateMetadata(script,{priority:event.target.value as StudioScript["priority"]})} onClick={(event)=>event.stopPropagation()} aria-label={`${script.title} priority`}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>{canManage?<button type="button" className="pipeline-card-delete" onClick={(event)=>{event.stopPropagation();requestDelete(script);}} onPointerDown={(event)=>event.stopPropagation()} aria-label={`Delete ${script.title}`} title="Delete script"><Trash2/></button>:null}</div><button className="pipeline-card-title" onClick={()=>openWriter(script)}><strong>{cleanScriptTitle(script.title)}</strong></button><div className="pipeline-card-tags"><select value={script.category} onChange={(event)=>updateMetadata(script,{category:event.target.value})} aria-label={`${script.title} category`}><option>{script.category}</option>{["Pain point","Listicle","POV","Education","Founder story","Contrarian","Product demo","Trend remix"].filter((item)=>item!==script.category).map((item)=><option key={item}>{item}</option>)}</select><span>{script.format}</span></div><div className="pipeline-card-stats"><div><strong>{compactNumber(script.performance.views)}</strong><span>views</span></div><div><strong>{script.performance.hookRate===null?"—":`${Math.round(script.performance.hookRate*100)}%`}</strong><span>hook rate</span></div><div><strong>{script.performance.tests}</strong><span>tests</span></div></div><footer><div className="assignment-faces">{script.assignments.length?script.assignments.slice(0,3).map((assignment)=><span key={assignment.id} title={assignment.creatorName}>{initials(assignment.creatorName)}</span>):<em>Unassigned</em>}</div><time>{timeAgo(script.updatedAt)}</time><button onClick={()=>openWriter(script)} aria-label={`Open ${script.title}`}><ArrowUpRight/></button></footer></article>)}
          {isDropTarget?<div className="pipeline-drop-preview" aria-hidden="true"><span>Drop script here</span></div>:null}
          {canManage&&stage.id!=="retired"?<button className="pipeline-add" onClick={openImport}><Plus/>Add script</button>:null}
        </div>
      </section>;
      })}</div>:<div className="pipeline-table"><div className="pipeline-table-head"><span>Script</span><span>Stage</span><span>Category</span><span>Views</span><span>Hook rate</span><span>Tests</span><span/></div>{filteredByCategory.map((script)=><div className="pipeline-table-row" key={script.id} role="button" tabIndex={0} onClick={()=>openWriter(script)} onKeyDown={(event)=>{if((event.target as HTMLElement).closest("button"))return;if(event.key==="Enter"||event.key===" "){event.preventDefault();openWriter(script);}}}><div><strong>{cleanScriptTitle(script.title)}</strong><span>{script.format}</span></div><span>{stages.find((stage)=>stage.id===script.pipelineStage)?.label}</span><span>{script.category}</span><strong>{compactNumber(script.performance.views)}</strong><strong>{script.performance.hookRate===null?"—":`${Math.round(script.performance.hookRate*100)}%`}</strong><span>{script.performance.tests}</span><div className="pipeline-table-actions"><button type="button" onClick={(event)=>{event.stopPropagation();requestDelete(script);}} aria-label={`Delete ${script.title}`} title="Delete script"><Trash2/></button><ArrowUpRight/></div></div>)}</div>}
    </section>
  </div>;
}

function ScriptWriter({ script, updateScript, goBack, save, saving, deleting, assigning, generating, generate, generation, dismissGeneration, openDelete, openAssign, notify, canManage }: { script:StudioScript; updateScript:(updater:(script:StudioScript)=>StudioScript)=>void; goBack:()=>void; save:()=>void; saving:boolean; deleting:boolean; assigning:boolean; generating:boolean; generate:()=>void; generation:GenerationOutcome|null; dismissGeneration:()=>void; openDelete:()=>void; openAssign:()=>void; notify:(message:string)=>void; canManage:boolean }) {
  const [copied, setCopied] = useState(false);
  const [showDiff, setShowDiff] = useState(true);
  const [assetDialog, setAssetDialog] = useState<"reference_video"|"resource"|null>(null);
  const [assetPending, setAssetPending] = useState(false);
  const scriptText = scriptPlainText(script.sections);
  const wordCount = scriptText.split(/\s+/).filter(Boolean).length;
  const { references, resources } = partitionScriptAssets(script.assets);
  const canSave = canManage && Boolean(script.title.trim() && scriptText.trim()) && !saving && !assigning;
  const canGenerate = canManage && Boolean(scriptText.trim()) && !generating && !saving && !assigning;
  const updateSections = (sections:StudioScript["sections"]) => updateScript((current) => {
    return { ...current, hook:scriptHookFromSections(sections), sections, durationSeconds:estimateScriptDuration(sections), updatedAt:new Date().toISOString() };
  });
  const copyScript = async () => { await navigator.clipboard.writeText(scriptClipboardText(script.title,script.sections)); setCopied(true); notify("Script copied with formatting"); window.setTimeout(() => setCopied(false), 1800); };
  const addAsset = async (input:{label:string;kind:"reference_video"|"image"|"audio"|"file";sourceUrl:string}) => {
    setAssetPending(true);
    try {
      if (!isUuid(script.id)) {
        updateScript((current) => ({ ...current, assets:[...current.assets,{ id:`session-asset-${crypto.randomUUID()}`,...input,downloadUrl:null }], updatedAt:new Date().toISOString() }));
      } else {
        const response = await fetch(`/api/scripts/${script.id}/assets`, { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(input) });
        const result = await response.json() as { asset?:StudioAsset; error?:string };
        if (!response.ok || !result.asset) throw new Error(result.error ?? "Resource could not be added");
        updateScript((current) => ({ ...current, assets:[...current.assets,result.asset!], updatedAt:new Date().toISOString() }));
      }
      notify(input.kind === "reference_video" ? "Reference added" : "Resource added");
      setAssetDialog(null);
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : "Resource could not be added");
      return false;
    } finally {
      setAssetPending(false);
    }
  };
  const removeAsset = async (asset:StudioAsset) => {
    setAssetPending(true);
    try {
      if (isUuid(script.id) && isUuid(asset.id)) {
        const response = await fetch(`/api/scripts/${script.id}/assets/${asset.id}`, { method:"DELETE" });
        const result = await response.json() as { error?:string };
        if (!response.ok) throw new Error(result.error ?? "Resource could not be removed");
      }
      updateScript((current) => ({ ...current, assets:current.assets.filter((item) => item.id !== asset.id), updatedAt:new Date().toISOString() }));
      notify(asset.kind === "reference_video" ? "Reference removed" : "Resource removed");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Resource could not be removed");
    } finally {
      setAssetPending(false);
    }
  };
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
    <header className="writer-header"><button className="writer-back" onClick={goBack}><ArrowLeft /> Scripts</button><div className="writer-actions"><button onClick={copyScript} disabled={!scriptText.trim()}>{copied?<Check/>:<Copy/>}{copied?"Copied":"Copy"}</button>{canManage?<><button className="writer-delete" onClick={openDelete} disabled={saving || deleting || assigning || generating}><Trash2/>Delete</button><button className="writer-generate" onClick={generate} disabled={!canGenerate} title="Swap the business, keep every other word">{generating?<Clock3/>:<Sparkles/>}{generating?"Generating…":"Generate"}</button><button onClick={save} disabled={!canSave}>{saving?<Clock3/>:<Clipboard/>}{saving?"Saving…":script.latestVersion ? `Save v${script.latestVersion + 1}` : "Save"}</button><Button className="studio-primary" onClick={openAssign} disabled={!scriptText.trim() || saving || assigning}>{assigning?<Clock3/>:<Send />}{assigning?"Assigning…":"Assign"}</Button></>:null}</div></header>
    <div className="script-writer-layout">
      <main className="simple-script-writer">
        <div className="script-document-kicker"><span>CREATOR SCRIPT</span><span>{wordCount} words · ~{script.durationSeconds ?? estimateScriptDuration(script.sections)} sec</span></div>
        <ScriptTitleEditor value={script.title} onChange={(title) => updateScript((current) => ({...current,title,updatedAt:new Date().toISOString()}))}/>
        <div className="simple-script-toolbar">
          <StatusLabel status={script.status}/>
          <label>Stage<select value={script.pipelineStage} onChange={(event)=>updateScript((current)=>({...current,pipelineStage:event.target.value as StudioScript["pipelineStage"]}))}><option value="not_started">Not started</option><option value="testing">Testing</option><option value="iterate">Keep testing</option><option value="winner">Double down</option><option value="retired">Retired</option></select></label>
          <label>Platform<select value={script.targetPlatform} onChange={(event)=>updateScript((current)=>({...current,targetPlatform:event.target.value}))}><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="youtube">YouTube</option></select></label>
          <label>Priority<select value={script.priority} onChange={(event)=>updateScript((current)=>({...current,priority:event.target.value as StudioScript["priority"]}))}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
          <span className="slash-hint">Type <kbd>/</kbd> for every block</span>
        </div>
        {generation?<GenerationPanel generation={generation} showDiff={showDiff} setShowDiff={setShowDiff} dismiss={dismissGeneration}/>:null}
        <ScriptBlockEditor sections={script.sections} onChange={updateSections} canEdit={canManage} onAddReference={()=>setAssetDialog("reference_video")} onAddResource={()=>setAssetDialog("resource")}/>
      </main>
      <WriterResourceRail script={script} references={references} resources={resources} canManage={canManage} pending={assetPending} onAddReference={()=>setAssetDialog("reference_video")} onAddResource={()=>setAssetDialog("resource")} onRemove={removeAsset}/>
    </div>
    <AssetDialog mode={assetDialog} open={assetDialog!==null} setOpen={(open)=>{if(!open)setAssetDialog(null);}} pending={assetPending} onAdd={addAsset}/>
  </div>;
}

function ScriptTitleEditor({ value,onChange }:{ value:string;onChange:(value:string)=>void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const resize = () => {
      if (!ref.current) return;
      ref.current.style.height = "0px";
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    };
    resize();
    window.addEventListener("resize",resize);
    return () => window.removeEventListener("resize",resize);
  },[value]);
  return <textarea ref={ref} rows={1} className="simple-script-title" aria-label="Script title" value={value} placeholder="Untitled script" onChange={(event)=>onChange(event.target.value.replace(/[\r\n]+/g," "))} onKeyDown={(event)=>{if(event.key==="Enter")event.preventDefault();}}/>;
}

function WriterResourceRail({ script,references,resources,canManage,pending,onAddReference,onAddResource,onRemove }:{ script:StudioScript;references:StudioAsset[];resources:StudioAsset[];canManage:boolean;pending:boolean;onAddReference:()=>void;onAddResource:()=>void;onRemove:(asset:StudioAsset)=>void }) {
  const primaryReference = script.reference?.sourceUrl ? { url:script.reference.sourceUrl,label:script.reference.sourceCreator ?? "Original reference" } : references[0]?.sourceUrl ? { url:references[0].sourceUrl,label:references[0].label } : null;
  return <aside className="writer-resource-rail" aria-label="References and editing resources">
    <div className="writer-rail-section writer-reference-section">
      <header><div><Video/><span><strong>Reference video</strong><small>Keep it visible while writing</small></span></div>{canManage?<button type="button" onClick={onAddReference}><Plus/>Add</button>:null}</header>
      {primaryReference?<ReferenceEmbed url={primaryReference.url} title={primaryReference.label}/>:<div className="writer-rail-empty"><Video/><strong>No reference yet</strong><span>Add the reel, TikTok or YouTube video this script is based on.</span>{canManage?<button type="button" onClick={onAddReference}>Add reference</button>:null}</div>}
      <div className="writer-rail-list">
        {script.reference?.sourceUrl?<a href={script.reference.sourceUrl} target="_blank" rel="noreferrer"><Video/><span><strong>{script.reference.sourceCreator ?? "Original reference"}</strong><small>{sourceHost(script.reference.sourceUrl)}</small></span><ExternalLink/></a>:null}
        {references.map((asset)=><div className="writer-rail-row" key={asset.id}><Video/><a href={asset.sourceUrl ?? "#"} target="_blank" rel="noreferrer"><strong>{asset.label}</strong><small>{asset.sourceUrl?sourceHost(asset.sourceUrl):"Reference"}</small></a>{canManage?<button type="button" aria-label={`Remove ${asset.label}`} disabled={pending} onClick={()=>onRemove(asset)}><Trash2/></button>:<ExternalLink/>}</div>)}
      </div>
    </div>
    <div className="writer-rail-section">
      <header><div><ImageIcon/><span><strong>Editing resources</strong><small>Images, audio and files</small></span></div>{canManage?<button type="button" onClick={onAddResource}><Plus/>Add</button>:null}</header>
      <div className="writer-resource-list">{resources.map((asset)=><div className="writer-resource-card" key={asset.id}>{asset.kind==="image"&&asset.sourceUrl?<a className="writer-resource-preview" href={asset.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Open ${asset.label}`} style={{backgroundImage:`url("${asset.sourceUrl.replaceAll('"','%22')}")`}}/>:null}<div>{assetIcon(asset.kind)}<a href={asset.sourceUrl ?? asset.downloadUrl ?? "#"} target="_blank" rel="noreferrer"><strong>{asset.label}</strong><small>{asset.sourceUrl?sourceHost(asset.sourceUrl):asset.kind}</small></a>{canManage?<button type="button" aria-label={`Remove ${asset.label}`} disabled={pending} onClick={()=>onRemove(asset)}><Trash2/></button>:<ExternalLink/>}</div>{asset.kind==="audio"&&(asset.sourceUrl||asset.downloadUrl)?<audio controls preload="metadata" src={asset.downloadUrl ?? asset.sourceUrl ?? undefined}/>:null}</div>)}{!resources.length?<div className="writer-rail-empty compact"><ImageIcon/><strong>No resources yet</strong><span>Add B-roll, product shots, music or an edit brief.</span></div>:null}</div>
    </div>
  </aside>;
}

function FailedNotificationStrip({ items, notify }:{ items:ScriptStudioData["failedNotifications"]; notify:(message:string)=>void }) {
  const [retrying,setRetrying]=useState<string|null>(null);
  const [dismissed,setDismissed]=useState<string[]>([]);
  const visible = items.filter((item)=>!dismissed.includes(item.operationId));
  if (!visible.length) return null;
  const retry = async (operationId:string) => {
    setRetrying(operationId);
    try {
      const response = await fetch(`/api/discord-operations/${operationId}/retry`,{method:"POST"});
      if(!response.ok) throw new Error("Retry could not be queued");
      setDismissed((current)=>[...current,operationId]);
      notify("Discord notification queued again");
    } catch(error) {
      notify(error instanceof Error?error.message:"Retry could not be queued");
    } finally { setRetrying(null); }
  };
  return <div className="notification-failures" role="alert">
    <header><TriangleAlert/><strong>{visible.length} Discord notification{visible.length===1?"":"s"} did not reach {visible.length===1?"its":"their"} creator</strong></header>
    <ul>{visible.map((item)=><li key={item.operationId}>
      <span><strong>{item.creatorName ?? "A creator"}</strong> was never told about “{item.scriptTitle}”.{item.lastError?<em> {item.lastError}</em>:null}</span>
      <button type="button" disabled={retrying===item.operationId} onClick={()=>retry(item.operationId)}>{retrying===item.operationId?"Queueing…":"Retry"}</button>
    </li>)}</ul>
  </div>;
}

function GenerationPanel({ generation, showDiff, setShowDiff, dismiss }:{ generation:GenerationOutcome; showDiff:boolean; setShowDiff:(value:boolean)=>void; dismiss:()=>void }) {
  const tokens = useMemo(() => generation.before.trim() ? diffWords(generation.before, generation.after) : [], [generation]);
  const preserved = tokens.length ? Math.round(preservedRatio(tokens) * 100) : null;
  const changes = generation.generation.substitutions;
  return <section className="generation-panel" aria-label="Generation result">
    <header>
      <div>
        <strong>{generation.degraded ? "Generated without a model" : "Adapted for your brand"}</strong>
        <span>
          {generation.degraded
            ? "Set AI_GATEWAY_API_KEY to use the real model. This is the deterministic fallback."
            : `${changes.length} substitution${changes.length===1?"":"s"}${preserved===null?"":` · ${preserved}% of the source preserved`}`}
        </span>
      </div>
      <div className="generation-actions">
        {tokens.length?<button type="button" onClick={()=>setShowDiff(!showDiff)}>{showDiff?"Hide diff":"Show diff"}</button>:null}
        <button type="button" onClick={dismiss} aria-label="Dismiss generation summary">Dismiss</button>
      </div>
    </header>
    {changes.length?<ul className="generation-substitutions">{changes.slice(0,12).map((change,index)=><li key={`${change.sectionId}-${index}`}><del>{change.from}</del><span>→</span><ins>{change.to}</ins></li>)}</ul>:null}
    {showDiff&&tokens.length?<p className="generation-diff">{tokens.map((token,index)=>token.state==="same"
      ? <span key={index}>{token.text} </span>
      : token.state==="added"
        ? <ins key={index}>{token.text} </ins>
        : <del key={index}>{token.text} </del>)}</p>:null}
  </section>;
}

function ImportDialog({ open, setOpen, onImport, onCreate, importing }:{ open:boolean; setOpen:(open:boolean)=>void; onImport:(url:string)=>Promise<boolean>; onCreate:(input:{title:string;body:string;url:string;creator:string})=>void; importing:boolean }) {
  const [url,setUrl]=useState("");
  const [manual,setManual]=useState(false);
  const [title,setTitle]=useState("");
  const [body,setBody]=useState("");
  const [creator,setCreator]=useState("");
  const parsed = useMemo(()=>url.trim()?parseReferenceUrl(url):null,[url]);
  const ready = Boolean(parsed && parsed.kind!=="unsupported") && !importing;
  const submit = async () => { if(!ready)return; if(await onImport(url)){setUrl("");setManual(false);} };
  const createManually = () => { onCreate({title,body,url,creator}); setTitle(""); setBody(""); setUrl(""); setCreator(""); setManual(false); };
  return <Dialog open={open} onOpenChange={setOpen}><DialogContent className="reference-dialog new-script-dialog sm:max-w-2xl">
    <DialogHeader><DialogTitle>New script</DialogTitle><DialogDescription>Paste an Instagram reel or TikTok link and it is transcribed straight into the writer.</DialogDescription></DialogHeader>
    <div className="import-form">
      <label className="import-url">
        <Link2/>
        <input value={url} autoFocus placeholder="Paste an Instagram reel or TikTok link…" onChange={(event)=>setUrl(event.target.value)} onKeyDown={(event)=>{if(event.key==="Enter")void submit();}} disabled={importing}/>
        <Button className="studio-primary" disabled={!ready} onClick={submit}>{importing?<Clock3/>:<Sparkles/>}{importing?"Transcribing…":"Import"}</Button>
      </label>
      {parsed?.kind==="short_link"?<p className="import-hint">TikTok share link detected — it will be expanded automatically.</p>:null}
      {parsed?.kind==="unsupported"&&url.trim()?<p className="import-hint import-hint-error">{parsed.reason}</p>:null}
      {importing?<p className="import-hint">Resolving the video and transcribing the audio. This takes about 20 seconds.</p>:null}
      <button type="button" className="import-manual-toggle" onClick={()=>setManual(!manual)}>{manual?"Hide manual entry":"Or write it manually"}</button>
      {manual?<div className="new-script-form">
        <input value={title} onChange={(event)=>setTitle(event.target.value)} placeholder="Title"/>
        <textarea rows={10} value={body} onChange={(event)=>setBody(event.target.value)} placeholder="Paste or write the transcript…"/>
        <div><input value={creator} onChange={(event)=>setCreator(event.target.value)} placeholder="Source creator · optional"/></div>
        <DialogFooter className="reference-dialog-footer"><Button className="studio-primary" disabled={!title.trim()||!body.trim()} onClick={createManually}>Create draft</Button></DialogFooter>
      </div>:null}
    </div>
  </DialogContent></Dialog>;
}

function BrandDialog({ open, setOpen, brand, setBrand, notify, canManage }:{ open:boolean; setOpen:(open:boolean)=>void; brand:ScriptStudioData["brand"]; setBrand:(brand:ScriptStudioData["brand"])=>void; notify:(message:string)=>void; canManage:boolean }) {
  const [draft,setDraft]=useState(brand);
  const [saving,setSaving]=useState(false);
  const submit = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/brand",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(draft)});
      const result = await response.json() as { error?:string };
      if(!response.ok) throw new Error(result.error ?? "Brand could not be saved");
      setBrand(draft);
      notify("Brand context saved");
      setOpen(false);
    } catch(error) {
      notify(error instanceof Error?error.message:"Brand could not be saved");
    } finally { setSaving(false); }
  };
  const listField = (label:string,key:"voice"|"bannedPhrases"|"proofPoints",placeholder:string) => <label key={key}>
    <span>{label}</span>
    <textarea rows={2} value={draft[key].join("\n")} placeholder={placeholder} onChange={(event)=>setDraft({...draft,[key]:event.target.value.split(/\n+/).map((line)=>line.trim()).filter(Boolean)})}/>
  </label>;
  return <Dialog open={open} onOpenChange={setOpen}><DialogContent className="brand-dialog sm:max-w-xl">
    <DialogHeader><DialogTitle>Brand context</DialogTitle><DialogDescription>Generation swaps the business to this. The more precise this is, the better the output.</DialogDescription></DialogHeader>
    <div className="brand-form">
      <label><span>Business name</span><input value={draft.name} onChange={(event)=>setDraft({...draft,name:event.target.value})} placeholder="Result"/></label>
      <label><span>What it is</span><textarea rows={2} value={draft.productDescription} onChange={(event)=>setDraft({...draft,productDescription:event.target.value})} placeholder="One clear sentence about the product."/></label>
      <label><span>Who it is for</span><input value={draft.audience} onChange={(event)=>setDraft({...draft,audience:event.target.value})} placeholder="UGC managers running creator programs"/></label>
      {listField("Voice · one per line","voice","direct\nplain-spoken")}
      {listField("Proof points · one per line","proofPoints","Used by 40 creator programs")}
      {listField("Never say · one per line","bannedPhrases","revolutionary\ngame-changing")}
    </div>
    <DialogFooter><Button className="studio-primary" disabled={!canManage||!draft.name.trim()||!draft.productDescription.trim()||saving} onClick={submit}>{saving?"Saving…":"Save brand"}</Button></DialogFooter>
  </DialogContent></Dialog>;
}

function AssetDialog({ mode, open, setOpen, pending, onAdd }:{ mode:"reference_video"|"resource"|null; open:boolean; setOpen:(open:boolean)=>void; pending:boolean; onAdd:(input:{label:string;kind:"reference_video"|"image"|"audio"|"file";sourceUrl:string})=>Promise<boolean> }) {
  const [label,setLabel]=useState("");
  const [url,setUrl]=useState("");
  const [kind,setKind]=useState<"image"|"audio"|"file">("image");
  const selectedKind = mode === "reference_video" ? "reference_video" : kind;
  const submit = async () => { if(await onAdd({label:label.trim(),kind:selectedKind,sourceUrl:url.trim()})){setLabel("");setUrl("");setKind("image");} };
  return <Dialog open={open} onOpenChange={setOpen}><DialogContent className="asset-dialog sm:max-w-lg"><DialogHeader><DialogTitle>{mode==="reference_video"?"Add reference video":"Add editing resource"}</DialogTitle></DialogHeader><div className="asset-dialog-form">{mode==="resource"?<label><span>Type</span><select value={kind} onChange={(event)=>setKind(event.target.value as typeof kind)}><option value="image">Image</option><option value="audio">Audio</option><option value="file">File</option></select></label>:null}<label><span>Name</span><input value={label} onChange={(event)=>setLabel(event.target.value)} placeholder={mode==="reference_video"?"Reference name":"Resource name"} autoFocus/></label><label><span>URL</span><input type="url" value={url} onChange={(event)=>setUrl(event.target.value)} placeholder="https://…"/></label></div><DialogFooter><Button className="studio-primary" disabled={!label.trim()||!validHttpUrl(url)||pending} onClick={submit}>{pending?"Adding…":"Add"}</Button></DialogFooter></DialogContent></Dialog>;
}

function AssignDialog({ open,setOpen,script,creators,assigning,onAssign }:{ open:boolean;setOpen:(open:boolean)=>void;script:StudioScript|null;creators:StudioCreator[];assigning:boolean;onAssign:(ids:string[],dueAt:string,message:string,notifyCreator:boolean)=>void }) {
  const [selected,setSelected]=useState<string[]>(() => script?.assignments.map((assignment) => assignment.creatorId) ?? []); const [search,setSearch]=useState(""); const [dueAt,setDueAt]=useState(""); const [message,setMessage]=useState("Here’s your script. Let me know if you have any questions."); const [notifyCreator,setNotifyCreator]=useState(true);
  const visibleCreators = creators.filter((creator) => `${creator.name} ${creator.username ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  const toggle=(id:string)=>setSelected((current)=>current.includes(id)?current.filter((item)=>item!==id):[...current,id]);
  return <Dialog open={open} onOpenChange={setOpen}><DialogContent className="assign-dialog sm:max-w-xl"><DialogHeader><span className="dialog-kicker"><UserRoundCheck /> CREATOR HANDOFF</span><DialogTitle>Assign script</DialogTitle><DialogDescription>{script?.title ?? "Choose who should film this script."}</DialogDescription></DialogHeader><label className="creator-picker-search"><Search /><input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Search creators or Discord usernames…" /></label><div className="creator-picker">{visibleCreators.length?visibleCreators.map((creator)=><button key={creator.id} className={selected.includes(creator.id)?"selected":""} onClick={()=>toggle(creator.id)}><Avatar><AvatarImage src={creator.avatarUrl ?? undefined} alt=""/><AvatarFallback>{initials(creator.name)}</AvatarFallback></Avatar><div><strong>{creator.name}</strong><span>{creator.username?`@${creator.username}`:"No Discord connected"} · {creator.activeAssignments} active</span></div><i>{selected.includes(creator.id)?<Check/>:null}</i></button>):<p className="creator-picker-empty">No creators match that search.</p>}</div><div className="assignment-fields assignment-fields-single"><label><span>Due date</span><input type="date" value={dueAt} onChange={(event)=>setDueAt(event.target.value)}/></label></div><label className="assignment-notify"><Checkbox checked={notifyCreator} onCheckedChange={(checked)=>setNotifyCreator(checked===true)} /><span><strong>Notify creator in Discord</strong><small>Send the message and script link in their private channel.</small></span></label><label className="assignment-message" data-disabled={!notifyCreator}><span>Discord message</span><textarea rows={3} value={message} onChange={(event)=>setMessage(event.target.value)} disabled={!notifyCreator}/></label><DialogFooter className="assign-dialog-footer"><span>{selected.length} creator{selected.length===1?"":"s"} selected · {notifyCreator?"Discord notification on":"silent assignment"}</span><Button className="studio-primary" disabled={!selected.length || assigning} onClick={()=>onAssign(selected,dueAt,message,notifyCreator)}>{assigning?<Clock3/>:<Send />}{assigning?"Creating…":"Create assignment"}</Button></DialogFooter></DialogContent></Dialog>;
}

function StatusLabel({ status }:{ status:StudioScript["status"] }) { const labels:Record<StudioScript["status"],string>={draft:"Draft",ready:"Ready to film",assigned:"With creator",in_review:"In review",approved:"Approved",published:"Published",archived:"Archived"}; return <span className={`script-status status-${status}`}><i/>{labels[status]}</span>; }
function initials(name:string):string { return name.split(" ").filter(Boolean).slice(0,2).map((part)=>part[0]?.toUpperCase()).join(""); }
function isUuid(value:string):boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function timeAgo(value:string):string { const minutes=Math.floor((Date.now()-new Date(value).getTime())/60_000); if(minutes<1)return"Just now"; if(minutes<60)return`${minutes}m ago`; const hours=Math.floor(minutes/60); if(hours<24)return`${hours}h ago`; return`${Math.floor(hours/24)}d ago`; }
function compactNumber(value:number):string { return new Intl.NumberFormat("en",{notation:value>=10_000?"compact":"standard",maximumFractionDigits:1}).format(value); }
function plainScriptSection(copy:string,id?:string) { return { id:id??crypto.randomUUID(),label:"Script",timecode:"",delivery:"",copy,visualDirection:"",assetIds:[] as string[] }; }
function assetIcon(kind:string):ReactNode { if(kind==="reference_video")return <Video/>; if(kind==="audio")return <Music2/>; if(kind==="image")return <ImageIcon/>; return <File/>; }
function sourceHost(value:string):string { try { return new URL(value).hostname.replace(/^www\./,""); } catch { return value; } }
function validHttpUrl(value:string):boolean { try { const url=new URL(value.trim()); return url.protocol==="http:"||url.protocol==="https:"; } catch { return false; } }
