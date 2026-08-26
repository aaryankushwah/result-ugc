import { creators, getDatabase, hasDatabase, scriptAssignments, scriptAssets, scriptReferences, scripts } from "@result/db";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ExternalLink, File, Image as ImageIcon, Music2, Video } from "lucide-react";
import { ReferenceEmbed } from "@/components/reference-embed";
import { scriptBlockType } from "@/lib/script-blocks";
/* eslint-disable @next/next/no-img-element -- script resources can be arbitrary external URLs and animated GIFs */

// A capability URL: anyone holding the token can read this one script.
// Deliberately unauthenticated, because creators are not portal users.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function SharedScriptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!hasDatabase() || !token) notFound();

  const database = getDatabase();
  const row = (await database
    .select({
      scriptId: scripts.id,
      organizationId: scripts.organizationId,
      assignmentState: scriptAssignments.state,
      dueAt: scriptAssignments.dueAt,
      message: scriptAssignments.message,
      creatorName: creators.displayName,
      title: scripts.title,
      hook: scripts.hook,
      sections: scripts.sections,
      format: scripts.format,
      targetPlatform: scripts.targetPlatform,
      durationSeconds: scripts.durationSeconds,
      updatedAt: scripts.updatedAt,
      referenceUrl: scriptReferences.sourceUrl,
      referenceCreator: scriptReferences.sourceCreator,
    })
    .from(scriptAssignments)
    .innerJoin(scripts, eq(scripts.id, scriptAssignments.scriptId))
    .innerJoin(creators, eq(creators.id, scriptAssignments.creatorId))
    .leftJoin(scriptReferences, eq(scriptReferences.id, scripts.referenceId))
    .where(eq(scriptAssignments.shareToken, token))
    .limit(1))[0];

  if (!row) notFound();

  const assets = await database.select({ id:scriptAssets.id,label:scriptAssets.label,kind:scriptAssets.kind,sourceUrl:scriptAssets.sourceUrl,downloadUrl:scriptAssets.downloadUrl })
    .from(scriptAssets)
    .where(and(eq(scriptAssets.scriptId,row.scriptId),eq(scriptAssets.organizationId,row.organizationId)));
  const referenceAssets = assets.filter((asset)=>asset.kind==="reference_video"&&asset.sourceUrl);
  const editingAssets = assets.filter((asset)=>asset.kind!=="reference_video");
  const primaryReference = row.referenceUrl ? {url:row.referenceUrl,label:row.referenceCreator ?? "Original reference"} : referenceAssets[0]?.sourceUrl ? {url:referenceAssets[0].sourceUrl,label:referenceAssets[0].label} : null;

  const due = row.dueAt ? new Date(row.dueAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : null;

  return (
    <main className="shared-script">
      <header className="shared-script-header">
        <p className="shared-script-eyebrow">Script for {row.creatorName}</p>
        <h1>{row.title}</h1>
        <dl className="shared-script-meta">
          <div><dt>Format</dt><dd>{row.format}</dd></div>
          <div><dt>Platform</dt><dd>{row.targetPlatform}</dd></div>
          {row.durationSeconds ? <div><dt>Length</dt><dd>~{row.durationSeconds}s</dd></div> : null}
          {due ? <div><dt>Due</dt><dd>{due}</dd></div> : null}
          <div><dt>Status</dt><dd>{row.assignmentState.replaceAll("_", " ")}</dd></div>
        </dl>
      </header>

      {row.message ? (
        <section className="shared-script-note">
          <h2>Note from your manager</h2>
          <p>{row.message}</p>
        </section>
      ) : null}

      <div className="shared-script-layout">
        <section className="shared-script-body">
          {row.sections.map((section) => {
            const type = scriptBlockType(section);
            if(type==="divider") return <hr className="shared-block-divider" key={section.id}/>;
            if(type!=="beat") return <div key={section.id} className={`shared-block shared-block-${type}`}>{type==="bullet"?<span>•</span>:null}<p>{section.copy}</p></div>;
            return <article key={section.id} className="shared-script-section">
              <p className="shared-script-label">{section.label}{section.timecode ? <span> ({section.timecode})</span> : null}</p>
              {section.delivery ? <p className="shared-script-delivery">{section.delivery}</p> : null}
              {section.visualDirection ? <p className="shared-script-visual">{section.visualDirection}</p> : null}
              <p className="shared-script-copy">{section.copy}</p>
            </article>;
          })}
        </section>
        <aside className="shared-script-resources">
          <section><header><Video/><span><strong>Reference video</strong><small>Watch while you film</small></span></header>{primaryReference?<ReferenceEmbed url={primaryReference.url} title={primaryReference.label} compact/>:<p className="shared-resource-empty">No reference video attached.</p>}{referenceAssets.map((asset)=><a key={asset.id} href={asset.sourceUrl!} target="_blank" rel="noreferrer"><Video/><span><strong>{asset.label}</strong><small>Reference</small></span><ExternalLink/></a>)}</section>
          <section><header><ImageIcon/><span><strong>Editing resources</strong><small>Everything needed for the edit</small></span></header>{editingAssets.map((asset)=>{
            const url=asset.sourceUrl??asset.downloadUrl;
            return <div className="shared-resource-card" key={asset.id}>{asset.kind==="image"&&url?<a className="shared-resource-preview" href={url} target="_blank" rel="noreferrer"><img src={url} alt={asset.label} loading="lazy"/></a>:null}{asset.kind==="video"&&url?<video controls playsInline preload="metadata" src={url}/>:null}<a href={url??"#"} target="_blank" rel="noreferrer">{asset.kind==="audio"?<Music2/>:asset.kind==="image"?<ImageIcon/>:asset.kind==="video"?<Video/>:<File/>}<span><strong>{asset.label}</strong><small>{asset.kind==="image"?"Image or GIF":asset.kind}</small></span><ExternalLink/></a></div>;
          })}{!editingAssets.length?<p className="shared-resource-empty">No editing resources attached.</p>:null}</section>
        </aside>
      </div>

      <footer className="shared-script-footer">
        <p>Last updated {new Date(row.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}. Questions go in your Discord channel.</p>
      </footer>
    </main>
  );
}
