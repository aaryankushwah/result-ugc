import type { ScriptSection } from "@result/db";

export const scriptBlockTypes = [
  "text",
  "heading_1",
  "heading_2",
  "heading_3",
  "beat",
  "direction",
  "dialogue",
  "bullet",
  "quote",
  "divider",
] as const;

export type ScriptBlockType = (typeof scriptBlockTypes)[number];

const labels: Record<ScriptBlockType, string> = {
  text: "Text",
  heading_1: "Heading 1",
  heading_2: "Heading 2",
  heading_3: "Heading 3",
  beat: "New beat",
  direction: "Stage direction",
  dialogue: "Dialogue",
  bullet: "Bullet",
  quote: "Quote",
  divider: "Divider",
};

export function scriptBlockType(section: ScriptSection): ScriptBlockType {
  if (section.blockType) return section.blockType;
  if (section.label !== "Script" || section.timecode || section.delivery || section.visualDirection) return "beat";
  return "text";
}

export function createScriptBlock(type: ScriptBlockType, id: string): ScriptSection {
  return {
    id,
    label: labels[type],
    timecode: "",
    delivery: "",
    copy: "",
    visualDirection: "",
    assetIds: [],
    blockType: type,
  };
}

export function scriptPlainText(sections: ScriptSection[]): string {
  return sections
    .filter((section) => scriptBlockType(section) !== "divider")
    .map((section) => section.copy.trim())
    .filter(Boolean)
    .join("\n\n");
}

export function scriptClipboardText(title: string, sections: ScriptSection[]): string {
  const blocks = sections.flatMap((section) => {
    const type = scriptBlockType(section);
    if (type === "divider") return ["──────────"];
    if (type === "beat") {
      return [
        `${section.label}${section.timecode ? ` (${section.timecode})` : ""}`,
        section.visualDirection.trim(),
        section.copy.trim(),
      ].filter(Boolean);
    }
    const copy = section.copy.trim();
    if (!copy) return [];
    if (type === "heading_1") return [copy.toUpperCase()];
    if (type === "heading_2" || type === "heading_3") return [copy];
    if (type === "direction") return [`[${copy}]`];
    if (type === "bullet") return [`• ${copy}`];
    if (type === "quote") return [`“${copy}”`];
    return [copy];
  });
  return [title.trim(), ...blocks].filter(Boolean).join("\n\n");
}
