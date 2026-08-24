export type StudioSection = {
  id: string;
  label: string;
  timecode: string;
  delivery: string;
  copy: string;
  visualDirection: string;
  assetIds: string[];
};

export type StudioTranscriptSection = {
  id: string;
  label: string;
  timecode: string;
  text: string;
};

const SECTION_LABELS = ["HOOK", "PROBLEM", "SOLUTION", "PROOF", "CTA"] as const;

export function segmentTranscript(transcript: string): StudioTranscriptSection[] {
  const normalized = transcript.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const sentences = normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [normalized];
  return sentences.slice(0, 12).map((text, index) => ({
    id: `transcript-${index + 1}`,
    label: SECTION_LABELS[Math.min(index, SECTION_LABELS.length - 1)],
    timecode: formatTimecode(index * 4),
    text,
  }));
}

export function adaptReferenceForResult(transcript: string): StudioSection[] {
  const source = segmentTranscript(transcript);
  const hook = source[0]?.text ?? "Your UGC team is not slow—your workflow is.";
  const problem = source.slice(1, 3).map((section) => section.text).join(" ") || "Briefs, feedback, and approvals are scattered across too many places.";
  return [
    {
      id: "hook",
      label: "Hook",
      timecode: "0–3 sec",
      delivery: "Direct to camera · fast",
      copy: hook
        .replace(/your team/gi, (match) => match[0] === match[0]?.toUpperCase() ? "Your UGC team" : "your UGC team")
        .replace(/our team/gi, (match) => match[0] === match[0]?.toUpperCase() ? "Our UGC team" : "our UGC team"),
      visualDirection: "Start mid-motion. Put the messy workflow on screen immediately.",
      assetIds: [],
    },
    {
      id: "problem",
      label: "Problem",
      timecode: "3–10 sec",
      delivery: "Relatable · specific",
      copy: problem,
      visualDirection: "Quick cuts: open tabs, unread messages, and a creator spreadsheet.",
      assetIds: [],
    },
    {
      id: "solution",
      label: "Solution",
      timecode: "10–20 sec",
      delivery: "Confident · show product",
      copy: "With Result, references, scripts, creators, feedback, and approved content finally live in one clear workflow.",
      visualDirection: "Screen recording: move a script from Draft to Ready to film.",
      assetIds: [],
    },
    {
      id: "proof-cta",
      label: "Proof + CTA",
      timecode: "20–30 sec",
      delivery: "Personal · decisive",
      copy: "Creators know exactly what to film and the team can ship winning content faster. Build your next campaign in Result.",
      visualDirection: "Return to camera, then finish on the Result script bank.",
      assetIds: [],
    },
  ];
}

export function estimateScriptDuration(sections: StudioSection[]): number {
  const words = sections.reduce((total, section) => total + section.copy.trim().split(/\s+/).filter(Boolean).length, 0);
  return Math.max(1, Math.round(words / 2.5));
}

export function formatScriptForClipboard(title: string, sections: StudioSection[]): string {
  return [title.trim(), ...sections.flatMap((section) => [
    `${section.label.toUpperCase()} · ${section.timecode}`,
    section.copy.trim(),
    `VISUAL: ${section.visualDirection.trim()}`,
  ])].join("\n\n");
}

function formatTimecode(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
