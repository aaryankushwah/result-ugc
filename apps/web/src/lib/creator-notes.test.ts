import {describe,expect,it} from "vitest";
import {normalizeCreatorPageView,noteInputPlaceholder} from "./creator-notes";
describe("creator notes view",()=>{
  it("keeps the existing roster as the default",()=>{expect(normalizeCreatorPageView()).toBe("creators");expect(normalizeCreatorPageView("notes")).toBe("notes");});
  it("names the creator in the note input",()=>{expect(noteInputPlaceholder("Jimi")).toBe("Write a note about Jimi…");});
});
