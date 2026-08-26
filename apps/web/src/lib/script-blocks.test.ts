import { describe, expect, it } from "vitest";
import { createScriptBlock, scriptBlockType, scriptClipboardText, scriptCommandPlaceholder, scriptPlainText } from "./script-blocks";

describe("script blocks", () => {
  it("keeps legacy freeform and beat sections readable", () => {
    expect(scriptBlockType({ id:"1", label:"Script", timecode:"", delivery:"", copy:"Hello", visualDirection:"", assetIds:[] })).toBe("text");
    expect(scriptBlockType({ id:"2", label:"Hook", timecode:"0:00–0:06", delivery:"", copy:"Hello", visualDirection:"Talking head", assetIds:[] })).toBe("beat");
  });

  it("creates persistent typed blocks and omits dividers from spoken text", () => {
    const dialogue = { ...createScriptBlock("dialogue", "1"), copy:"Say this out loud." };
    const divider = createScriptBlock("divider", "2");
    expect(scriptPlainText([dialogue, divider])).toBe("Say this out loud.");
    expect(scriptClipboardText("Draft", [dialogue, divider])).toContain("──────────");
  });

  it("only shows the slash-command hint on the active empty block", () => {
    expect(scriptCommandPlaceholder("first", "second", 3)).toBe("");
    expect(scriptCommandPlaceholder("second", "second", 3)).toBe("Type / for commands");
    expect(scriptCommandPlaceholder("only", null, 1)).toBe("Type / for commands");
    expect(scriptCommandPlaceholder("first", null, 3)).toBe("");
  });
});
