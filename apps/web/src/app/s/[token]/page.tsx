import { creators, getDatabase, hasDatabase, scriptAssignments, scripts } from "@result/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

// A capability URL: anyone holding the token can read this one script.
// Deliberately unauthenticated, because creators are not portal users.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function SharedScriptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!hasDatabase() || !token) notFound();

  const row = (await getDatabase()
    .select({
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
    })
    .from(scriptAssignments)
    .innerJoin(scripts, eq(scripts.id, scriptAssignments.scriptId))
    .innerJoin(creators, eq(creators.id, scriptAssignments.creatorId))
    .where(eq(scriptAssignments.shareToken, token))
    .limit(1))[0];

  if (!row) notFound();

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

      <section className="shared-script-body">
        {row.sections.map((section) => (
          <article key={section.id} className="shared-script-section">
            <p className="shared-script-label">
              {section.label}
              {section.timecode ? <span> · {section.timecode}</span> : null}
            </p>
            {section.delivery ? <p className="shared-script-delivery">{section.delivery}</p> : null}
            <p className="shared-script-copy">{section.copy}</p>
            {section.visualDirection ? (
              <p className="shared-script-visual"><strong>Visual:</strong> {section.visualDirection}</p>
            ) : null}
          </article>
        ))}
      </section>

      <footer className="shared-script-footer">
        <p>Last updated {new Date(row.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}. Questions go in your Discord channel.</p>
      </footer>
    </main>
  );
}
