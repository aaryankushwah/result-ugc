import { cleanTitle, scriptShareUrl } from "./script-delivery.js";

export type ChecklistEntry = {
  title: string;
  state: string;
  dueAt: Date | string | null;
  shareToken: string | null;
};

/** States that mean the creator has nothing left to do on that script. */
const DONE_STATES = new Set(["approved"]);

const STATE_LABELS: Record<string, string> = {
  assigned: "Not started",
  viewed: "Seen it",
  filming: "Filming",
  submitted: "Waiting on review",
  changes_requested: "Changes requested",
  approved: "Approved",
  cancelled: "Cancelled",
};

export function stateLabel(state: string): string {
  return STATE_LABELS[state] ?? state.replaceAll("_", " ");
}

function dueSuffix(dueAt: Date | string | null): string {
  if (!dueAt) return "";
  const date = dueAt instanceof Date ? dueAt : new Date(dueAt);
  if (Number.isNaN(date.getTime())) return "";
  return ` · due <t:${Math.floor(date.getTime() / 1_000)}:D>`;
}

/**
 * Renders assignments as a tickable checklist. One line per script: a box, the
 * linked title, its state, and the due date. No transcript previews — the link
 * is the way into the script.
 */
export function buildScriptChecklist(entries: ChecklistEntry[], options: { forName: string; truncated?: boolean }): string {
  if (!entries.length) return `**${options.forName}** has no scripts assigned right now.`;

  const outstanding = entries.filter((entry) => !DONE_STATES.has(entry.state)).length;
  const lines = entries.map((entry) => {
    const box = DONE_STATES.has(entry.state) ? "✅" : "⬜";
    const url = scriptShareUrl(entry.shareToken);
    const title = cleanTitle(entry.title);
    const linked = url ? `[${escapeMarkdown(title)}](${url})` : escapeMarkdown(title);
    return `${box} **${linked}**\n ${stateLabel(entry.state)}${dueSuffix(entry.dueAt)}`;
  });

  const header = `**Scripts for ${options.forName}** · ${outstanding} to film · ${entries.length} total`;
  const footer = options.truncated ? "\n\n_Showing the 10 most recent._" : "";
  return `${header}\n\n${lines.join("\n")}${footer}`;
}

/** Titles come from captions and can contain markdown that breaks the link text. */
export function escapeMarkdown(value: string): string {
  return value.replace(/([\\`*_~|\[\]()])/g, "\\$1");
}
